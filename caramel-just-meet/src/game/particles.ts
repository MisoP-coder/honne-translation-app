import type { Judge } from './engine';
import { randomRange } from './rng';

/**
 * 成功時に飛び散るキラキラ（星・光の粒・衝撃波リング）。
 * ゲームエンジンと同じく純粋関数で、毎フレーム stepParticles で進める。
 */

export type ParticleKind = 'star' | 'spark' | 'ring';

export interface Particle {
  id: number;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 残り寿命（秒） */
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
}

export interface ParticleSystem {
  particles: Particle[];
  nextId: number;
  rngState: number;
}

/** 同時に出せる粒の上限（重くなりすぎないように） */
export const MAX_PARTICLES = 160;
const GRAVITY = 520;
const DRAG = 1.6;

const GOLD = ['#FFD700', '#FFF4B0', '#FFFFFF', '#FFB627'];
const HOT = ['#FFD700', '#FF8A3D', '#FF5FA2', '#FFFFFF', '#FFF4B0'];
const RAINBOW = ['#FF4D6D', '#FFB627', '#FFE14D', '#4DFF88', '#4DD2FF', '#9B6BFF', '#FFFFFF'];

export function createParticleSystem(seed: number): ParticleSystem {
  return { particles: [], nextId: 1, rngState: seed >>> 0 };
}

/** コンボ数に応じた派手さ（0〜1） */
export function intensityFor(combo: number): number {
  return Math.min(combo, 30) / 30;
}

export function paletteFor(combo: number): readonly string[] {
  if (combo >= 10) return RAINBOW;
  if (combo >= 5) return HOT;
  return GOLD;
}

export function burstCount(judge: Judge, combo: number): number {
  if (judge === 'miss') return 0;
  const c = Math.min(combo, 30);
  return judge === 'perfect' ? 16 + c * 2 : 8 + c;
}

/** 衝撃波リングの数 */
export function ringCount(judge: Judge, combo: number): number {
  if (judge === 'miss') return 0;
  if (judge === 'good') return combo >= 10 ? 1 : 0;
  return combo >= 15 ? 3 : combo >= 5 ? 2 : 1;
}

/** (x, y) を中心にキラキラを飛び散らせる */
export function spawnBurst(
  system: ParticleSystem,
  x: number,
  y: number,
  judge: Judge,
  combo: number,
): ParticleSystem {
  const count = burstCount(judge, combo);
  if (count === 0) return system;
  let s = system.rngState;
  const rand = (min: number, max: number) => {
    const r = randomRange(s, min, max);
    s = r.state;
    return r.value;
  };
  const palette = paletteFor(combo);
  const power = 1 + intensityFor(combo) * 0.9;
  let id = system.nextId;
  const born: Particle[] = [];

  for (let i = 0; i < count; i++) {
    // 主に上半分に向かって扇状に飛ばす
    const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
    const speed = rand(160, 420) * power;
    const isStar = i % 3 !== 2;
    const life = rand(0.55, 1.0) * (isStar ? 1 : 0.8);
    born.push({
      id: id++,
      kind: isStar ? 'star' : 'spark',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: (isStar ? rand(7, 13) : rand(2.5, 5)) * (1 + intensityFor(combo) * 0.6),
      rotation: rand(0, 360),
      spin: rand(-540, 540),
      color: palette[Math.floor(rand(0, palette.length))] ?? palette[0],
    });
  }
  const rings = ringCount(judge, combo);
  for (let i = 0; i < rings; i++) {
    const life = 0.45 + i * 0.12;
    born.push({
      id: id++,
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      maxLife: life,
      size: 10 + i * 6,
      rotation: 0,
      spin: 0,
      color: i === 0 ? '#FFFFFF' : palette[i % palette.length],
    });
  }

  const particles = [...system.particles, ...born];
  return {
    particles: particles.length > MAX_PARTICLES ? particles.slice(-MAX_PARTICLES) : particles,
    nextId: id,
    rngState: s,
  };
}

export function stepParticles(system: ParticleSystem, dt: number): ParticleSystem {
  if (system.particles.length === 0 || dt <= 0) return system;
  const drag = Math.max(0, 1 - DRAG * dt);
  const particles: Particle[] = [];
  for (const p of system.particles) {
    const life = p.life - dt;
    if (life <= 0) continue;
    if (p.kind === 'ring') {
      // リングはその場で広がって消える
      particles.push({ ...p, life, size: p.size + 260 * dt });
      continue;
    }
    const vy = (p.vy + GRAVITY * dt) * drag;
    const vx = p.vx * drag;
    particles.push({
      ...p,
      life,
      vx,
      vy,
      x: p.x + vx * dt,
      y: p.y + vy * dt,
      rotation: p.rotation + p.spin * dt,
    });
  }
  return { ...system, particles };
}

export function clearParticles(system: ParticleSystem): ParticleSystem {
  return system.particles.length === 0 ? system : { ...system, particles: [] };
}
