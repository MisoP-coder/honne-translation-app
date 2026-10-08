import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** 放射線（サンバースト）の本数。偶数にして色を交互にする */
export const RAY_COUNT = 24;
/** 放射線が 1 回転する秒数（ゆっくり回して、止まっていない感じを出す） */
export const RAY_TURN_SECONDS = 60;
/** 紙吹雪のきらめきの周期（秒）。全画面の明滅ではなく小さな粒だけなので、発作の心配がない速さ */
const TWINKLE_SECONDS = 1.6;

interface Props {
  width: number;
  height: number;
  /** 放射線とスポットライトの中心（プリンのあたり）。0〜1 の割合 */
  centerYRatio?: number;
}

/** 中心から放射状に広がる三角形（交互に色を付ける側だけ） */
export function rayPolygons(cx: number, cy: number, radius: number, count = RAY_COUNT): string[] {
  const out: string[] = [];
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i += 2) {
    const a0 = i * step;
    const a1 = a0 + step;
    const p = (a: number) => `${(cx + Math.cos(a) * radius).toFixed(1)},${(cy + Math.sin(a) * radius).toFixed(1)}`;
    out.push(`${cx},${cy} ${p(a0)} ${p(a1)}`);
  }
  return out;
}

/** 決まった並びの「ランダムっぽい」配置（毎回同じ見た目にする） */
function scatter(count: number, seed: number) {
  const out: { x: number; y: number; r: number; k: number }[] = [];
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) out.push({ x: rnd(), y: rnd(), r: rnd(), k: i % 3 });
  return out;
}

const CONFETTI = scatter(26, 7);
const CONFETTI_COLORS = ['#FFFFFF', '#FFE600', '#FF5A7A', '#5AD1FF', '#7BE36A'];
/** 画面のふちを流れるカラメルの雫（x, y は割合、s は大きさ） */
const DROPS = [
  { x: 0.08, y: 0.2, s: 1.1, rot: -20 },
  { x: 0.92, y: 0.14, s: 0.9, rot: 25 },
  { x: 0.05, y: 0.62, s: 0.8, rot: -10 },
  { x: 0.95, y: 0.55, s: 1.2, rot: 15 },
  { x: 0.12, y: 0.9, s: 1, rot: -30 },
  { x: 0.88, y: 0.86, s: 0.85, rot: 30 },
];

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** 雫の形（下がふくらんだしずく）。原点が雫の中心 */
function dropPath(s: number): string {
  const w = 9 * s;
  const h = 16 * s;
  return `M0,${-h} C${w * 0.4},${-h * 0.4} ${w},${-h * 0.05} ${w},${h * 0.35} A${w},${w} 0 1 1 ${-w},${h * 0.35} C${-w},${-h * 0.05} ${-w * 0.4},${-h * 0.4} 0,${-h}Z`;
}

/**
 * タイトル画面の背景：パチンコ・お祭り風の放射線、プリンを照らすスポットライト、
 * 紙吹雪・星・カラメルの雫、四隅の網点、ふちの暗がり。
 * Canva で作った背景イラストを元に、SVG で描き直している（どの画面サイズでもくっきり、回せる）。
 */
export const TitleBackdrop = memo(function TitleBackdrop({ width, height, centerYRatio = 0.5 }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let stopped = false;
    const anims: Animated.CompositeAnimation[] = [];
    const start = () => {
      if (stopped) return;
      anims.push(
        Animated.loop(
          Animated.timing(spin, {
            toValue: 1,
            duration: RAY_TURN_SECONDS * 1000,
            easing: Easing.linear,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(twinkle, { toValue: 1, duration: (TWINKLE_SECONDS * 1000) / 2, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(twinkle, { toValue: 0, duration: (TWINKLE_SECONDS * 1000) / 2, useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
        ),
      );
      anims.forEach((a) => a.start());
    };
    // 「視差効果を減らす」設定の人には動かさない
    const reduceMotion = AccessibilityInfo.isReduceMotionEnabled?.();
    if (reduceMotion) {
      reduceMotion.then((reduce) => !reduce && start()).catch(start);
    } else {
      start();
    }
    return () => {
      stopped = true;
      anims.forEach((a) => a.stop());
    };
  }, [spin, twinkle]);

  if (width <= 0 || height <= 0) return null;

  const cx = width / 2;
  const cy = height * centerYRatio;
  // 回しても角が欠けないよう、画面の対角線より大きい正方形に描いて回す
  const size = Math.ceil(Math.hypot(width, height) * 1.15);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const opacityA = twinkle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const opacityB = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  const confettiLayer = (k: number) => (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      {CONFETTI.filter((c) => c.k === k).map((c, i) => {
        const x = c.x * width;
        const y = c.y * height;
        const color = CONFETTI_COLORS[(i + k) % CONFETTI_COLORS.length];
        if (i % 3 === 0) return <Path key={i} d={starPath(x, y, 5 + c.r * 6)} fill={color} />;
        if (i % 3 === 1) return <Circle key={i} cx={x} cy={y} r={2 + c.r * 3} fill={color} />;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={4 + c.r * 4}
            height={9 + c.r * 5}
            rx={1.5}
            fill={color}
            transform={`rotate(${Math.round(c.r * 180)} ${x} ${y})`}
          />
        );
      })}
    </Svg>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="title-backdrop">
      {/* 地の色：中心ほど明るいオレンジ */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="tbBase" cx={cx} cy={cy} r={Math.max(width, height) * 0.75} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFB347" />
            <Stop offset="0.6" stopColor="#F07A22" />
            <Stop offset="1" stopColor="#C2501A" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#tbBase)" />
      </Svg>

      {/* 放射線（ゆっくり回る） */}
      <Animated.View
        style={{
          position: 'absolute',
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          transform: [{ rotate }],
        }}
      >
        <Svg width={size} height={size}>
          {rayPolygons(size / 2, size / 2, size / 2).map((pts, i) => (
            <Polygon key={i} points={pts} fill="#FFD23F" opacity={0.75} />
          ))}
        </Svg>
      </Animated.View>

      {/* スポットライト・四隅の網点・カラメルの雫・ふちの暗がり */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="tbSpot" cx={cx} cy={cy} r={width * 0.62} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFDF2" stopOpacity={1} />
            <Stop offset="0.45" stopColor="#FFF4D0" stopOpacity={0.85} />
            <Stop offset="1" stopColor="#FFF4D0" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="tbVignette" cx={cx} cy={height / 2} r={Math.hypot(width, height) * 0.6} gradientUnits="userSpaceOnUse">
            <Stop offset="0.6" stopColor="#5A1E00" stopOpacity={0} />
            <Stop offset="1" stopColor="#5A1E00" stopOpacity={0.55} />
          </RadialGradient>
          <RadialGradient id="tbDrop" cx="35%" cy="35%" r="70%">
            <Stop offset="0" stopColor="#E89A4A" />
            <Stop offset="0.5" stopColor="#B8661E" />
            <Stop offset="1" stopColor="#6E3208" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#tbSpot)" />
        {/* 四隅の網点（アメコミ・パチンコ台っぽさ） */}
        {[
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ].map(([qx, qy]) => (
          <G key={`${qx}${qy}`} opacity={0.22}>
            {Array.from({ length: 7 }).flatMap((_, row) =>
              Array.from({ length: 7 - row }).map((__, col) => {
                const gap = 13;
                const x = qx ? width - 8 - col * gap : 8 + col * gap;
                const y = qy ? height - 8 - row * gap : 8 + row * gap;
                return <Circle key={`${row}-${col}`} cx={x} cy={y} r={Math.max(0.8, 4.2 - (row + col) * 0.6)} fill="#5A1E00" />;
              })
            )}
          </G>
        ))}
        {DROPS.map((d, i) => (
          <G key={i} transform={`translate(${d.x * width} ${d.y * height}) rotate(${d.rot})`}>
            <Path d={dropPath(d.s)} fill="url(#tbDrop)" />
            <Circle cx={-3 * d.s} cy={2 * d.s} r={2.4 * d.s} fill="#FFFFFF" opacity={0.7} />
          </G>
        ))}
        <Rect x={0} y={0} width={width} height={height} fill="url(#tbVignette)" />
      </Svg>

      {/* 紙吹雪：3 組を交互にきらめかせる */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityA }]}>{confettiLayer(0)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityB }]}>{confettiLayer(1)}</Animated.View>
      <View style={StyleSheet.absoluteFill}>{confettiLayer(2)}</View>
    </View>
  );
});
