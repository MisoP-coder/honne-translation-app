import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  x: number;
  y: number;
  radius: number;
  /** 滑り落ちるときの傾き（度） */
  tilt?: number;
  testID?: string;
}

/** しずく型のカラメル。(x, y) はしずくの丸い部分の中心 */
export function CaramelDrop({ x, y, radius, tilt = 0, testID }: Props) {
  const size = radius * 2;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        styles.drop,
        {
          left: x - radius,
          top: y - radius,
          width: size,
          height: size,
          borderRadius: radius,
          // 1つの角だけ尖らせてしずく型にする（borderRadius より後に書かないと上書きされる）
          borderTopLeftRadius: 0,
          transform: [{ rotate: `${45 + tilt}deg` }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  drop: {
    position: 'absolute',
    backgroundColor: colors.caramel,
    borderWidth: 2,
    borderColor: colors.caramelLight,
  },
});
