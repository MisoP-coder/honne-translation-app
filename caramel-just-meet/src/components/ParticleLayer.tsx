import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Polygon } from 'react-native-svg';

import type { Particle } from '../game/particles';

function starPoints(x: number, y: number, size: number, rotationDeg: number): string {
  const pts: string[] = [];
  const rot = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.42;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    pts.push(`${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

interface Props {
  width: number;
  height: number;
  particles: readonly Particle[];
}

/** 星・光の粒・衝撃波リングを1枚の SVG にまとめて描く */
export const ParticleLayer = memo(function ParticleLayer({ width, height, particles }: Props) {
  if (particles.length === 0) return null;
  return (
    <Svg testID="particles" width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => {
        const t = p.life / p.maxLife;
        const alpha = Math.min(1, t * 1.6);
        if (p.kind === 'ring') {
          return (
            <Circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.size}
              fill="none"
              stroke={p.color}
              strokeWidth={2 + 6 * t}
              opacity={alpha * 0.8}
            />
          );
        }
        if (p.kind === 'spark') {
          return (
            <G key={p.id} opacity={alpha}>
              <Circle cx={p.x} cy={p.y} r={p.size * 2.4} fill={p.color} opacity={0.25} />
              <Circle cx={p.x} cy={p.y} r={p.size} fill="#FFFFFF" />
            </G>
          );
        }
        // 星：ぼんやり光る輪の上にくっきりした星
        const size = p.size * (0.6 + 0.4 * t);
        return (
          <G key={p.id} opacity={alpha}>
            <Circle cx={p.x} cy={p.y} r={size * 1.3} fill={p.color} opacity={0.22} />
            <Polygon points={starPoints(p.x, p.y, size, p.rotation)} fill={p.color} stroke="#FFFFFF" strokeWidth={0.8} />
          </G>
        );
      })}
    </Svg>
  );
});
