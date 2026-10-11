import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { rayPolygons } from '../../components/TitleBackdrop';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** 後光の放射線の本数（偶数） */
const RAYS = 28;
/** 後光が 1 回転する秒数（パチンコの大当たりのように、ぐるぐる速めに回す） */
export const HALO_TURN_SECONDS = 14;

interface Props {
  width: number;
  height: number;
  /** 後光の中心（0〜1 の割合） */
  centerYRatio?: number;
}

/**
 * パチンコの大当たり風に回る後光。
 * 2 重の放射線を逆向きに回し、中心に白いスポットを当てる。
 */
export const HaloBackdrop = memo(function HaloBackdrop({ width, height, centerYRatio = 0.32 }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let stopped = false;
    const anims: Animated.CompositeAnimation[] = [];
    const start = () => {
      if (stopped) return;
      anims.push(
        Animated.loop(
          Animated.timing(spin, {
            toValue: 1,
            duration: HALO_TURN_SECONDS * 1000,
            easing: Easing.linear,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(glow, { toValue: 0, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
        ),
      );
      anims.forEach((a) => a.start());
    };
    // 「視差効果を減らす」設定の人には回さない
    const reduceMotion = AccessibilityInfo.isReduceMotionEnabled?.();
    if (reduceMotion) reduceMotion.then((reduce) => !reduce && start()).catch(start);
    else start();
    return () => {
      stopped = true;
      anims.forEach((a) => a.stop());
    };
  }, [spin, glow]);

  if (width <= 0 || height <= 0) return null;
  const cx = width / 2;
  const cy = height * centerYRatio;
  const size = Math.ceil(Math.hypot(width, height) * 2.1);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateBack = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const raysStyle = {
    position: 'absolute' as const,
    left: cx - size / 2,
    top: cy - size / 2,
    width: size,
    height: size,
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="halo-backdrop">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="haloBase" cx={cx} cy={cy} r={Math.max(width, height)} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#3CF08A" />
            <Stop offset="0.45" stopColor="#06C755" />
            <Stop offset="1" stopColor="#02441E" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#haloBase)" />
      </Svg>
      <Animated.View style={[raysStyle, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          {rayPolygons(size / 2, size / 2, size / 2, RAYS).map((pts, i) => (
            <Polygon key={i} points={pts} fill="#FFE600" opacity={0.55} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={[raysStyle, { transform: [{ rotate: rotateBack }], opacity: glowOpacity }]}>
        <Svg width={size} height={size}>
          {rayPolygons(size / 2, size / 2, size / 2, RAYS / 2).map((pts, i) => (
            <Polygon key={i} points={pts} fill="#FFFFFF" opacity={0.22} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="haloSpot" cx={cx} cy={cy} r={width * 0.6} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.5" stopColor="#FFF7B0" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#FFF7B0" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={width * 0.6} fill="url(#haloSpot)" />
        </Svg>
      </Animated.View>
    </View>
  );
});
