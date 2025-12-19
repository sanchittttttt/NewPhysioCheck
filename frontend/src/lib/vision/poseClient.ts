import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { PoseResult } from './types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export interface PoseClient {
  isReady: boolean;
  init(): Promise<void>;
  process(video: HTMLVideoElement): Promise<PoseResult | null>;
  destroy(): void;
}

/**
 * MediaPipe Pose Landmarker wrapper.
 */
export function createPoseClient(): PoseClient {
  let ready = false;
  let landmarker: PoseLandmarker | null = null;

  return {
    get isReady() {
      return ready;
    },

    async init() {
      if (ready) return;
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      ready = true;
    },

    async process(video: HTMLVideoElement): Promise<PoseResult | null> {
      if (!ready || !landmarker) return null;

      try {
        const now = performance.now();
        const result: PoseLandmarkerResult = landmarker.detectForVideo(video, now);
        const landmarks = result.landmarks?.[0];
        if (!landmarks) return null;

        return {
          landmarks: landmarks.map((l) => ({
            x: l.x,
            y: l.y,
            z: l.z,
            visibility: l.visibility,
          })),
        };
      } catch (error) {
        // Fail softly per frame
        console.error('[PoseClient] process error', error);
        return null;
      }
    },

    destroy() {
      if (landmarker) {
        landmarker.close();
        landmarker = null;
      }
      ready = false;
    },
  };
}

