import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

/** 画面上部に固定されたカラメルの容器。ここから真下にカラメルが落ちる */
export function Dropper({ x, y }: { x: number; y: number }) {
  return (
    <View pointerEvents="none" style={[styles.root, { left: x - 26, top: y - 64 }]}>
      <View style={styles.bottle}>
        <Text style={styles.label}>CARAMEL</Text>
      </View>
      <View style={styles.nozzle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', width: 52, alignItems: 'center' },
  bottle: {
    width: 52,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.caramelLight,
    borderWidth: 2,
    borderColor: colors.caramel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: '#FFF3DC', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  nozzle: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.caramel,
  },
});
