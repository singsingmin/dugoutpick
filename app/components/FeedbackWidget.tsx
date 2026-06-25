import { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import Panel from './Panel';
import SectionLabel from './SectionLabel';
import {
  TAGS_UP, TAGS_DOWN,
  saveFeedback, sendToDiscord, hasFeedback,
  type FeedbackTag,
} from '../services/feedback';
import { colors, spacing, border } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

interface FeedbackWidgetProps {
  gameId: string;
  predictedScore: number;
  matchLabel: string;
}

type Step = 'idle' | 'thumbs_select' | 'tag_select' | 'submitting' | 'done';

export default function FeedbackWidget({ gameId, predictedScore, matchLabel }: FeedbackWidgetProps) {
  const { accent } = useTeamTheme();
  const [step, setStep] = useState<Step>('idle');
  const [thumbs, setThumbs] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    hasFeedback(gameId).then((has) => {
      setStep(has ? 'done' : 'thumbs_select');
    });
  }, [gameId]);

  function selectThumbs(t: 'up' | 'down') {
    setThumbs(t);
    setStep('tag_select');
  }

  async function handleTagSelect(tag: FeedbackTag) {
    if (step !== 'tag_select' || thumbs === null) return;
    setStep('submitting');
    const entry = {
      gameId,
      predictedScore,
      thumbs,
      reasonTag: tag.slug,
      reasonLabel: tag.label,
      ts: new Date().toISOString(),
    };
    await saveFeedback(entry);
    void sendToDiscord(entry, matchLabel); // fire-and-forget; sendToDiscord swallows errors internally
    setStep('done');
  }

  if (step === 'idle') return null;

  const tags = thumbs === 'up' ? TAGS_UP : TAGS_DOWN;
  const disabled = step === 'submitting';

  return (
    <View style={styles.section}>
      <SectionLabel icon="📊" label="경기 어땠어?" />
      <Panel>
        {step === 'thumbs_select' && (
          <View style={styles.col}>
            <PixelText variant="caption" color={colors.textDim} style={styles.question}>
              꿀잼지수 예측이 맞았나요?
            </PixelText>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.thumbBtn}
                disabled={disabled}
                onPress={() => selectThumbs('up')}
              >
                <PixelText style={styles.thumbEmoji}>👍</PixelText>
                <PixelText variant="caption" color={colors.good}>꿀잼</PixelText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thumbBtn}
                disabled={disabled}
                onPress={() => selectThumbs('down')}
              >
                <PixelText style={styles.thumbEmoji}>👎</PixelText>
                <PixelText variant="caption" color={colors.bad}>노잼</PixelText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'tag_select' && (
          <View>
            <PixelText variant="caption" color={colors.textDim} style={styles.question}>
              이유를 골라주세요
            </PixelText>
            <View style={styles.tagGrid}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag.slug}
                  style={styles.tagBtn}
                  disabled={disabled}
                  onPress={() => handleTagSelect(tag)}
                >
                  <PixelText variant="caption" color={colors.text}>{tag.label}</PixelText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 'submitting' && (
          <View style={styles.center}>
            <PixelText variant="caption" color={colors.textDim}>저장 중...</PixelText>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.center}>
            <PixelText variant="body" color={accent}>피드백 감사해요 👋</PixelText>
          </View>
        )}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.sm },
  col: { alignItems: 'center', gap: spacing.sm },
  question: { textAlign: 'center', marginBottom: spacing.xs },
  buttonRow: { flexDirection: 'row', gap: spacing.xl },
  thumbBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: border.width,
    borderRadius: border.radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  thumbEmoji: { fontSize: 28 },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  tagBtn: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: border.width,
    borderRadius: border.radius,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  center: { alignItems: 'center', paddingVertical: spacing.sm },
});
