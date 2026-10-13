import { Platform, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'x';
  /** large：タイトル画面の「スタート」用の大きく目立つボタン */
  size?: 'normal' | 'large';
  style?: ViewStyle;
  testID?: string;
  /**
   * Web では本物のリンク（<a>）にする。
   * 埋め込み先によってはスクリプトから新しいタブを開けないため、リンクとして押してもらう。
   */
  href?: string;
}

export function GameButton({ label, onPress, variant = 'primary', size = 'normal', style, testID, href }: Props) {
  const asLink = Platform.OS === 'web' && href !== undefined;
  // href / hrefAttrs は react-native-web だけが解釈する（型定義にはない）
  const linkProps = asLink ? { href, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};
  return (
    <Pressable
      testID={testID}
      accessibilityRole={asLink ? 'link' : 'button'}
      accessibilityLabel={label}
      onPress={asLink ? undefined : onPress}
      {...linkProps}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === 'large' && styles.large,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary, size === 'large' && styles.labelLarge]}>
        {label}
      </Text>
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
  // 下側を濃くして、押したくなる立体的なボタンにする
  large: {
    minWidth: 250,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderBottomWidth: 7,
    borderBottomColor: '#A8300E',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  label: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  labelSecondary: { color: colors.caramel },
  labelLarge: { fontSize: 24, fontWeight: '900', letterSpacing: 4 },
});
