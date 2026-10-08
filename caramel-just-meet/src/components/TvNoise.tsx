import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { nextRandom } from '../game/rng';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const TILE = 96;
const TILE_COUNT = 3;
const SPECKS_PER_TILE = 260;
/** 砂嵐を切り替える間隔（ミリ秒） */
const FRAME_MS = 70;

export interface Speck {
  x: number;
  y: number;
  size: number;
  /** 0（黒）〜 255（白） */
  gray: number;
  alpha: number;
}

/** 砂嵐の1タイルぶんの粒を作る（シード付きで毎回同じ模様） */
export function makeNoiseTile(seed: number, count = SPECKS_PER_TILE, tile = TILE): Speck[] {
  let s = seed >>> 0;
  const r = () => {
    const n = nextRandom(s);
    s = n.state;
    return n.value;
  };
  return Array.from({ length: count }, () => ({
    x: Math.floor(r() * tile),
    y: Math.floor(r() * tile),
    size: 1 + Math.floor(r() * 3),
    gray: r() < 0.5 ? Math.floor(r() * 60) : 190 + Math.floor(r() * 65),
    alpha: 0.35 + r() * 0.65,
  }));
}

interface Props {
  /** 0〜1。セピア化に合わせて濃くする */
  amount: number;
}

/**
 * 古いテレビの砂嵐（ザーッ）。
 * 粒の模様を数種類だけ用意し、短い間隔で模様と位置をランダムに切り替えて動いているように見せる。
 * さらに走査線と、上から下へ流れる明るい帯を重ねる。
 */
/** 親いっぱいに広がり、自分で大きさを測る */
export function TvNoise({ amount }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const tiles = useMemo(() => Array.from({ length: TILE_COUNT }, (_, i) => makeNoiseTile(7919 * (i + 1))), []);
  const [frame, setFrame] = useState(0);
  const band = useRef(new Animated.Value(0)).current;
  const active = amount > 0;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => f + 1), FRAME_MS);
    const loop = Animated.loop(
      Animated.timing(band, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }),
    );
    loop.start();
    return () => {
      clearInterval(id);
      loop.stop();
    };
  }, [active, band]);

  if (!active) return null;
  // フレームごとに模様と位置をずらす（決まった並びで十分ランダムに見える）
  const tileIndex = frame % TILE_COUNT;
  const ox = ((frame * 37) % TILE) - TILE;
  const oy = ((frame * 61) % TILE) - TILE;
  const bandY = band.interpolate({ inputRange: [0, 1], outputRange: [-80, height] });

  return (
    <View
      testID="tv-noise"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip, { opacity: amount }]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w !== width || h !== height) setSize({ width: w, height: h });
      }}
    >
      <Svg
        width={width + TILE * 2}
        height={height + TILE * 2}
        style={{ position: 'absolute', left: ox, top: oy, opacity: 0.32 }}
      >
        <Defs>
          {tiles.map((specks, i) => (
            <Pattern key={i} id={`noise${i}`} x={0} y={0} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
              {specks.map((p, j) => (
                <Rect
                  key={j}
                  x={p.x}
                  y={p.y}
                  width={p.size}
                  height={p.size}
                  fill={`rgb(${p.gray},${p.gray},${p.gray})`}
                  opacity={p.alpha}
                />
              ))}
            </Pattern>
          ))}
        </Defs>
        <Rect x={0} y={0} width={width + TILE * 2} height={height + TILE * 2} fill={`url(#noise${tileIndex})`} />
      </Svg>
      {/* 走査線 */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="scan" x={0} y={0} width={4} height={4} patternUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={4} height={1.5} fill="#000000" opacity={0.28} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#scan)" />
      </Svg>
      {/* 流れる明るい帯 */}
      <Animated.View style={[styles.band, { transform: [{ translateY: bandY }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 60,
    backgroundColor: '#FFFFFF',
    opacity: 0.07,
  },
});
