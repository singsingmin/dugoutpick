// 꿀잼지수 3안 — 한 줄 이유(rule-based) 추가. 라이브 데이터.
const DATE = '20260531';
const strip = (h) => (h || '').replace(/<[^>]+>/g, '').trim();

const standings = {
  'LG':{rank:1,wr:.615,l10:7,streak:+2}, 'KT':{rank:2,wr:.608,l10:6,streak:+3},
  '삼성':{rank:3,wr:.600,l10:6,streak:-2}, 'KIA':{rank:4,wr:.538,l10:7,streak:-2},
  '한화':{rank:5,wr:.510,l10:6,streak:+3}, '두산':{rank:6,wr:.481,l10:5,streak:+2},
  'SSG':{rank:7,wr:.431,l10:0,streak:-11}, 'NC':{rank:8,wr:.420,l10:3,streak:+1},
  '롯데':{rank:8,wr:.420,l10:5,streak:-1}, '키움':{rank:10,wr:.377,l10:3,streak:-7},
};
const rivKey=(a,b)=>[a,b].sort().join('|');
const rivalryName={ 'LG|두산':'잠실 라이벌 더비', 'NC|롯데':'낙동강 더비', '롯데|삼성':'영남 더비', 'KIA|삼성':'전통의 명문 자존심 대결' };
const rivalry=Object.fromEntries([['LG|두산',1.0],['NC|롯데',0.7],['롯데|삼성',0.7],['KIA|삼성',0.6]]);
const clamp01=x=>Math.max(0,Math.min(1,x));
const strength=r=>(10-r)/9;
const playoffRel=r=>(r>=4&&r<=7?1:(r===3||r===8?.5:0));
const aceness=era=>clamp01((5.0-era)/(5.0-2.0));
const LEAGUE_ERA=4.20;
const W={close:30, quality:20, form:15, rivalry:10, playoff:10, pitcher:15};
const calibrate=raw=>Math.round(100/(1+Math.exp(-(raw-45)/10)));

// ---- 한 줄 이유 생성기: 요소별 (기여도, 문구) 반환 ----
function reasonFragments(aw,hm,a,h,parts,extra){
  const f={};
  const diff=Math.abs(a.wr-h.wr);
  f.close = diff<0.005 ? `승률 ${a.wr.toFixed(3)} 완전 동률의 초접전` : `승률차 단 ${diff.toFixed(3)}, 막상막하 승부`;
  // '상위권 빅매치'는 둘 다 4위 이내일 때만 (격차 큰 경기 오인 방지)
  f.quality = Math.max(a.rank,h.rank)<=4 ? `리그 ${Math.min(a.rank,h.rank)}위·${Math.max(a.rank,h.rank)}위 상위권 빅매치` : '';
  // form: 가장 강한 스토리 선택
  const sa=a.streak, sh=h.streak;
  const pick = Math.abs(sa)>=Math.abs(sh) ? [aw,sa] : [hm,sh];
  if(pick[1]<=-5) f.form=`${pick[0]} ${-pick[1]}연패 탈출 도전`;
  else if(pick[1]>=3) f.form=`${pick[0]} ${pick[1]}연승 질주`;
  else f.form=`양 팀 최근 10경기 합 ${a.l10+h.l10}승의 화력`;
  f.rivalry = rivalryName[rivKey(aw,hm)] || '';
  f.playoff = (a.rank>=7||h.rank>=7) ? `${Math.max(a.rank,h.rank)}위권 PO 생존 경쟁` : '가을야구 직행 순위 다툼';
  const bestERA=Math.min(extra.aERA,extra.hERA);
  const bestNM = extra.aERA<=extra.hERA ? extra.aPit : extra.hPit;
  f.pitcher = (extra.aERA<3.6&&extra.hERA<3.6) ? `양 팀 에이스 투수전(ERA ${extra.aERA}·${extra.hERA})` : `${bestNM}(ERA ${bestERA}) 호투 기대`;
  return f;
}

function buildReason(parts, contrib, frags){
  // 기여도 상위 요소 선택 (라이벌 제외 — 라이벌은 떡밥이라 별도 우선 노출)
  const order=Object.entries(contrib).filter(([k,v])=>k!=='rivalry' && v>0.5 && frags[k]).sort((x,y)=>y[1]-x[1]);
  const main = order.length ? frags[order[0][0]] : frags.close;
  // 라이벌전이면 무조건 앞에 노출 (가장 매력적인 hook)
  if(frags.rivalry) return `${frags.rivalry} · ${main}`;
  // 아니면 2순위가 top의 65% 이상일 때 결합
  const sec=order[1];
  if(order.length && sec && sec[1]>=order[0][1]*0.65 && frags[sec[0]]!==main) return `${main} · ${frags[sec[0]]}`;
  return main;
}

async function main(){
  const gl=await fetch('https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Referer':'https://www.koreabaseball.com/'},
    body:`leId=1&srId=0&date=${DATE}`}).then(r=>r.json());
  const ph=await fetch('https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx',{headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.text());
  const eraMap={};
  for(const m of ph.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
    const c=[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>strip(x[1]));
    if(c.length>5 && /^\d+$/.test(c[0]) && /^\d\.\d\d$/.test(c[3])) eraMap[c[1]]=parseFloat(c[3]);
  }

  const games=gl.game.map(g=>{
    const aw=g.AWAY_NM.trim(), hm=g.HOME_NM.trim();
    const a=standings[aw], h=standings[hm];
    const aPit=g.T_PIT_P_NM.trim(), hPit=g.B_PIT_P_NM.trim();
    const aERA=eraMap[aPit]??LEAGUE_ERA, hERA=eraMap[hPit]??LEAGUE_ERA;
    const parts={
      close: clamp01(1-Math.abs(a.wr-h.wr)/0.15),
      quality:(strength(a.rank)+strength(h.rank))/2,
      form: 0.6*((a.l10+h.l10)/20)+0.4*Math.min(1,Math.max(Math.abs(a.streak),Math.abs(h.streak))/7),
      rivalry: rivalry[rivKey(aw,hm)]||0,
      playoff: 0, pitcher:(aceness(aERA)+aceness(hERA))/2,
    };
    parts.playoff=(playoffRel(a.rank)+playoffRel(h.rank))/2;
    if(Math.abs(a.rank-h.rank)<=1&&a.rank>=3&&a.rank<=8&&h.rank>=3&&h.rank<=8)parts.playoff=1;
    const raw=Object.entries(W).reduce((s,[k,w])=>s+w*parts[k],0);
    const contrib=Object.fromEntries(Object.entries(W).map(([k,w])=>[k,w*parts[k]]));
    const frags=reasonFragments(aw,hm,a,h,parts,{aPit,hPit,aERA,hERA});
    return {game:`${aw} vs ${hm}`, 꿀잼지수:calibrate(raw), 한줄이유:buildReason(parts,contrib,frags)};
  }).sort((x,y)=>y.꿀잼지수-x.꿀잼지수);

  console.log('=== 꿀잼지수 + 한 줄 이유 — 오늘 (실데이터) ===\n');
  games.forEach((g,i)=>console.log(`${i===0?'⭐':'  '} [${String(g.꿀잼지수).padStart(2)}점] ${g.game.padEnd(12)} — ${g.한줄이유}`));
}
main().catch(e=>console.error('ERR',e.message));
