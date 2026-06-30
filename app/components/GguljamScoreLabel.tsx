import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';

const BG = '#1B3A2A';
const BORDER = '#C8BFA8';
const CREAM = '#F5EDDA';
const DOT_GOLD = '#F5C542';
const DOT_GREEN = '#5BAD6F';

const DOT_SIZE = 3;
const DOT_GAP = 2;

interface Props {
  text?: string;
  variant: 'hero' | 'detail';
}

function Dots() {
  return (
    <View style={styles.dotCol}>
      <View style={[styles.dot, { backgroundColor: DOT_GOLD }]} />
      <View style={[styles.dot, { backgroundColor: DOT_GREEN }]} />
    </View>
  );
}

export default function GguljamScoreLabel({ text = '꿀잼지수', variant }: Props) {
  return (
    <View style={[styles.container, variant === 'detail' && styles.containerDetail]}>
      <Dots />
      <PixelText variant="caption" color={CREAM} style={styles.text}>{text}</PixelText>
      <Dots />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 6,
    shadowColor: '#0a1a10',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 2,
  },
  containerDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    letterSpacing: 0.5,
  },
  dotCol: {
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: 0.5,
  },
});
