/**
 * Shared types for the computer-vision pipeline.
 * These are intentionally framework-agnostic and map cleanly
 * onto existing backend payload shapes.
 */

export type ExerciseType = 'squat' | 'slr' | 'elbow_flexion';

/**
 * MediaPipe Pose landmark (normalized coordinates).
 */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Pose inference result.
 */
export interface PoseResult {
  landmarks: PoseLandmark[];
  worldLandmarks?: PoseLandmark[];
}

/**
 * Event emitted when a rep is detected.
 */
export interface RepEvent {
  exercise: ExerciseType;
  repIndex: number;
  romMax: number;
  romTarget: number;
  accuracyScore: number; // 0–100
  durationMs: number;
  formQuality:
  | 'good'
  | 'too_shallow'
  | 'too_fast'
  | 'compensated';
  errorSegment?:
  | 'knee_valgus'
  | 'trunk_lean'
  | 'knee_flexion'
  | 'pelvis_tilt'
  | 'elbow_flexion'
  | 'too_shallow'
  | 'too_fast';
  timestampMs: number;
}

/**
 * Shape that maps directly to backend SessionRepCreate.
 * This will be transformed to the exact payload when sending to the API.
 */
export interface SessionRepPayload {
  exerciseId: string;
  repIndex: number;
  romMax?: number;
  romTarget?: number;
  accuracyScore?: number;
  tempoScore?: number;
  formQuality?: string;
  errorSegment?: string;
  timestampMs?: number;
}

