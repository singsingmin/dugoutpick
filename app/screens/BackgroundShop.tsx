// 라커룸 배경 — 꿀잼지수 스킨(SkinSelect)과 동일한 갤러리형: 현재적용 바 + 썸네일 그리드 + 탭 즉시적용.
// 보유 배경/기본은 탭하면 바로 장착(토스트), 미보유 구매형은 구매 모달, 명예 배경은 보유 시에만 노출.
// 장착은 equip_background RPC(0012)로 — 리그 미참여 유저도 확실히 저장됨.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Image, ScrollView, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/Auth';
import { useTeamTheme } from '../context/TeamTheme';
import { useScoreSkin } from '../context/ScoreSkin';
import { useOnline } from '../hooks/useOnline';
import {
  fetchOwnedBackgrounds, equipBackground, rpcPurchaseBackground, type OwnedBackground,
} from '../services/cosmetics';
import { fetchPredictionStats } from '../services/predictions';
import { LOCKER_BACKGROUNDS, backgroundInstanceLabel, findBackground, type LockerBackground } from '../utils/lockerBackgroundConfig';
import { isLimited, liveLimited, upcomingPreview, openMD, lastSaleMD, upcomingNotice } from '../utils/saleWindow';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import Loading from '../components/Loading';
import AppIcon from '../components/AppIcon';
import { border, colors, spacing } from '../theme';

const DEFAULT_BG = require('../assets/stadium-bg.webp');
// 디버그 빌드에선 RPC 원문 에러를 토스트에 노출(진단용). production은 친화 메시지.
const SHOW_RAW_ERR = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_TOOLS === '1';

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = spacing.sm;
const COLS = SCREEN_W >= 600 ? 3 : 2;
const CELL_W = Math.floor((SCREEN_W - spacing.md * 2 - GRID_GAP * (COLS - 1)) / COLS);
const THUMB_H = Math.round(CELL_W * 0.66);

const CREAM = 'rgba(250,245,235,0.92)';
const CREAM_SELECTED = 'rgba(255,252,244,0.97)';
const CREAM_BORDER = 'rgba(150,120,80,0.32)';

// 표시 셀: 기본(default) + 구매형 카탈로그 + 보유 명예 인스턴스(period_label별).
type Cell = {
  key: string;
  isDefault: boolean;
  ownedId: number | null;      // 장착 대상 인스턴스 id (기본=null, 미보유 구매형=null)
  backgroundId: string | null; // 이미지/구매 식별
  label: string;
  image: number;
  price?: number;
  owned: boolean;
  honor: boolean;
};
type ModalState =
  | { kind: 'confirm' | 'insufficient'; bg: LockerBackground }
  | { kind: 'done'; bg: LockerBackground; ownedId: number | null }
  | null;

function BaseballAmount({ n, size = 16, color = colors.text }: { n: number; size?: number; color?: string }) {
  return (
    <View style={styles.amountRow}>
      <AppIcon name="baseball" size={size} />
      <PixelText variant="caption" color={color}>{n}</PixelText>
    </View>
  );
}

export default function BackgroundShop() {
  const navigation = useNavigation();
  const { userId } = useAuth();
  const { accent } = useTeamTheme();
  const { baseballBalance, refreshAccount } = useScoreSkin();
  const online = useOnline();
  const [owned, setOwned] = useState<OwnedBackground[]>([]);
  const [equipped, setEquipped] = useState<number | null>(null);   // 장착된 소유 인스턴스 id
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback(() => {
    Promise.all([fetchOwnedBackgrounds(), fetchPredictionStats()])
      .then(([bgs, s]) => { setOwned(bgs); setEquipped(s?.equippedOwnedBackgroundId ?? null); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const catalogById = (id: string) => LOCKER_BACKGROUNDS.find((b) => b.id === id);
  const purchaseInstance = (id: string) => owned.find((o) => o.backgroundId === id && o.periodType == null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  // 그리드: 기본 + 상시 구매형 + 보유 한정 + 보유 명예 인스턴스.
  //   한정(윈도우 있는) 미보유 상품은 그리드에서 빼고, 아래 "지금 볼 만한 한정 1개" 카드로만 노출.
  const now = Date.now();
  const currencyCells: Cell[] = LOCKER_BACKGROUNDS
    .filter((bg) => bg.unlockType === 'currency')
    .filter((bg) => !!purchaseInstance(bg.id) || !isLimited(bg))   // 상시 or 보유 한정만 그리드
    .slice().sort((a, b) => a.sortOrder - b.sortOrder)
    .map((bg): Cell => {
      const inst = purchaseInstance(bg.id);
      return {
        key: bg.id, isDefault: false, ownedId: inst?.ownedBackgroundId ?? null,
        backgroundId: bg.id, label: bg.label, image: bg.backgroundImage,
        price: bg.price, owned: !!inst, honor: false,
      };
    });

  // 한정 배경(미보유): 판매중 전부 + 예고 1개를 카드로 노출(그리드엔 상시·보유만).
  const limitedCandidates = LOCKER_BACKGROUNDS.filter(
    (bg) => bg.unlockType === 'currency' && isLimited(bg) && !purchaseInstance(bg.id),
  );
  const liveBgs = liveLimited(limitedCandidates, now);
  const previewBg = upcomingPreview(limitedCandidates, now);
  const honorCells: Cell[] = owned
    .filter((o) => catalogById(o.backgroundId) && catalogById(o.backgroundId)!.unlockType !== 'currency')
    .slice().sort((a, b) => (b.periodLabel ?? '').localeCompare(a.periodLabel ?? ''))
    .map((o): Cell => ({
      key: `${o.backgroundId}#${o.ownedBackgroundId}`, isDefault: false,
      ownedId: o.ownedBackgroundId, backgroundId: o.backgroundId,
      label: backgroundInstanceLabel(o.backgroundId, o.periodType, o.periodLabel),
      image: catalogById(o.backgroundId)!.backgroundImage, owned: true, honor: true,
    }));
  const cells: Cell[] = [
    { key: 'default', isDefault: true, ownedId: null, backgroundId: null, label: '기본', image: DEFAULT_BG, owned: true, honor: false },
    ...currencyCells,
    ...honorCells,
  ];

  const isSelected = (c: Cell) => (c.isDefault ? equipped == null : (c.ownedId != null && c.ownedId === equipped));

  const equippedInst = equipped == null ? null : (owned.find((o) => o.ownedBackgroundId === equipped) ?? null);
  const currentLabel = equippedInst
    ? backgroundInstanceLabel(equippedInst.backgroundId, equippedInst.periodType, equippedInst.periodLabel)
    : '기본';
  const currentImage = equippedInst
    ? (findBackground(equippedInst.backgroundId)?.backgroundImage ?? DEFAULT_BG)
    : DEFAULT_BG;

  const applyBackground = async (ownedId: number | null, label: string) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await equipBackground(ownedId);
      setEquipped(ownedId);
      showToast(`${label} 적용됨`);
    } catch (e) {
      showToast(SHOW_RAW_ERR ? `적용 오류: ${(e as Error).message}` : '적용 중 오류가 났어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  // 미보유 구매형 → 교환 모달(그리드=상시만, 카드=한정 판매중).
  const openPurchase = (bg: LockerBackground) => {
    if (!online) { showToast('교환은 인터넷 연결 후 가능해요'); return; }
    setModal({ kind: (bg.price ?? 0) <= baseballBalance ? 'confirm' : 'insufficient', bg });
  };

  const handlePress = (c: Cell) => {
    if (c.owned) { void applyBackground(c.ownedId, c.label); return; }   // 기본·보유 → 즉시 적용
    const bg = c.backgroundId ? catalogById(c.backgroundId) : undefined;
    if (bg) openPurchase(bg);   // 그리드 미보유는 상시 상품만(한정은 카드)
  };

  const confirmBuy = async () => {
    if (modal?.kind !== 'confirm') return;
    const bg = modal.bg;
    setBusy(true);
    try {
      const res = await rpcPurchaseBackground(bg.id);
      await refreshAccount();
      if (res.success) {
        const newId = res.ownedBackgroundId ?? null;
        if (newId != null) {
          setOwned((o) => [...o, {
            ownedBackgroundId: newId, backgroundId: bg.id, acquiredVia: 'purchase',
            acquiredAt: new Date().toISOString(), periodType: null, periodLabel: null, displayName: null,
          }]);
        }
        setModal({ kind: 'done', bg, ownedId: newId });
      } else if (res.reason === 'not_available') {
        setModal(null);
        showToast('지금은 교환할 수 없는 기간이에요');
      } else {
        setModal({ kind: 'insufficient', bg });
      }
    } catch (e) {
      setModal(null);
      showToast(SHOW_RAW_ERR ? `교환 오류: ${(e as Error).message}` : '교환 처리 중 오류가 났어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const applyFromModal = async () => {
    if (modal?.kind !== 'done') return;
    const { bg, ownedId } = modal;
    setModal(null);
    if (ownedId != null) await applyBackground(ownedId, bg.label);
    else load();   // 인스턴스 id를 못 받았으면 목록만 새로고침
  };

  return (
    <View style={styles.root}>
      <Image source={DEFAULT_BG} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="라커룸 배경" leftIcon="back" onLeftPress={() => navigation.goBack()} />

        {/* 현재 적용 바 + 야구공 잔액 */}
        <View style={styles.currentBar}>
          <Image source={currentImage} style={styles.currentThumb} resizeMode="cover" />
          <View style={styles.currentText}>
            <PixelText variant="caption" color={colors.textDim}>현재 적용</PixelText>
            <PixelText variant="body" color={colors.text}>{currentLabel}</PixelText>
          </View>
          <Pressable style={styles.balancePill} onPress={() => navigation.navigate('BaseballCenter' as never)}>
            <BaseballAmount n={baseballBalance} size={18} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* 판매중 한정 배경 — 겹치면 전부(마감 임박 순), 각 카드에 교환하기 */}
          {liveBgs.map((bg) => (
            <View key={bg.id} style={styles.featuredCard}>
              <Image source={bg.backgroundImage} style={styles.featuredThumb} resizeMode="cover" />
              <View style={styles.featuredInfo}>
                <PixelText variant="caption" color={accent}>이번 한정 배경</PixelText>
                <PixelText variant="body" color={colors.text} numberOfLines={1}>{bg.fullName ?? bg.label}</PixelText>
                <View style={styles.featuredMeta}>
                  <PixelText variant="caption" color={colors.textDim}>{lastSaleMD(bg.availableUntil!)}까지 · </PixelText>
                  <BaseballAmount n={bg.price ?? 0} size={13} color={colors.textDim} />
                </View>
              </View>
              <Pressable style={[styles.featuredBtn, { backgroundColor: accent }]} onPress={() => openPurchase(bg)} disabled={busy}>
                <PixelText variant="caption" color="#fff">교환하기</PixelText>
              </Pressable>
            </View>
          ))}
          {/* 다음 한정 예고 — 항상 1개(가장 가까운 다음 오픈) */}
          {previewBg && (
            <Pressable
              style={styles.featuredCard}
              disabled={busy}
              onPress={previewBg.availableFrom ? () => showToast(upcomingNotice(previewBg.availableFrom!)) : undefined}
            >
              <Image source={previewBg.backgroundImage} style={styles.featuredThumb} resizeMode="cover" />
              <View style={styles.featuredInfo}>
                <PixelText variant="caption" color={accent}>다음 한정 예고</PixelText>
                <PixelText variant="body" color={colors.text} numberOfLines={1}>{previewBg.fullName ?? previewBg.label}</PixelText>
                <View style={styles.featuredMeta}>
                  <PixelText variant="caption" color={colors.textDim}>{openMD(previewBg.availableFrom!)} 오픈 · </PixelText>
                  <BaseballAmount n={previewBg.price ?? 0} size={13} color={colors.textDim} />
                </View>
              </View>
              <View style={styles.featuredSoon}>
                <PixelText variant="caption" color="#fff">오픈 예정</PixelText>
              </View>
            </Pressable>
          )}
          {!loaded ? (
            <Loading />
          ) : (
            <View style={styles.grid}>
              {cells.map((c) => {
                const selected = isSelected(c);
                const showPrice = !c.owned;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => handlePress(c)}
                    disabled={busy}
                    style={[
                      styles.cell,
                      { width: CELL_W },
                      selected
                        ? { borderColor: accent, borderWidth: 2, backgroundColor: CREAM_SELECTED }
                        : { borderColor: CREAM_BORDER, borderWidth: 1 },
                    ]}
                  >
                    <View style={styles.thumbBox}>
                      <Image source={c.image} style={[styles.thumb, showPrice && styles.thumbLocked]} resizeMode="cover" />
                      {selected && (
                        <View style={[styles.check, { backgroundColor: accent }]}>
                          <PixelText variant="caption" color="#fff" style={styles.checkMark}>✓</PixelText>
                        </View>
                      )}
                      {showPrice && (
                        <View style={styles.priceBadge}>
                          <BaseballAmount n={c.price ?? 0} size={9} color="#fff" />
                        </View>
                      )}
                    </View>
                    <PixelText variant="caption" color={colors.text} style={styles.cellLabel} numberOfLines={1}>{c.label}</PixelText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 구매/완료/부족 모달 */}
      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {modal && (
              <>
                <Image source={modal.bg.backgroundImage} style={styles.modalThumb} resizeMode="cover" />
                <PixelText variant="title" color={colors.text}>{modal.bg.label}</PixelText>

                {modal.kind === 'confirm' && (
                  <>
                    <View style={styles.modalLine}>
                      <BaseballAmount n={modal.bg.price ?? 0} size={18} />
                      <PixelText variant="body" color={colors.text}>야구공으로 교환할까요?</PixelText>
                    </View>
                    <View style={styles.modalLine}>
                      <PixelText variant="caption" color={colors.textDim}>현재 보유</PixelText>
                      <BaseballAmount n={baseballBalance} size={14} color={colors.textDim} />
                    </View>
                    <View style={styles.modalBtnRow}>
                      <Pressable style={[styles.modalBtn, { backgroundColor: accent }]} onPress={confirmBuy} disabled={busy}>
                        <PixelText variant="body" color="#fff">교환하기</PixelText>
                      </Pressable>
                      <Pressable style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setModal(null)}>
                        <PixelText variant="body" color={colors.text}>취소</PixelText>
                      </Pressable>
                    </View>
                  </>
                )}

                {modal.kind === 'done' && (
                  <>
                    <PixelText variant="body" color={colors.good} style={styles.modalMsg}>교환 완료! 바로 적용할까요?</PixelText>
                    <View style={styles.modalBtnRow}>
                      <Pressable style={[styles.modalBtn, { backgroundColor: accent }]} onPress={applyFromModal}>
                        <PixelText variant="body" color="#fff">적용하기</PixelText>
                      </Pressable>
                      <Pressable style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setModal(null)}>
                        <PixelText variant="body" color={colors.text}>닫기</PixelText>
                      </Pressable>
                    </View>
                  </>
                )}

                {modal.kind === 'insufficient' && (
                  <>
                    <PixelText variant="body" color={colors.bad} style={styles.modalMsg}>야구공이 부족해요.</PixelText>
                    <PixelText variant="caption" color={colors.textDim} style={styles.modalSub}>출석하거나 예측에 참여해 야구공을 모아보세요.</PixelText>
                    <Pressable style={[styles.modalBtn, { backgroundColor: accent }]} onPress={() => setModal(null)}>
                      <PixelText variant="body" color="#fff">확인</PixelText>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 적용 토스트 */}
      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <PixelText variant="caption" color="#fff">{toast}</PixelText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  currentBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    height: 68, marginTop: spacing.md, marginHorizontal: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: CREAM, borderRadius: border.radius, borderWidth: 1, borderColor: CREAM_BORDER,
  },
  currentThumb: { width: 64, height: 44, borderRadius: 6, borderWidth: 1, borderColor: CREAM_BORDER },
  currentText: { gap: 2 },
  balancePill: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gold, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },

  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: {
    alignItems: 'center', backgroundColor: CREAM, borderRadius: border.radius,
    padding: spacing.xs, gap: spacing.xs,
  },
  thumbBox: { width: '100%', height: THUMB_H, borderRadius: 6, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbLocked: { opacity: 0.72 },
  check: {
    position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 9, lineHeight: 11 },
  priceBadge: {
    position: 'absolute', top: 4, right: 4, backgroundColor: '#4A3826',
    borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1,
  },
  cellLabel: { maxWidth: '100%' },

  // "지금 볼 만한 한정 1개" 카드
  featuredCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: CREAM, borderRadius: border.radius, borderWidth: 1, borderColor: CREAM_BORDER,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  featuredThumb: { width: 72, height: 50, borderRadius: 6, borderWidth: 1, borderColor: CREAM_BORDER },
  featuredInfo: { flex: 1, gap: 2 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center' },
  featuredBtn: {
    borderRadius: border.radius, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center',
  },
  featuredSoon: {
    backgroundColor: '#5A6B7A', borderRadius: 999,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    width: '100%', maxWidth: 320, backgroundColor: colors.surface,
    borderWidth: border.width, borderColor: colors.border, borderRadius: border.radius,
    padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
  },
  modalThumb: { width: 160, height: 96, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  modalLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalMsg: { marginTop: spacing.xs, textAlign: 'center' },
  modalSub: { textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: {
    borderRadius: border.radius, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: colors.surfaceAlt },

  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  toast: { backgroundColor: 'rgba(30,24,12,0.92)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999 },
});
