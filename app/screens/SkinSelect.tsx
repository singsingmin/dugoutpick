// 꿀잼지수 스킨 선택 — 썸네일 갤러리형. 카테고리 탭 + 그리드 + 현재적용 바 + 야구공 구매.
import { useState } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTeamTheme } from '../context/TeamTheme';
import { useScoreSkin } from '../context/ScoreSkin';
import { useOnline } from '../hooks/useOnline';
import {
  SCORE_SKIN_LIST,
  getScoreSkinById,
  getSkinSectionKey,
  getSkinSectionTitle,
  resolveJerseyColor,
  resolveJerseyNumberMode,
  resolveUniformOverride,
  type ScoreSkin,
  type ScoreSkinCategory,
} from '../utils/scoreSkinConfig';
import Toast, { useToast } from '../components/Toast';
import JerseyScoreBadge from '../components/JerseyScoreBadge';
import ScoreboardScoreBadge, { type ScoreboardVariant } from '../components/ScoreboardScoreBadge';
import ImageFrameScoreBadge from '../components/ImageFrameScoreBadge';
import { getImageFrameConfig } from '../utils/assetFrameConfig';
import { isLimited, liveLimited, upcomingPreview, openMD, lastSaleMD, upcomingNotice } from '../utils/saleWindow';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import AppIcon from '../components/AppIcon';
import { border, colors, spacing } from '../theme';

const PREVIEW_SCORE = 75;
// 디버그 빌드에선 RPC 원문 에러를 토스트에 노출(진단용). production은 친화 메시지.
const SHOW_RAW_ERR = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_TOOLS === '1';

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = spacing.xs;
const COLS = SCREEN_W >= 600 ? 6 : SCREEN_W >= 430 ? 5 : 4;
const CELL_W = Math.floor((SCREEN_W - spacing.md * 2 - GRID_GAP * (COLS - 1)) / COLS);
const CELL_ASPECT = 1.23;                                   // 카드 width:height (styles.cell와 동일)
const THUMB_W = Math.round(CELL_W * 0.86);                  // 썸네일 = 카드 폭 86%
const THUMB_H = Math.round((CELL_W / CELL_ASPECT) * 0.92);  // 카드 높이의 92% — 세로 큰 스킨(메달) 잘림 방지

const CREAM = 'rgba(250,245,235,0.92)';
const CREAM_SELECTED = 'rgba(255,252,244,0.97)';
const CREAM_BORDER = 'rgba(150,120,80,0.32)';

type TabKey = 'all' | ScoreSkinCategory;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'uniform', label: '유니폼' },
  { key: 'stadium', label: '야구장' },
  { key: 'special', label: '스페셜' },
];

type Section = { key: string; title: string; items: ScoreSkin[] };
function buildSections(tab: TabKey, isOwned: (id: string) => boolean): Section[] {
  const sections: Section[] = [];
  const byKey = new Map<string, Section>();
  for (const s of SCORE_SKIN_LIST) {
    if (!(tab === 'all' || s.category === tab)) continue;
    // 한정 스킨 미보유는 그리드에서 제외(아래 "지금 볼 만한 한정 1개" 카드로만 노출). 보유 시엔 그리드 유지.
    if (isLimited(s) && !isOwned(s.id)) continue;
    const key = getSkinSectionKey(s);
    let sec = byKey.get(key);
    if (!sec) {
      sec = { key, title: getSkinSectionTitle(key), items: [] };
      byKey.set(key, sec);
      sections.push(sec);
    }
    sec.items.push(s);
  }
  return sections;
}

// 야구공 잔액/가격 표시 — 아이콘 + 숫자.
function BaseballAmount({ n, size = 16, color = colors.text }: { n: number; size?: number; color?: string }) {
  return (
    <View style={styles.amountRow}>
      <AppIcon name="baseball" size={size} />
      <PixelText variant="caption" color={color}>{n}</PixelText>
    </View>
  );
}

function SkinThumb({ skin, teamColor, targetW, maxH }: { skin: ScoreSkin; teamColor: string; targetW: number; maxH?: number }) {
  const isAsset = skin.kind === 'asset';
  const assetKey = skin.kind === 'asset' ? skin.assetKey : '';
  const frameCfg = skin.kind === 'asset' && skin.renderType === 'imageFrame' ? getImageFrameConfig(skin.assetKey) : undefined;
  const nW = frameCfg ? frameCfg.widths.hero : isAsset ? 128 : 88;
  const nH = frameCfg ? Math.round(frameCfg.widths.hero / frameCfg.aspect) : isAsset ? 96 : 85;
  // 폭·높이 둘 다 맞추는 contain 스케일 — 세로 큰 스킨(메달)이 카드 높이를 넘어 잘리지 않게.
  const scale = maxH ? Math.min(targetW / nW, maxH / nH) : targetW / nW;
  return (
    <View style={{ width: targetW, height: Math.round(nH * scale), alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ scale }] }}>
        {frameCfg ? (
          <ImageFrameScoreBadge score={PREVIEW_SCORE} variant="hero" assetKey={assetKey} />
        ) : isAsset ? (
          <ScoreboardScoreBadge score={PREVIEW_SCORE} variant={'hero' as ScoreboardVariant} teamColor={teamColor} />
        ) : (
          <JerseyScoreBadge
            score={PREVIEW_SCORE}
            variant="hero"
            teamColor={resolveJerseyColor(skin, teamColor)}
            uniformPreset={skin.styleId}
            showLabel={false}
            numberMode={resolveJerseyNumberMode(skin)}
            colorOverride={resolveUniformOverride(skin)}
          />
        )}
      </View>
    </View>
  );
}

type ModalState = { kind: 'confirm' | 'done' | 'insufficient'; skin: ScoreSkin } | null;

export default function SkinSelect() {
  const navigation = useNavigation();
  const { accent } = useTeamTheme();
  const { skinId, setSkin, baseballBalance, isOwned, buySkin } = useScoreSkin();
  const online = useOnline();
  const [tab, setTab] = useState<TabKey>('all');
  const { message: toast, showToast } = useToast();
  const [modal, setModal] = useState<ModalState>(null);

  const selectedConfig = getScoreSkinById(skinId);
  const now = Date.now();
  const sections = buildSections(tab, isOwned);

  // 한정 스킨(미보유): 판매중 전부 + 예고 1개를 카드로 노출(그리드엔 상시·보유만).
  const limitedSkins = SCORE_SKIN_LIST.filter(
    (s) => s.kind === 'asset' && isLimited(s) && s.unlockType === 'currency' && !isOwned(s.id),
  );
  const liveSkins = liveLimited(limitedSkins, now);
  const previewSkin = upcomingPreview(limitedSkins, now);


  const applySkin = async (s: ScoreSkin) => {
    await setSkin(s.id);
    showToast(`${s.label} 적용됨`);
  };

  // 미보유 currency 스킨 → 교환 모달(그리드=상시만, 카드=한정 판매중).
  const openSkinPurchase = (s: ScoreSkin) => {
    if (!online) { showToast('교환은 인터넷 연결 후 가능해요'); return; }  // 교환=민감 쓰기, 온라인 필요
    setModal({ kind: baseballBalance >= (s.price ?? 0) ? 'confirm' : 'insufficient', skin: s });
  };

  const handleCardPress = (s: ScoreSkin) => {
    if (isOwned(s.id)) { void applySkin(s); return; }  // 적용은 오프라인 허용(낙관적)
    if (s.unlockType === 'currency') openSkinPurchase(s);   // 그리드 미보유는 상시 상품만(한정은 카드)
    // event/premium: MVP에선 해당 스킨 없음 — 무동작
  };

  const confirmBuy = async () => {
    if (modal?.kind !== 'confirm') return;
    const s = modal.skin;
    try {
      const outcome = await buySkin(s.id);
      setModal(outcome === 'ok' ? { kind: 'done', skin: s } : { kind: 'insufficient', skin: s });
    } catch (e) {
      // 인증/세션/네트워크 오류 — "부족"으로 오인시키지 않고 실제 오류 안내(디버그 빌드는 원문).
      setModal(null);
      showToast(SHOW_RAW_ERR ? `교환 오류: ${(e as Error).message}` : '교환 처리 중 오류가 났어요. 다시 시도해 주세요.');
    }
  };

  const applyFromModal = async () => {
    if (!modal) return;
    await applySkin(modal.skin);
    setModal(null);
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="꿀잼지수 스킨" leftIcon="back" onLeftPress={() => navigation.goBack()} />

        {/* 현재 적용 바 + 야구공 잔액 */}
        <View style={styles.currentBar}>
          <View style={styles.currentThumb}>
            <SkinThumb skin={selectedConfig} teamColor={accent} targetW={52} />
          </View>
          <View style={styles.currentText}>
            <PixelText variant="caption" color={colors.textDim}>현재 적용</PixelText>
            <PixelText variant="body" color={colors.text}>{selectedConfig.label}</PixelText>
          </View>
          <Pressable
            style={styles.balancePill}
            onPress={() => navigation.navigate('BaseballCenter')}
            accessibilityRole="button"
            accessibilityLabel="야구공 센터 열기"
          >
            <BaseballAmount n={baseballBalance} size={18} />
          </Pressable>
        </View>

        {/* 카테고리 탭 */}
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, on ? { backgroundColor: accent, borderColor: accent } : null]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <PixelText variant="caption" color={on ? '#fff' : colors.text}>{t.label}</PixelText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* 판매중 한정 스킨 — 겹치면 전부(마감 임박 순), 각 카드에 교환하기 */}
          {liveSkins.map((s) => (
            <View key={s.id} style={styles.featuredCard}>
              <View style={styles.featuredThumb}>
                <SkinThumb skin={s} teamColor={accent} targetW={56} maxH={46} />
              </View>
              <View style={styles.featuredInfo}>
                <PixelText variant="caption" color={accent}>이번 한정 스킨</PixelText>
                <PixelText variant="body" color={colors.text} numberOfLines={1}>{s.fullName ?? s.label}</PixelText>
                <View style={styles.featuredMeta}>
                  <PixelText variant="caption" color={colors.textDim}>{lastSaleMD(s.availableUntil!)}까지 · </PixelText>
                  <BaseballAmount n={s.price ?? 0} size={13} color={colors.textDim} />
                </View>
              </View>
              <Pressable style={[styles.featuredBtn, { backgroundColor: accent }]} onPress={() => openSkinPurchase(s)}
                accessibilityRole="button" accessibilityLabel={`${s.fullName ?? s.label} 교환하기, ${s.price ?? 0}야구공`}>
                <PixelText variant="caption" color="#fff">교환하기</PixelText>
              </Pressable>
            </View>
          ))}
          {/* 다음 한정 예고 — 항상 1개(가장 가까운 다음 오픈) */}
          {previewSkin && (
            <Pressable
              style={styles.featuredCard}
              onPress={previewSkin.availableFrom ? () => showToast(upcomingNotice(previewSkin.availableFrom!)) : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${previewSkin.fullName ?? previewSkin.label} 오픈 예정`}
            >
              <View style={styles.featuredThumb}>
                <SkinThumb skin={previewSkin} teamColor={accent} targetW={56} maxH={46} />
              </View>
              <View style={styles.featuredInfo}>
                <PixelText variant="caption" color={accent}>다음 한정 예고</PixelText>
                <PixelText variant="body" color={colors.text} numberOfLines={1}>{previewSkin.fullName ?? previewSkin.label}</PixelText>
                <View style={styles.featuredMeta}>
                  <PixelText variant="caption" color={colors.textDim}>{openMD(previewSkin.availableFrom!)} 오픈 · </PixelText>
                  <BaseballAmount n={previewSkin.price ?? 0} size={13} color={colors.textDim} />
                </View>
              </View>
              <View style={styles.featuredSoon}>
                <PixelText variant="caption" color="#fff">오픈 예정</PixelText>
              </View>
            </Pressable>
          )}
          {sections.length === 0 && liveSkins.length === 0 && !previewSkin ? (
            <View style={styles.empty}>
              <PixelText variant="body" color={colors.textDim}>준비 중인 스킨이에요</PixelText>
            </View>
          ) : (
            sections.map((sec) => (
              <View key={sec.key} style={styles.section}>
                <PixelText variant="caption" color={colors.textDim} style={styles.sectionTitle}>
                  {sec.title}
                </PixelText>
                <View style={styles.grid}>
                  {sec.items.map((s) => {
                    const selected = s.id === skinId;
                    const owned = isOwned(s.id);
                    const showPrice = !owned && s.unlockType === 'currency';
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => handleCardPress(s)}
                        accessibilityRole="button"
                        accessibilityLabel={showPrice ? `${s.label} 교환 ${s.price} 야구공` : s.label}
                        accessibilityState={{ selected }}
                        style={[
                          styles.cell,
                          { width: CELL_W },
                          selected
                            ? { borderColor: accent, borderWidth: 2, backgroundColor: CREAM_SELECTED }
                            : { borderColor: CREAM_BORDER, borderWidth: 1 },
                        ]}
                      >
                        {selected && (
                          <View style={[styles.selectedTint, { backgroundColor: accent }]} pointerEvents="none" />
                        )}
                        <View style={[styles.thumbBox, showPrice && styles.thumbLocked]}>
                          <SkinThumb skin={s} teamColor={accent} targetW={THUMB_W} maxH={THUMB_H} />
                        </View>
                        {selected && (
                          <View style={[styles.check, { backgroundColor: accent }]}>
                            <PixelText variant="caption" color="#fff" style={styles.checkMark}>✓</PixelText>
                          </View>
                        )}
                        {showPrice && (
                          <View style={styles.priceBadge}>
                            <BaseballAmount n={s.price ?? 0} size={9} color="#fff" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 구매/완료/부족 모달 */}
      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {modal && (
              <>
                <View style={styles.modalThumb}>
                  <SkinThumb skin={modal.skin} teamColor={accent} targetW={72} />
                </View>
                <PixelText variant="title" color={colors.text}>{modal.skin.label}</PixelText>

                {modal.kind === 'confirm' && (
                  <>
                    <View style={styles.modalLine}>
                      <BaseballAmount n={modal.skin.price ?? 0} size={18} />
                      <PixelText variant="body" color={colors.text}>야구공으로 교환할까요?</PixelText>
                    </View>
                    <View style={styles.modalLine}>
                      <PixelText variant="caption" color={colors.textDim}>현재 보유</PixelText>
                      <BaseballAmount n={baseballBalance} size={14} color={colors.textDim} />
                    </View>
                    <View style={styles.modalBtnRow}>
                      <Pressable style={[styles.modalBtn, { backgroundColor: accent, borderColor: colors.border }]} onPress={confirmBuy}>
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
                      <Pressable style={[styles.modalBtn, { backgroundColor: accent, borderColor: colors.border }]} onPress={applyFromModal}>
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
                    <PixelText variant="caption" color={colors.textDim} style={styles.modalSub}>출석하거나 광고를 보고 야구공을 모아보세요.</PixelText>
                    <View style={styles.modalBtnRow}>
                      <Pressable style={[styles.modalBtn, { backgroundColor: accent, borderColor: colors.border }]} onPress={() => setModal(null)}>
                        <PixelText variant="body" color="#fff">확인</PixelText>
                      </Pressable>
                    </View>
                  </>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Toast message={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(243,233,206,0.35)',
  },
  safe: { flex: 1, backgroundColor: 'transparent' },

  currentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 68,
    marginTop: spacing.md + 8,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: CREAM,
    borderRadius: border.radius,
    borderWidth: 1,
    borderColor: CREAM_BORDER,
  },
  currentThumb: { width: 54, alignItems: 'center', justifyContent: 'center' },
  currentText: { gap: 2 },
  balancePill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  tab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CREAM_BORDER,
    backgroundColor: CREAM,
  },

  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  section: { marginBottom: spacing.md },
  sectionTitle: { marginLeft: 2, marginBottom: spacing.xs, opacity: 0.85, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: {
    aspectRatio: 1.23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM,
    borderRadius: border.radius,
    overflow: 'hidden',
  },
  selectedTint: { ...StyleSheet.absoluteFillObject, opacity: 0.08 },
  thumbBox: { alignItems: 'center', justifyContent: 'center' },
  thumbLocked: { opacity: 0.72 },   // 미보유는 살짝만 흐리게(스킨 매력 유지)
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 9, lineHeight: 11 },
  priceBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#4A3826',   // 앱 톤 진한 브라운
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  // "지금 볼 만한 한정 1개" 카드
  featuredCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: CREAM, borderRadius: border.radius, borderWidth: 1, borderColor: CREAM_BORDER,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  featuredThumb: { width: 56, alignItems: 'center', justifyContent: 'center' },
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

  empty: { alignItems: 'center', paddingVertical: spacing.xl },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    width: '100%', maxWidth: 320,
    backgroundColor: colors.surface,
    borderWidth: border.width, borderColor: colors.border, borderRadius: border.radius,
    padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
  },
  modalThumb: { marginBottom: spacing.xs },
  modalLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalMsg: { marginTop: spacing.xs, textAlign: 'center' },
  modalSub: { textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: {
    borderRadius: border.radius, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: colors.surfaceAlt },

});
