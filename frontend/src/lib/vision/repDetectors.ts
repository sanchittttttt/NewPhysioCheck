import {
  ExerciseType,
  PoseLandmark,
  RepEvent,
} from './types';
import {
  ema,
  hipFlexionAngle,
  kneeFlexionAngle,
  elbowFlexionAngle,
  torsoLeanAngle,
} from './angles';

export interface RepDetector {
  exercise: ExerciseType;
  reset(): void;
  update(args: { landmarks: PoseLandmark[]; timestampMs: number }): RepEvent | null;
}

type Phase = 'ready' | 'down' | 'bottom' | 'up';

const defaultAlpha = 0.3;

function tempoScoreFromDuration(durationMs: number, targetMs = 2500) {
  const ratio = durationMs / targetMs;
  if (ratio < 0.6) return 60;
  if (ratio > 1.6) return 70;
  return 90;
}

function accuracyFromRom(romMax: number, romTarget: number) {
  if (!romTarget) return 70;
  const pct = Math.min(romMax / romTarget, 1);
  return Math.round(60 + pct * 40); // 60-100 scaling
}

function formQualityFromFlags(flags: { shallow?: boolean; fast?: boolean; compensate?: boolean }) {
  if (flags.fast) return 'too_fast';
  if (flags.shallow) return 'too_shallow';
  if (flags.compensate) return 'compensated';
  return 'good';
}

// ---- Squat detector -------------------------------------------------------

export function createSquatRepDetector(): RepDetector {
  let phase: Phase = 'ready';
  let repIndex = 0;
  let romMax = 0;
  let smoothedKnee: number | null = null;
  let startTs = 0;
  const romTarget = 90; // target knee flexion

  return {
    exercise: 'squat',
    reset() {
      phase = 'ready';
      romMax = 0;
      smoothedKnee = null;
      startTs = 0;
    },
    update({ landmarks, timestampMs }): RepEvent | null {
      const [hip, knee, ankle] = [23, 25, 27]; // left side indices for MediaPipe
      if (!landmarks[hip] || !landmarks[knee] || !landmarks[ankle]) return null;

      const angle = kneeFlexionAngle(landmarks[hip], landmarks[knee], landmarks[ankle]);
      smoothedKnee = ema(smoothedKnee, angle, defaultAlpha);
      const val = smoothedKnee ?? angle;

      const deepEnough = val < 110;
      const bottom = val < 95;
      const nearStart = val > 155;

      romMax = Math.max(romMax, 180 - val); // convert to flexion depth

      if (phase === 'ready' && deepEnough) {
        phase = 'down';
        startTs = timestampMs;
      } else if (phase === 'down' && bottom) {
        phase = 'bottom';
      } else if (phase === 'bottom' && nearStart) {
        phase = 'up';
      } else if (phase === 'up' && nearStart) {
        phase = 'ready';
        repIndex += 1;

        const durationMs = Math.max(300, timestampMs - startTs);
        const accuracyScore = accuracyFromRom(romMax, romTarget);
        const tempoScore = tempoScoreFromDuration(durationMs);
        const shallow = romMax < romTarget * 0.8;
        const fast = durationMs < 1200;
        const formQuality = formQualityFromFlags({ shallow, fast });
        const errorSegment = shallow ? 'too_shallow' : fast ? 'too_fast' : undefined;

        const event: RepEvent = {
          exercise: 'squat',
          repIndex,
          romMax,
          romTarget,
          accuracyScore,
          durationMs,
          formQuality,
          errorSegment,
          timestampMs,
        };

        romMax = 0;
        return event;
      }

      return null;
    },
  };
}

// ---- Straight-leg raise detector -----------------------------------------

export function createSlrRepDetector(): RepDetector {
  let phase: Phase = 'ready';
  let repIndex = 0;
  let romMax = 0;
  let smoothedHip: number | null = null;
  let startTs = 0;
  const romTarget = 80;

  return {
    exercise: 'slr',
    reset() {
      phase = 'ready';
      romMax = 0;
      smoothedHip = null;
      startTs = 0;
    },
    update({ landmarks, timestampMs }): RepEvent | null {
      const [shoulder, hip, knee] = [11, 23, 25]; // left side
      if (!landmarks[shoulder] || !landmarks[hip] || !landmarks[knee]) return null;

      const hipAngle = hipFlexionAngle(landmarks[shoulder], landmarks[hip], landmarks[knee]);
      smoothedHip = ema(smoothedHip, hipAngle, defaultAlpha);
      const val = smoothedHip ?? hipAngle;

      const raising = val < 170; // start moving up from neutral
      const top = val < 100; // high flexion
      const backDown = val > 165;

      romMax = Math.max(romMax, 180 - val);

      if (phase === 'ready' && raising) {
        phase = 'down';
        startTs = timestampMs;
      } else if (phase === 'down' && top) {
        phase = 'bottom';
      } else if (phase === 'bottom' && backDown) {
        phase = 'up';
      } else if (phase === 'up' && backDown) {
        phase = 'ready';
        repIndex += 1;

        const durationMs = Math.max(300, timestampMs - startTs);
        const accuracyScore = accuracyFromRom(romMax, romTarget);
        const tempoScore = tempoScoreFromDuration(durationMs);
        const shallow = romMax < romTarget * 0.75;
        const fast = durationMs < 1200;
        const formQuality = formQualityFromFlags({ shallow, fast });
        const errorSegment = shallow ? 'too_shallow' : fast ? 'too_fast' : undefined;

        const event: RepEvent = {
          exercise: 'slr',
          repIndex,
          romMax,
          romTarget,
          accuracyScore,
          durationMs,
          formQuality,
          errorSegment,
          timestampMs,
        };

        romMax = 0;
        return event;
      }

      return null;
    },
  };
}

// ---- Shoulder flexion detector -------------------------------------------

// ---- Elbow flexion detector -------------------------------------------

export function createElbowFlexionRepDetector(): RepDetector {
  let phase: Phase = 'ready';
  let repIndex = 0;
  let romMax = 0;
  let smoothedElbow: number | null = null;
  let startTs = 0;
  const romTarget = 130; // approximate full range

  return {
    exercise: 'elbow_flexion',
    reset() {
      phase = 'ready';
      romMax = 0;
      smoothedElbow = null;
      startTs = 0;
    },
    update({ landmarks, timestampMs }): RepEvent | null {
      const [shoulder, elbow, wrist] = [11, 13, 15]; // left side
      if (!landmarks[shoulder] || !landmarks[elbow] || !landmarks[wrist]) return null;

      const angle = elbowFlexionAngle(landmarks[shoulder], landmarks[elbow], landmarks[wrist]);
      smoothedElbow = ema(smoothedElbow, angle, defaultAlpha);
      const val = smoothedElbow ?? angle;

      // 180 = extended, 30 = fully flexed
      const flexing = val < 160;
      const top = val < 60; // peak contraction
      const backDown = val > 150; // returned to extension

      romMax = Math.max(romMax, 180 - val);

      if (phase === 'ready' && flexing) {
        phase = 'down'; // using 'down' for concentric phase to reuse state names
        startTs = timestampMs;
      } else if (phase === 'down' && top) {
        phase = 'bottom'; // peak
      } else if (phase === 'bottom' && backDown) {
        phase = 'up'; // eccentric
      } else if (phase === 'up' && backDown) {
        phase = 'ready';
        repIndex += 1;

        const durationMs = Math.max(300, timestampMs - startTs);
        const accuracyScore = accuracyFromRom(romMax, romTarget);
        const tempoScore = tempoScoreFromDuration(durationMs);
        const shallow = romMax < romTarget * 0.75; // < ~100 deg flexion
        const fast = durationMs < 1200;

        const formQuality = formQualityFromFlags({ shallow, fast });
        const errorSegment = shallow ? 'too_shallow' : fast ? 'too_fast' : undefined;

        const event: RepEvent = {
          exercise: 'elbow_flexion',
          repIndex,
          romMax,
          romTarget,
          accuracyScore,
          durationMs,
          formQuality,
          errorSegment,
          timestampMs,
        };

        romMax = 0;
        return event;
      }

      return null;
    },
  };
}

