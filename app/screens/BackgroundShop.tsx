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
import { LOCKER_BACKGROUNDS, type LockerBackground } from '../utils/lockerBackgroundConfig';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import AppIcon from '../components/AppIcon';
import { border, colors, spacing } from '../theme';

const DEFAULT_BG = require('../assets/stadium-bg.webp');

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = spacing.sm;
const COLS = SCREEN_W >= 600 ? 3 : 2;
const CELL_W = Math.floor((SCREEN_W - spacing.md * 2 - GRID_GAP * (COLS - 1)) / COLS);
const THUMB_H = Math.round(CELL_W * 0.66);

const CREAM = 'rgba(250,245,235,0.92)';
const CREAM_SELECTED = 'rgba(255,252,244,0.97)';
const CREAM_BORDER = 'rgba(150,120,80,0.32)';

// 표시 셀: 기본(default) + 배경들. id=null이 기본.
type Cell = { id: string | null; label: string; image: number; price?: number; owned: boolean; honor: boolean };
type ModalState = { kind: 'confirm' | 'done' | 'insufficient'; bg: LockerBackground } | null;

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
  const [equipped, setEquipped] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback(() => {
    Promise.all([fetchOwnedBackgrounds(), fetchPredictionStats()])
      .then(([bgs, s]) => { setOwned(bgs); setEquipped(s?.equippedBackground ?? null); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isOwned = (id: string) => owned.some((o) => o.backgroundId === id);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  // 표시 목록: 기본 카드 + 정렬된 배경(명예 배경은 보유 시에만).
  const cells: Cell[] = [
    { id: null, label: '기본', image: DEFAULT_BG, owned: true, honor: false },
    ...LOCKER_BACKGROUNDS.slice().sort((a, b) => a.sortOrder - b.sortOrder)
      .map((bg): Cell => ({
        id: bg.id, label: bg.label, image: bg.backgroundImage, price: bg.price,
        owned: isOwned(bg.id), honor: bg.unlockType !== 'currency',
      }))
      .filter((c) => !(c.honor && !c.owned)),
  ];

  const currentLabel = equipped === null ? '기본' : (cells.find((c) => c.id === equipped)?.label ?? '기본');
  const currentImage = equipped === null ? DEFAULT_BG : (cells.find((c) => c.id === equipped)?.image ?? DEFAULT_BG);

  const applyBackground = async (id: string | null, label: string) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await equipBackground(id);
      setEquipped(id);
      showToast(`${label} 적용됨`);
    } catch {
      showToast('적용 중 오류가 났어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handlePress = (c: Cell) => {
    if (c.owned) { void applyBackground(c.id, c.label); return; }   // 기본·보유 → 즉시 적용
    // 미보유 구매형만 여기 도달(명예 미보유는 목록에서 제외됨)
    const bg = LOCKER_BACKGROUNDS.find((b) => b.id === c.id);
    if (!bg) return;
    if (!online) { showToast('구매는 인터넷 연결 후 가능해요'); return; }
    setModal({ kind: (bg.price ?? 0) <= baseballBalance ? 'confirm' : 'insufficient', bg });
  };

  const confirmBuy = async () => {
    if (modal?.kind !== 'confirm') return;
    const bg = modal.bg;
    setBusy(true);
    try {
      const res = await rpcPurchaseBackground(bg.id);
      await refreshAccount();
      if (res.success) {
        setOwned((o) => [...o, { backgroundId: bg.id, acquiredVia: 'purchase', acquiredAt: new Date().toISOString() }]);
        setModal({ kind: 'done', bg });
      } else {
        setModal({ kind: 'insufficient', bg });
      }
    } catch {
      setModal(null);
      showToast('구매 처리 중 오류가 났어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const applyFromModal = async () => {
    if (modal?.kind !== 'done') return;
    const bg = modal.bg;
    setModal(null);
    await applyBackground(bg.id, bg.label);
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
          {!loaded ? (
            <PixelText variant="caption" color={colors.textDim}>불러오는 중...</PixelText>
          ) : (
            <View style={styles.grid}>
              {cells.map((c) => {
                const selected = equipped === c.id;
                const showPrice = !c.owned;
                return (
                  <Pressable
                    key={c.id ?? 'default'}
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
                      <PixelText variant="body" color={colors.text}>야구공으로 구매할까요?</PixelText>
                    </View>
                    <View style={styles.modalLine}>
                      <PixelText variant="caption" color={colors.textDim}>현재 보유</PixelText>
                      <BaseballAmount n={baseballBalance} size={14} color={colors.textDim} />
                    </View>
                    <View style={styles.modalBtnRow}>
                      <Pressable style={[styles.modalBtn, { backgroundColor: accent }]} onPress={confirmBuy} disabled={busy}>
                        <PixelText variant="body" color="#fff">구매하기</PixelText>
                      </Pressable>
                      <Pressable style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setModal(null)}>
                        <PixelText variant="body" color={colors.text}>취소</PixelText>
                      </Pressable>
                    </View>
                  </>
                )}

                {modal.kind === 'done' && (
                  <>
                    <PixelText variant="body" color={colors.good} style={styles.modalMsg}>구매 완료! 바로 적용할까요?</PixelText>
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
