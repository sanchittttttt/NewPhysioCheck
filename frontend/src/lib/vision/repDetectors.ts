import {
  ExerciseType,
  PoseLandmark,
} from './types';
import {
  ema,
  hipFlexionAngle,
  kneeFlexionAngle,
  elbowFlexionAngle,
} from './angles';

// --- DIFFICULTY LEVELS ---
export type DifficultyLevel = 'easy' | 'normal' | 'hard';

// --- CONFIGURATION CONSTANTS (By Difficulty) ---

// SQUAT THRESHOLDS
export const SQUAT_THRESHOLDS = {
  easy: { down: 130, bottom: 115, up: 150 },
  normal: { down: 110, bottom: 95, up: 160 },
  hard: { down: 100, bottom: 85, up: 165 },
};

// STRAIGHT LEG RAISE (SLR) THRESHOLDS
export const SLR_THRESHOLDS = {
  easy: { up: 170, top: 135, down: 170 },
  normal: { up: 165, top: 110, down: 165 },
  hard: { up: 160, top: 95, down: 160 },
};

// ELBOW FLEXION (CURL) THRESHOLDS
export const ELBOW_THRESHOLDS = {
  easy: { flex: 160, top: 80, ext: 155 },
  normal: { flex: 150, top: 60, ext: 160 },
  hard: { flex: 140, top: 45, ext: 165 },
};

// GLOBAL SETTINGS
const DEBUG_REPS = true; // Enable for debugging
const DEFAULT_ALPHA = 0.3; // Smoothing factor (0.1 = very smooth/laggy, 1.0 = raw)
const MIN_REP_DURATION_MS = 300; // Debounce rapid spikes
const TARGET_REP_DURATION_MS = 2500; // For tempo scoring
const MIN_VISIBILITY = 0.5; // Minimum landmark visibility threshold

// --- TYPES ---

export interface PersonalizedROM {
  bestAchieved: number;
  avgAchieved: number;
  repCount: number;
  targetROM: number; // Adaptive target based on user's ability
}

export interface ErrorSpotlight {
  limbSegment: 'left_knee' | 'right_knee' | 'left_hip' | 'right_hip' | 'torso' | 'left_elbow' | 'right_elbow' | null;
  errorMagnitude: number; // 0-1 (0 = no error, 1 = major error)
  correctionDirection: { x: number; y: number }; // Normalized arrow vector
  message: string;
}

export interface RepOutput {
  repCount: number;
  feedback: string;
  // Details about the *last completed* rep
  lastRep?: {
    maxAngle: number; // For ROM calculation
    minAngle: number;
    formScore: number;
    tempoScore: number; // NEW: 0-100 tempo quality
  };
  // Live data for UI feedback
  currentAngle?: number;
  // Personalized ROM tracking
  personalizedROM?: PersonalizedROM;
  // Error spotlight for visual feedback
  errorSpotlight?: ErrorSpotlight;
  // Debug info
  debug?: string;
}

export interface RepDetector {
  exercise: ExerciseType;
  difficulty: DifficultyLevel;
  reset(): void;
  setDifficulty(level: DifficultyLevel): void;
  update(args: { landmarks: PoseLandmark[]; timestampMs: number }): RepOutput;
  getPersonalizedROM(): PersonalizedROM;
}

type Phase = 'ready' | 'down' | 'bottom' | 'up';

// --- HELPERS ---

function isLandmarkVisible(lm: PoseLandmark | undefined): boolean {
  if (!lm) return false;
  return (lm.visibility ?? 1) > MIN_VISIBILITY;
}

function calculateTempoScore(durationMs: number): number {
  // Ideal rep duration: 2-3 seconds
  // Too fast (<1s): Poor control, score 20-40
  // Good range (1.5-3.5s): Good control, score 70-100
  // Too slow (>4s): Acceptable but not ideal, score 50-70

  if (durationMs < 500) return 20; // Way too fast
  if (durationMs < 1000) return 40; // Too fast
  if (durationMs < 1500) return 60; // Slightly fast
  if (durationMs < 2000) return 85; // Good
  if (durationMs < 3000) return 100; // Excellent - controlled
  if (durationMs < 4000) return 80; // Slightly slow but controlled
  if (durationMs < 5000) return 60; // Too slow
  return 40; // Way too slow
}

function calculateFormScore(
  romVal: number, // The ROM we achieved (degrees)
  romTarget: number, // The target ROM
  tempoScore: number
): number {
  // ROM score (0-70pts)
  const romRatio = Math.min(romVal / romTarget, 1.2); // Cap at 120%
  const romScore = Math.min(romRatio * 70, 70);

  // Tempo score (0-30pts) - scaled from 0-100 to 0-30
  const tempoContribution = (tempoScore / 100) * 30;

  return Math.round(romScore + tempoContribution);
}

function updatePersonalizedROM(
  current: PersonalizedROM,
  achievedAngle: number
): PersonalizedROM {
  const newRepCount = current.repCount + 1;
  const newBest = Math.max(current.bestAchieved, achievedAngle);
  const newAvg = ((current.avgAchieved * current.repCount) + achievedAngle) / newRepCount;

  // Target is 80% of best achieved, minimum 60 degrees ROM
  const newTarget = Math.max(newBest * 0.8, 60);

  return {
    bestAchieved: newBest,
    avgAchieved: newAvg,
    repCount: newRepCount,
    targetROM: newTarget,
  };
}

function getSquatErrorSpotlight(
  landmarks: PoseLandmark[],
  kneeAngle: number,
  targetAngle: number,
  side: 'left' | 'right',
  phase: Phase
): ErrorSpotlight {
  // Only show error spotlight during 'down' phase when user should be going lower
  // Skip ready, bottom, and up phases to avoid false positives
  if (phase !== 'down') {
    return { limbSegment: null, errorMagnitude: 0, correctionDirection: { x: 0, y: 0 }, message: '' };
  }

  let errorMagnitude = 0;
  let message = '';
  let limbSegment: ErrorSpotlight['limbSegment'] = null;
  let correctionDirection = { x: 0, y: 0 };

  // NOTE: Torso lean detection DISABLED - the torsoLeanAngle() function uses
  // 2D X-coordinate deviation which gives false positives with:
  // - Front-facing cameras (can't detect forward/backward lean)
  // - Natural posture variations
  // - Camera angle differences
  // A proper implementation would need 3D world coordinates or side-view camera

  // Only show feedback when significantly above target (very forgiving)
  if (kneeAngle > targetAngle + 25) {
    errorMagnitude = Math.min((kneeAngle - targetAngle) / 80, 0.8); // Cap at 0.8 for subtlety
    message = `Go lower (${Math.round(kneeAngle)}°)`;
    limbSegment = side === 'left' ? 'left_knee' : 'right_knee';
    correctionDirection = { x: 0, y: 1 }; // Arrow pointing down
  }

  return { limbSegment, errorMagnitude, correctionDirection, message };
}

function getSlrErrorSpotlight(
  landmarks: PoseLandmark[],
  hipAngle: number,
  targetAngle: number,
  side: 'left' | 'right'
): ErrorSpotlight {
  let errorMagnitude = 0;
  let message = '';
  let limbSegment: ErrorSpotlight['limbSegment'] = null;
  let correctionDirection = { x: 0, y: 0 };

  // Not high enough
  if (hipAngle > targetAngle + 15) {
    errorMagnitude = Math.min((hipAngle - targetAngle) / 50, 1);
    message = `Lift higher (${Math.round(hipAngle)}° → ${targetAngle}°)`;
    limbSegment = side === 'left' ? 'left_hip' : 'right_hip';
    correctionDirection = { x: 0, y: -1 }; // Arrow pointing up (leg going higher)
  }

  return { limbSegment, errorMagnitude, correctionDirection, message };
}

function getElbowErrorSpotlight(
  elbowAngle: number,
  targetAngle: number,
  side: 'left' | 'right'
): ErrorSpotlight {
  let errorMagnitude = 0;
  let message = '';
  let limbSegment: ErrorSpotlight['limbSegment'] = null;
  let correctionDirection = { x: 0, y: 0 };

  // Not curled enough
  if (elbowAngle > targetAngle + 20) {
    errorMagnitude = Math.min((elbowAngle - targetAngle) / 60, 1);
    message = `Curl higher (${Math.round(elbowAngle)}° → ${targetAngle}°)`;
    limbSegment = side === 'left' ? 'left_elbow' : 'right_elbow';
    correctionDirection = { x: 0, y: -1 }; // Arrow pointing up
  }

  return { limbSegment, errorMagnitude, correctionDirection, message };
}

function getFeedback(
  phase: Phase,
  currentAngle: number,
  targetAngle: number,
  exercise: ExerciseType,
  personalizedROM?: PersonalizedROM
): string {
  const angleStr = Math.round(currentAngle);
  const targetStr = Math.round(targetAngle);
  const personalTarget = personalizedROM?.targetROM
    ? Math.round(personalizedROM.targetROM)
    : targetStr;

  if (phase === 'ready') {
    switch (exercise) {
      case 'squat':
        return 'Stand facing camera, feet shoulder-width apart';
      case 'slr':
        return 'Lie flat on your back, keep leg straight';
      case 'elbow_flexion':
        return 'Stand with arm at side, palm facing forward';
      default:
        return 'Get into starting position';
    }
  }

  if (exercise === 'squat') {
    if (phase === 'down') {
      const diff = angleStr - targetStr;
      if (diff < 10) return `Almost there! (${angleStr}°)`;
      return `Push hips back, bend knees (${angleStr}° → ${targetStr}°)`;
    }
    if (phase === 'bottom') return `Great depth! Hold briefly... (${angleStr}°)`;
    if (phase === 'up') return 'Push through heels, stand tall!';
  }

  if (exercise === 'slr') {
    if (phase === 'down') {
      const diff = angleStr - targetStr;
      if (diff < 15) return `Good height! (${angleStr}°)`;
      return `Lift leg higher (${angleStr}° → ${targetStr}°)`;
    }
    if (phase === 'bottom') return `Hold at top... (${angleStr}°)`;
    if (phase === 'up') return 'Lower slowly with control';
  }

  if (exercise === 'elbow_flexion') {
    if (phase === 'down') {
      const diff = angleStr - targetStr;
      if (diff < 15) return `Good squeeze! (${angleStr}°)`;
      return `Curl up more (${angleStr}° → ${targetStr}°)`;
    }
    if (phase === 'bottom') return `Squeeze! (${angleStr}°)`;
    if (phase === 'up') return 'Extend arm slowly with control';
  }

  return 'Move steadily';
}

function debugLog(tag: string, ...args: any[]) {
  if (DEBUG_REPS) {
    console.debug(`[${tag}]`, ...args);
  }
}

// --- DETECTORS ---

export function createSquatRepDetector(
  side: 'left' | 'right' = 'left',
  initialDifficulty: DifficultyLevel = 'easy'
): RepDetector {
  let difficulty = initialDifficulty;
  let phase: Phase = 'ready';
  let repCount = 0;
  let minAngleObserved = 180; // Track deepest point (lowest angle)
  let smoothedAngle: number | null = null;
  let startTs = 0;
  let lastRepData: RepOutput['lastRep'] | undefined;
  let personalizedROM: PersonalizedROM = {
    bestAchieved: 0,
    avgAchieved: 0,
    repCount: 0,
    targetROM: 90, // Default target
  };

  // MediaPipe Body Indices
  const idxHip = side === 'left' ? 23 : 24;
  const idxKnee = side === 'left' ? 25 : 26;
  const idxAnkle = side === 'left' ? 27 : 28;

  const getThresholds = () => SQUAT_THRESHOLDS[difficulty];

  return {
    exercise: 'squat',
    get difficulty() { return difficulty; },

    setDifficulty(level: DifficultyLevel) {
      difficulty = level;
      debugLog('SQUAT', 'Difficulty changed to', level, getThresholds());
    },

    reset() {
      phase = 'ready';
      repCount = 0;
      minAngleObserved = 180;
      smoothedAngle = null;
      lastRepData = undefined;
      // Keep personalizedROM for learning across session
    },

    getPersonalizedROM() {
      return personalizedROM;
    },

    update({ landmarks, timestampMs }) {
      const hip = landmarks[idxHip];
      const knee = landmarks[idxKnee];
      const ankle = landmarks[idxAnkle];

      // Visibility check
      if (!isLandmarkVisible(hip) || !isLandmarkVisible(knee) || !isLandmarkVisible(ankle)) {
        return {
          repCount,
          feedback: 'Move so your full body is visible in camera',
          personalizedROM,
        };
      }

      const thresholds = getThresholds();
      const rawAngle = kneeFlexionAngle(hip, knee, ankle);
      smoothedAngle = ema(smoothedAngle, rawAngle, DEFAULT_ALPHA);
      const angle = smoothedAngle!;

      // Calculate error spotlight
      const errorSpotlight = getSquatErrorSpotlight(
        landmarks,
        angle,
        thresholds.bottom,
        side,
        phase
      );

      // State Machine
      if (phase === 'ready') {
        if (angle < thresholds.down) {
          phase = 'down';
          startTs = timestampMs;
          minAngleObserved = angle;
          debugLog('SQUAT', 'Started rep', timestampMs);
        }
      } else {
        minAngleObserved = Math.min(minAngleObserved, angle);

        if (phase === 'down') {
          if (angle < thresholds.bottom) {
            phase = 'bottom';
            debugLog('SQUAT', 'Hit bottom', angle);
          } else if (angle > thresholds.up) {
            phase = 'ready'; // Aborted
          }
        } else if (phase === 'bottom') {
          if (angle > thresholds.bottom + 10) {
            phase = 'up';
            debugLog('SQUAT', 'Going up');
          }
        } else if (phase === 'up') {
          if (angle > thresholds.up) {
            const duration = timestampMs - startTs;
            if (duration > MIN_REP_DURATION_MS) {
              repCount++;

              const romAchieved = 180 - minAngleObserved;
              const romTarget = 180 - thresholds.bottom;
              const tempoScore = calculateTempoScore(duration);
              const formScore = calculateFormScore(romAchieved, romTarget, tempoScore);

              // Update personalized ROM
              personalizedROM = updatePersonalizedROM(personalizedROM, romAchieved);

              lastRepData = {
                minAngle: minAngleObserved,
                maxAngle: 180,
                formScore,
                tempoScore,
              };
              debugLog('SQUAT', 'Rep completed', lastRepData, 'Personalized:', personalizedROM);
            }
            phase = 'ready';
            minAngleObserved = 180;
          }
        }
      }

      return {
        repCount,
        feedback: getFeedback(phase, angle, thresholds.bottom, 'squat', personalizedROM),
        lastRep: lastRepData,
        currentAngle: Math.round(angle),
        personalizedROM,
        errorSpotlight: phase !== 'ready' ? errorSpotlight : undefined,
      };
    }
  };
}

export function createSlrRepDetector(
  side: 'left' | 'right' = 'left',
  initialDifficulty: DifficultyLevel = 'easy'
): RepDetector {
  let difficulty = initialDifficulty;
  let phase: Phase = 'ready';
  let repCount = 0;
  let minAngleObserved = 180;
  let smoothedAngle: number | null = null;
  let startTs = 0;
  let lastRepData: RepOutput['lastRep'] | undefined;
  let personalizedROM: PersonalizedROM = {
    bestAchieved: 0,
    avgAchieved: 0,
    repCount: 0,
    targetROM: 70,
  };

  const idxShoulder = side === 'left' ? 11 : 12;
  const idxHip = side === 'left' ? 23 : 24;
  const idxKnee = side === 'left' ? 25 : 26;

  const getThresholds = () => SLR_THRESHOLDS[difficulty];

  return {
    exercise: 'slr',
    get difficulty() { return difficulty; },

    setDifficulty(level: DifficultyLevel) {
      difficulty = level;
      debugLog('SLR', 'Difficulty changed to', level);
    },

    reset() {
      phase = 'ready';
      repCount = 0;
      minAngleObserved = 180;
      smoothedAngle = null;
      lastRepData = undefined;
    },

    getPersonalizedROM() {
      return personalizedROM;
    },

    update({ landmarks, timestampMs }) {
      const shoulder = landmarks[idxShoulder];
      const hip = landmarks[idxHip];
      const knee = landmarks[idxKnee];

      if (!isLandmarkVisible(shoulder) || !isLandmarkVisible(hip) || !isLandmarkVisible(knee)) {
        return {
          repCount,
          feedback: 'Lie flat - ensure hip and leg are visible',
          personalizedROM,
        };
      }

      const thresholds = getThresholds();
      const rawAngle = hipFlexionAngle(shoulder, hip, knee);
      smoothedAngle = ema(smoothedAngle, rawAngle, DEFAULT_ALPHA);
      const angle = smoothedAngle!;

      const errorSpotlight = getSlrErrorSpotlight(landmarks, angle, thresholds.top, side);

      // SLR: Lie flat (hip ~180). Lift leg (angle decreases).
      if (phase === 'ready') {
        if (angle < thresholds.up) {
          phase = 'down';
          startTs = timestampMs;
          minAngleObserved = angle;
        }
      } else {
        minAngleObserved = Math.min(minAngleObserved, angle);

        if (phase === 'down') {
          if (angle < thresholds.top) {
            phase = 'bottom';
          } else if (angle > thresholds.down) {
            phase = 'ready';
          }
        } else if (phase === 'bottom') {
          if (angle > thresholds.top + 10) {
            phase = 'up';
          }
        } else if (phase === 'up') {
          if (angle > thresholds.down) {
            const duration = timestampMs - startTs;
            if (duration > MIN_REP_DURATION_MS) {
              repCount++;
              const romAchieved = 180 - minAngleObserved;
              const romTarget = 180 - thresholds.top;
              const tempoScore = calculateTempoScore(duration);
              const formScore = calculateFormScore(romAchieved, romTarget, tempoScore);

              personalizedROM = updatePersonalizedROM(personalizedROM, romAchieved);

              lastRepData = {
                minAngle: minAngleObserved,
                maxAngle: 180,
                formScore,
                tempoScore,
              };
            }
            phase = 'ready';
            minAngleObserved = 180;
          }
        }
      }

      return {
        repCount,
        feedback: getFeedback(phase, angle, thresholds.top, 'slr', personalizedROM),
        lastRep: lastRepData,
        currentAngle: Math.round(angle),
        personalizedROM,
        errorSpotlight: phase !== 'ready' ? errorSpotlight : undefined,
      };
    }
  };
}

export function createElbowFlexionRepDetector(
  side: 'left' | 'right' = 'left',
  initialDifficulty: DifficultyLevel = 'easy'
): RepDetector {
  let difficulty = initialDifficulty;
  let phase: Phase = 'ready';
  let repCount = 0;
  let minAngleObserved = 180;
  let smoothedAngle: number | null = null;
  let startTs = 0;
  let lastRepData: RepOutput['lastRep'] | undefined;
  let personalizedROM: PersonalizedROM = {
    bestAchieved: 0,
    avgAchieved: 0,
    repCount: 0,
    targetROM: 120,
  };

  const idxShoulder = side === 'left' ? 11 : 12;
  const idxElbow = side === 'left' ? 13 : 14;
  const idxWrist = side === 'left' ? 15 : 16;

  const getThresholds = () => ELBOW_THRESHOLDS[difficulty];

  return {
    exercise: 'elbow_flexion',
    get difficulty() { return difficulty; },

    setDifficulty(level: DifficultyLevel) {
      difficulty = level;
      debugLog('ELBOW', 'Difficulty changed to', level);
    },

    reset() {
      phase = 'ready';
      repCount = 0;
      minAngleObserved = 180;
      smoothedAngle = null;
      lastRepData = undefined;
    },

    getPersonalizedROM() {
      return personalizedROM;
    },

    update({ landmarks, timestampMs }) {
      const shoulder = landmarks[idxShoulder];
      const elbow = landmarks[idxElbow];
      const wrist = landmarks[idxWrist];

      if (!isLandmarkVisible(shoulder) || !isLandmarkVisible(elbow) || !isLandmarkVisible(wrist)) {
        return {
          repCount,
          feedback: 'Show your full arm to the camera',
          personalizedROM,
        };
      }

      const thresholds = getThresholds();
      const rawAngle = elbowFlexionAngle(shoulder, elbow, wrist);
      smoothedAngle = ema(smoothedAngle, rawAngle, DEFAULT_ALPHA);
      const angle = smoothedAngle!;

      const errorSpotlight = getElbowErrorSpotlight(angle, thresholds.top, side);

      // Curl: arm straight (~180). Flex (angle decreases).
      if (phase === 'ready') {
        if (angle < thresholds.flex) {
          phase = 'down';
          startTs = timestampMs;
          minAngleObserved = angle;
        }
      } else {
        minAngleObserved = Math.min(minAngleObserved, angle);

        if (phase === 'down') {
          if (angle < thresholds.top) {
            phase = 'bottom';
          } else if (angle > thresholds.ext) {
            phase = 'ready';
          }
        } else if (phase === 'bottom') {
          if (angle > thresholds.top + 15) {
            phase = 'up';
          }
        } else if (phase === 'up') {
          if (angle > thresholds.ext) {
            const duration = timestampMs - startTs;
            if (duration > MIN_REP_DURATION_MS) {
              repCount++;
              const romAchieved = 180 - minAngleObserved;
              const romTarget = 180 - thresholds.top;
              const tempoScore = calculateTempoScore(duration);
              const formScore = calculateFormScore(romAchieved, romTarget, tempoScore);

              personalizedROM = updatePersonalizedROM(personalizedROM, romAchieved);

              lastRepData = {
                minAngle: minAngleObserved,
                maxAngle: 180,
                formScore,
                tempoScore,
              };
            }
            phase = 'ready';
            minAngleObserved = 180;
          }
        }
      }

      return {
        repCount,
        feedback: getFeedback(phase, angle, thresholds.top, 'elbow_flexion', personalizedROM),
        lastRep: lastRepData,
        currentAngle: Math.round(angle),
        personalizedROM,
        errorSpotlight: phase !== 'ready' ? errorSpotlight : undefined,
      };
    }
  };
}
