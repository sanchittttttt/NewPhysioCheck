import { PoseLandmark } from './types';

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Compute the angle (in degrees) at point B formed by points A-B-C.
 */
export function computeAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const abMag = Math.sqrt(ab.x * ab.x + ab.y * ab.y + ab.z * ab.z);
  const cbMag = Math.sqrt(cb.x * cb.x + cb.y * cb.y + cb.z * cb.z);

  if (abMag === 0 || cbMag === 0) return 0;

  const cosAngle = Math.min(Math.max(dot / (abMag * cbMag), -1), 1);
  return toDegrees(Math.acos(cosAngle));
}

// Named helpers for common joint angles

export function kneeFlexionAngle(hip: PoseLandmark, knee: PoseLandmark, ankle: PoseLandmark): number {
  return computeAngle(hip, knee, ankle);
}

export function hipFlexionAngle(shoulder: PoseLandmark, hip: PoseLandmark, knee: PoseLandmark): number {
  return computeAngle(shoulder, hip, knee);
}

export function shoulderFlexionAngle(hip: PoseLandmark, shoulder: PoseLandmark, elbow: PoseLandmark): number {
  return computeAngle(hip, shoulder, elbow);
}

export function elbowFlexionAngle(shoulder: PoseLandmark, elbow: PoseLandmark, wrist: PoseLandmark): number {
  return computeAngle(shoulder, elbow, wrist);
}

/**
 * Approximate trunk lean angle relative to vertical using hip-shoulder line.
 * Returns degrees from vertical (0 = upright).
 */
export function torsoLeanAngle(hip: PoseLandmark, shoulder: PoseLandmark): number {
  const dy = shoulder.y - hip.y;
  const dx = shoulder.x - hip.x;
  const angleFromVertical = Math.abs(toDegrees(Math.atan2(dx, dy))); // swap to measure from vertical axis
  return angleFromVertical;
}

/**
 * Exponential moving average for smoothing scalar signals.
 */
export function ema(previous: number | null, current: number, alpha: number): number {
  if (previous === null) return current;
  return alpha * current + (1 - alpha) * previous;
}

