import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSound } from '../audio/SoundContext';
import { colors } from '../theme/colors';
import { GameButton } from './GameButton';
import { OutlinedText } from './OutlinedText';
import { VolumeBar } from './VolumeBar';

interface Props {
  onClose: () => void;
}

/** BGM と効果音を別々にオン・オフ、音量調節する画面 */
export function SoundSettingsPanel({ onClose }: Props) {
  const sound = useSound();
  if (!sound) return null;
  const { settings, updateSettings, manager } = sound;

  return (
    <View style={styles.backdrop} testID="sound-settings">
      <View style={styles.card}>
        <OutlinedText fill="#FFE600" shadow="#D0002A" outlineWidth={2} depth={3} style={styles.heading}>
          サウンド設定
        </OutlinedText>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>BGM</Text>
            <Switch
              testID="bgm-toggle"
              label="BGM"
              on={settings.bgmEnabled}
              onChange={(on) => updateSettings({ bgmEnabled: on })}
            />
          </View>
          <VolumeBar
            testID="bgm-volume"
            label="BGM の音量"
            value={settings.bgmVolume}
            disabled={!settings.bgmEnabled}
            onChange={(v) => updateSettings({ bgmVolume: v })}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>効果音</Text>
            <Switch
              testID="se-toggle"
              label="効果音"
              on={settings.seEnabled}
              onChange={(on) => {
                updateSettings({ seEnabled: on });
                if (on) manager.playSe('se_perfect_4');
              }}
            />
          </View>
          <VolumeBar
            testID="se-volume"
            label="効果音の音量"
            value={settings.seVolume}
            disabled={!settings.seEnabled}
            onChange={(v) => updateSettings({ seVolume: v })}
            // 指を離したら、その音量で「ピキーン！」を試しに鳴らす
            onRelease={() => manager.playSe('se_perfect_4')}
          />
        </View>

        <GameButton testID="sound-settings-close" label="とじる" onPress={onClose} />
      </View>
    </View>
  );
}

function Switch({
  on,
  onChange,
  label,
  testID,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      style={[styles.switch, on ? styles.switchOn : styles.switchOff]}
      hitSlop={8}
    >
      <Text style={[styles.switchText, !on && styles.switchTextOff]}>{on ? 'ON' : 'OFF'}</Text>
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(60,30,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 10,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 18,
    alignItems: 'stretch',
  },
  heading: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', textAlign: 'center' },
  section: { gap: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  switch: {
    width: 74,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  switchOn: { backgroundColor: colors.accent },
  switchOff: { backgroundColor: colors.backgroundDeep },
  switchText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  switchTextOff: { color: colors.textSub, textAlign: 'right' },
  knob: {
    position: 'absolute',
    top: 3,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  knobOn: { right: 3 },
  knobOff: { left: 3 },
});
