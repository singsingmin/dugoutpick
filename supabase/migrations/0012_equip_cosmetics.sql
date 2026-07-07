-- ============================================================================
-- 0012 · 칭호/배경 장착을 RPC로 (버그 수정)
-- 문제: equip는 prediction_stats 컬럼 직접 update였는데, 리그 미참여(닉네임 미설정) 유저는
--       prediction_stats 행 자체가 없다. 배경은 리그 참여 없이도 구매(owned_backgrounds)할 수 있어,
--       구매만 한 유저가 장착하면 update가 0행 매치 → 조용히 무시 → 재진입 시 기본으로 표시.
--       (칭호도 admin/event 지급을 비참여자에게 하면 동일 문제.)
-- 해결: 정의 함수가 prediction_stats 행을 먼저 보장(insert on conflict)한 뒤 update.
--       보유 검증 트리거(validate_equipped_cosmetics)는 update에 그대로 걸려 미보유 장착을 계속 차단.
-- 0011 다음에 실행(순서: 0006→…→0011→0012).
-- ============================================================================

create or replace function public.equip_title(p_title_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.prediction_stats (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.prediction_stats set equipped_title = p_title_id, updated_at = now()
    where user_id = auth.uid();
end;
$$;
revoke execute on function public.equip_title(text) from anon;

create or replace function public.equip_background(p_background_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.prediction_stats (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.prediction_stats set equipped_background = p_background_id, updated_at = now()
    where user_id = auth.uid();
end;
$$;
revoke execute on function public.equip_background(text) from anon;

-- 이제 장착은 RPC만 경로 → prediction_stats 컬럼 직접 update 권한 회수(정의 함수는 owner 권한으로 동작).
revoke update (equipped_title, equipped_background) on public.prediction_stats from authenticated;
