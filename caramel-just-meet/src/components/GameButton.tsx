import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'x';
  style?: ViewStyle;
  testID?: string;
}

export function GameButton({ label, onPress, variant = 'primary', style, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 220,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.caramel },
  x: { backgroundColor: colors.x },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  label: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  labelSecondary: { color: colors.caramel },
});
