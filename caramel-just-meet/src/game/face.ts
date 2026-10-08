/**
 * プリンの顔（目と口）の慣性。
 * プリンが揺れて加速すると、顔は慣性で置いていかれ、バネで少し遅れてプルンと戻る。
 * 顔の位置はプリンから見た相対位置 (px)。
 */

export interface FaceState {
  /** プリン中心からの顔の横ずれ */
  x: number;
  vx: number;
  /** 顔の縦ずれ（横に大きくずれると少し持ち上がる） */
  y: number;
  /** 前フレームのプリンの速度（加速度を求めるため） */
  lastPuddingVelocity: number;
}

/** バネの強さと減衰。減衰を弱めにして、止まるまでに何度かプルプルさせる */
const STIFFNESS = 140;
const DAMPING = 7;
/** プリンの加速度がどれだけ顔を振り回すか */
const INERTIA = 2.0;

export const INITIAL_FACE: FaceState = { x: 0, vx: 0, y: 0, lastPuddingVelocity: 0 };

export function stepFace(
  face: FaceState,
  puddingVelocity: number,
  dt: number,
  maxOffset: number,
): FaceState {
  if (dt <= 0) return face;
  const accel = (puddingVelocity - face.lastPuddingVelocity) / dt;
  // プリンと一緒に動く座標で見ると、顔には加速と逆向きの見かけの力がかかる
  const ax = -STIFFNESS * face.x - DAMPING * face.vx - INERTIA * accel;
  let vx = face.vx + ax * dt;
  let x = face.x + vx * dt;
  if (Math.abs(x) > maxOffset) {
    x = Math.sign(x) * maxOffset;
    vx = 0;
  }
  return {
    x,
    vx,
    y: -Math.abs(x) * 0.25,
    lastPuddingVelocity: puddingVelocity,
  };
}
