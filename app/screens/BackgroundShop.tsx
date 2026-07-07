// 라커룸 배경 구매/보유/장착 (Phase 4 Stage 6). 설계: docs/stage6-cosmetics-design.md §6-2.
// 실제 이미지 에셋은 아직 없어 카드 미리보기는 단색(previewColor) — lockerBackgroundConfig.ts 참고.
import { useCallback, useState } from 'react';
import { View, Image, ScrollView, Pressable, Modal, StyleSheet } from 'react-native';
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
import Panel from '../components/Panel';
import AppIcon from '../components/AppIcon';
import ScreenHeader from '../components/ScreenHeader';
import { border, colors, spacing } from '../theme';

type ModalState = { kind: 'confirm' | 'done' | 'insufficient' | 'not_purchasable'; bg: LockerBackground } | null;

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

  const load = useCallback(() => {
    Promise.all([fetchOwnedBackgrounds(), fetchPredictionStats()])
      .then(([bgs, s]) => { setOwned(bgs); setEquipped(s?.equippedBackground ?? null); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isOwned = (id: string) => owned.some((o) => o.backgroundId === id);

  const handlePress = (bg: LockerBackground) => {
    if (isOwned(bg.id)) { void toggleEquip(bg.id); return; }
    if (bg.unlockType !== 'currency') { setModal({ kind: 'not_purchasable', bg }); return; }
    if (!online) return;
    setModal({ kind: (bg.price ?? 0) <= baseballBalance ? 'confirm' : 'insufficient', bg });
  };

  const toggleEquip = async (id: string) => {
    if (!userId || busy) return;
    const next = equipped === id ? null : id;
    setBusy(true);
    try {
      await equipBackground(userId, next);
      setEquipped(next);
    } catch {
      // 조용히 무시 — 다음 진입 때 실제 상태로 갱신
    } finally {
      setBusy(false);
    }
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="라커룸 배경" leftIcon="back" onLeftPress={() => navigation.goBack()} />

        <View style={styles.balanceBar}>
          <AppIcon name="baseball" size={18} />
          <PixelText variant="body" color={colors.text}>{baseballBalance}</PixelText>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {!loaded ? (
            <PixelText variant="caption" color={colors.textDim}>불러오는 중...</PixelText>
          ) : (
            LOCKER_BACKGROUNDS.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((bg) => {
              const own = isOwned(bg.id);
              const isEquipped = equipped === bg.id;
              const honor = bg.unlockType !== 'currency';
              if (honor && !own) return null; // 명예 배경은 보유 시에만 노출
              return (
                <Panel key={bg.id} style={[styles.card, isEquipped && { borderColor: accent }]}>
                  <View style={[styles.swatch, { backgroundColor: bg.previewColor }]} />
                  <View style={styles.cardText}>
                    <PixelText variant="body" color={colors.text}>{bg.label}</PixelText>
                    <PixelText variant="caption" color={colors.textDim}>{bg.description}</PixelText>
                  </View>
                  <Pressable style={styles.actionBtn} disabled={busy} onPress={() => handlePress(bg)}>
                    {own ? (
                      <PixelText variant="caption" color={isEquipped ? colors.accent : colors.text}>
                        {isEquipped ? '장착중' : '장착'}
                      </PixelText>
                    ) : (
                      <View style={styles.priceRow}>
                        <AppIcon name="baseball" size={14} />
                        <PixelText variant="caption" color={colors.text}>{bg.price}</PixelText>
                      </View>
                    )}
                  </Pressable>
                </Panel>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {modal && (
              <>
                <PixelText variant="title" color={colors.text}>{modal.bg.label}</PixelText>
                {modal.kind === 'confirm' && (
                  <>
                    <PixelText variant="body" color={colors.text}>야구공 {modal.bg.price}개로 구매할까요?</PixelText>
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
                    <PixelText variant="body" color={colors.good}>구매 완료! 목록에서 장착해보세요</PixelText>
                    <Pressable style={[styles.modalBtn, { backgroundColor: accent }]} onPress={() => setModal(null)}>
                      <PixelText variant="body" color="#fff">확인</PixelText>
                    </Pressable>
                  </>
                )}
                {modal.kind === 'insufficient' && (
                  <>
                    <PixelText variant="body" color={colors.bad}>야구공이 부족해요</PixelText>
                    <Pressable style={[styles.modalBtn, { backgroundColor: accent }]} onPress={() => setModal(null)}>
                      <PixelText variant="body" color="#fff">확인</PixelText>
                    </Pressable>
                  </>
                )}
                {modal.kind === 'not_purchasable' && (
                  <>
                    <PixelText variant="body" color={colors.textDim}>월간/시즌 순위 보상으로만 얻을 수 있어요</PixelText>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  balanceBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', marginRight: spacing.md, marginTop: spacing.xs,
    backgroundColor: colors.gold, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  content: { padding: spacing.md, gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 44, height: 44, borderRadius: border.radius, borderWidth: 1, borderColor: colors.border },
  cardText: { flex: 1, gap: 2 },
  actionBtn: {
    borderRadius: border.radius, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surfaceAlt,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    width: '100%', maxWidth: 320, backgroundColor: colors.surface,
    borderWidth: border.width, borderColor: colors.border, borderRadius: border.radius,
    padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
  },
  modalBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: { borderRadius: border.radius, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: colors.surfaceAlt },
});
