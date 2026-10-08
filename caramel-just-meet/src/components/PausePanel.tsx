import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { GameButton } from './GameButton';
import { OutlinedText } from './OutlinedText';

interface Props {
  combo: number;
  score: number;
  onResume: () => void;
  onSoundSettings: () => void;
  onRetry: () => void;
  onTitle: () => void;
}

/** プレイ中の一時停止メニュー */
export function PausePanel({ combo, score, onResume, onSoundSettings, onRetry, onTitle }: Props) {
  return (
    <View style={styles.backdrop} testID="pause-menu">
      <View style={styles.card}>
        <OutlinedText fill="#FFE600" shadow="#D0002A" outlineWidth={3} depth={4} style={styles.heading}>
          PAUSE
        </OutlinedText>
        <Text style={styles.status}>
          いま {combo} 連続 ／ {score} 点
        </Text>
        <View style={styles.buttons}>
          <GameButton testID="pause-resume" label="つづける" onPress={onResume} />
          <GameButton testID="pause-sound" label="🔊 サウンド設定" variant="secondary" onPress={onSoundSettings} />
          <GameButton testID="pause-retry" label="はじめからやり直す" variant="secondary" onPress={onRetry} />
          <GameButton testID="pause-title" label="タイトルへ" variant="secondary" onPress={onTitle} />
        </View>
        <Text style={styles.note}>やり直す・タイトルへ戻ると、いまの記録は残りません</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(60,30,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  heading: { fontSize: 40, fontWeight: '900', fontStyle: 'italic', letterSpacing: 3 },
  status: { fontSize: 14, fontWeight: '700', color: colors.textSub, fontVariant: ['tabular-nums'] },
  buttons: { marginTop: 14, gap: 10, alignItems: 'center' },
  note: { marginTop: 10, fontSize: 12, color: colors.textSub, textAlign: 'center' },
});
