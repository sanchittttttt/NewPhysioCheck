import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { PoseResult, PoseLandmark } from './types';

// Use the HEAVY model for better accuracy (accepts higher latency for better landmarks)
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

// Confidence thresholds - tuned for better tracking with loose clothes
const CONFIG = {
  // Higher thresholds reject low-quality tracking and trigger re-detection
  MIN_DETECTION_CONFIDENCE: 0.5,   // Lowered back to 0.5 for better detection
  MIN_PRESENCE_CONFIDENCE: 0.5,    // Lowered back to 0.5 for better detection
  MIN_TRACKING_CONFIDENCE: 0.4,    // Lowered to 0.4 to maintain tracking longer

  // Visibility gating thresholds
  VISIBILITY_THRESHOLD_HIGH: 0.6,  // High confidence - use directly
  VISIBILITY_THRESHOLD_LOW: 0.2,   // Below this - freeze/interpolate (lowered from 0.3)

  // Frame analysis
  BODY_COVERAGE_MIN: 0.1,          // Lowered from 0.15 for more flexibility
  SMOOTHING_FACTOR: 0.5,           // Increased from 0.3 for smoother movement (less jitter)

  // Outlier rejection - reject sudden large jumps
  MAX_POSITION_JUMP: 0.15,         // Maximum allowed jump per frame (as fraction of frame)
};

// Key landmark indices for body coverage check
const LANDMARK_HEAD = 0;
const LANDMARK_LEFT_ANKLE = 27;
const LANDMARK_RIGHT_ANKLE = 28;

export interface PoseClientConfig {
  enableSmoothing?: boolean;
  enableVisibilityGating?: boolean;
}

export interface PoseClient {
  isReady: boolean;
  init(): Promise<void>;
  process(video: HTMLVideoElement): Promise<PoseResult | null>;
  destroy(): void;
  getTrackingQuality(): number; // 0-100
  isFullBodyVisible(): boolean;
}

export type PoseCallback = (landmarks: PoseLandmark[]) => void;

/**
 * MediaPipe Pose Landmarker wrapper with advanced tracking features.
 * - Uses Heavy model for better accuracy
 * - Implements visibility gating to freeze low-confidence landmarks
 * - Smooths landmarks across frames to reduce jitter
 * - Checks for full-body visibility
 */
export function createPoseClient(config: PoseClientConfig = {}): PoseClient {
  const { enableSmoothing = true, enableVisibilityGating = true } = config;

  let ready = false;
  let landmarker: PoseLandmarker | null = null;
  let initPromise: Promise<void> | null = null;

  // State for visibility gating and smoothing
  let previousLandmarks: PoseLandmark[] | null = null;
  let trackingQuality = 0;
  let fullBodyVisible = false;

  /**
   * Apply exponential moving average smoothing with outlier rejection
   * to reduce jitter and prevent sudden position jumps
   */
  function smoothLandmarks(current: PoseLandmark[], previous: PoseLandmark[] | null): PoseLandmark[] {
    if (!previous || !enableSmoothing) return current;

    const alpha = CONFIG.SMOOTHING_FACTOR;
    const maxJump = CONFIG.MAX_POSITION_JUMP;

    return current.map((lm, i) => {
      const prev = previous[i];
      if (!prev) return lm;

      // Calculate position jump distance
      const dx = Math.abs(lm.x - prev.x);
      const dy = Math.abs(lm.y - prev.y);
      const jump = Math.sqrt(dx * dx + dy * dy);

      // If jump is too large (outlier), use heavier smoothing or freeze
      // This prevents landmarks from suddenly jumping to wrong positions
      if (jump > maxJump) {
        // Use very heavy smoothing for sudden jumps (essentially freeze position)
        const heavyAlpha = 0.1;
        return {
          x: heavyAlpha * lm.x + (1 - heavyAlpha) * prev.x,
          y: heavyAlpha * lm.y + (1 - heavyAlpha) * prev.y,
          z: heavyAlpha * lm.z + (1 - heavyAlpha) * prev.z,
          visibility: lm.visibility,
        };
      }

      // Normal smoothing
      return {
        x: alpha * lm.x + (1 - alpha) * prev.x,
        y: alpha * lm.y + (1 - alpha) * prev.y,
        z: alpha * lm.z + (1 - alpha) * prev.z,
        visibility: lm.visibility, // Don't smooth visibility
      };
    });
  }

  /**
   * Apply visibility gating: freeze low-confidence landmarks using last good values
   */
  function applyVisibilityGating(current: PoseLandmark[], previous: PoseLandmark[] | null): PoseLandmark[] {
    if (!previous || !enableVisibilityGating) return current;

    return current.map((lm, i) => {
      const prev = previous[i];
      const visibility = lm.visibility ?? 1;

      // If visibility is very low and we have a previous good value, freeze it
      if (visibility < CONFIG.VISIBILITY_THRESHOLD_LOW && prev && (prev.visibility ?? 1) > CONFIG.VISIBILITY_THRESHOLD_LOW) {
        return {
          ...prev,
          visibility: visibility, // Report actual visibility even though position is frozen
        };
      }

      return lm;
    });
  }

  /**
   * Calculate overall tracking quality (0-100) based on landmark visibility
   */
  function calculateTrackingQuality(landmarks: PoseLandmark[]): number {
    // Key landmarks for tracking quality (torso + legs)
    const keyIndices = [11, 12, 23, 24, 25, 26, 27, 28]; // shoulders, hips, knees, ankles

    let totalVisibility = 0;
    for (const idx of keyIndices) {
      totalVisibility += landmarks[idx]?.visibility ?? 0;
    }

    return Math.round((totalVisibility / keyIndices.length) * 100);
  }

  /**
   * Check if full body (head to feet) is visible in frame
   */
  function checkFullBodyVisible(landmarks: PoseLandmark[]): boolean {
    const head = landmarks[LANDMARK_HEAD];
    const leftAnkle = landmarks[LANDMARK_LEFT_ANKLE];
    const rightAnkle = landmarks[LANDMARK_RIGHT_ANKLE];

    if (!head || !leftAnkle || !rightAnkle) return false;

    // Check visibility of extremities
    const headVisible = (head.visibility ?? 0) > CONFIG.VISIBILITY_THRESHOLD_LOW;
    const leftAnkleVisible = (leftAnkle.visibility ?? 0) > CONFIG.VISIBILITY_THRESHOLD_LOW;
    const rightAnkleVisible = (rightAnkle.visibility ?? 0) > CONFIG.VISIBILITY_THRESHOLD_LOW;

    if (!headVisible || (!leftAnkleVisible && !rightAnkleVisible)) return false;

    // Check vertical coverage (Y coordinate range)
    const lowestAnkle = Math.max(leftAnkle.y, rightAnkle.y);
    const bodyCoverage = lowestAnkle - head.y;

    return bodyCoverage > CONFIG.BODY_COVERAGE_MIN;
  }

  return {
    get isReady() {
      return ready;
    },

    async init() {
      if (ready) return;
      if (initPromise) return initPromise;

      initPromise = (async () => {
        try {
          console.log('[PoseClient] Initializing with HEAVY model...');
          const vision = await FilesetResolver.forVisionTasks(WASM_URL);

          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'GPU', // Use GPU if available
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            // Higher confidence thresholds for better quality tracking
            minPoseDetectionConfidence: CONFIG.MIN_DETECTION_CONFIDENCE,
            minPosePresenceConfidence: CONFIG.MIN_PRESENCE_CONFIDENCE,
            minTrackingConfidence: CONFIG.MIN_TRACKING_CONFIDENCE,
            // Output segmentation for future use (can detect occlusion)
            outputSegmentationMasks: false, // Enable if needed for loose clothes detection
          });

          ready = true;
          console.log('[PoseClient] Initialized with HEAVY model, confidence thresholds:', {
            detection: CONFIG.MIN_DETECTION_CONFIDENCE,
            presence: CONFIG.MIN_PRESENCE_CONFIDENCE,
            tracking: CONFIG.MIN_TRACKING_CONFIDENCE,
          });
        } catch (error) {
          console.error('[PoseClient] Initialization failed', error);
          initPromise = null;
          throw error;
        }
      })();

      return initPromise;
    },

    async process(video: HTMLVideoElement): Promise<PoseResult | null> {
      if (!ready || !landmarker) return null;

      try {
        if (video.videoWidth === 0 || video.videoHeight === 0) return null;

        const now = performance.now();
        const result: PoseLandmarkerResult = landmarker.detectForVideo(video, now);

        const landmarks = result.landmarks?.[0];
        if (!landmarks) {
          trackingQuality = 0;
          fullBodyVisible = false;
          return null;
        }

        // Map MediaPipe format to our internal format
        let mappedLandmarks: PoseLandmark[] = landmarks.map((l) => ({
          x: l.x,
          y: l.y,
          z: l.z,
          visibility: l.visibility,
        }));

        // Apply visibility gating (freeze low-confidence landmarks)
        mappedLandmarks = applyVisibilityGating(mappedLandmarks, previousLandmarks);

        // Apply smoothing to reduce jitter
        mappedLandmarks = smoothLandmarks(mappedLandmarks, previousLandmarks);

        // Calculate tracking metrics
        trackingQuality = calculateTrackingQuality(mappedLandmarks);
        fullBodyVisible = checkFullBodyVisible(mappedLandmarks);

        // Store for next frame
        previousLandmarks = mappedLandmarks;

        // Include world landmarks if available (3D coordinates)
        const worldLandmarks = result.worldLandmarks?.[0]?.map((l) => ({
          x: l.x,
          y: l.y,
          z: l.z,
          visibility: l.visibility,
        }));

        return {
          landmarks: mappedLandmarks,
          worldLandmarks,
        };
      } catch (error) {
        console.error('[PoseClient] process error', error);
        return null;
      }
    },

    getTrackingQuality() {
      return trackingQuality;
    },

    isFullBodyVisible() {
      return fullBodyVisible;
    },

    destroy() {
      if (landmarker) {
        try {
          landmarker.close();
        } catch (e) {
          console.warn('[PoseClient] Error closing landmarker', e);
        }
        landmarker = null;
      }
      ready = false;
      initPromise = null;
      previousLandmarks = null;
      trackingQuality = 0;
      fullBodyVisible = false;
      console.log('[PoseClient] Destroyed');
    },
  };
}
