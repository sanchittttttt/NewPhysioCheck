import { RepEvent, SessionRepPayload } from './types';

/**
 * Map a RepEvent (from detectors) to the payload shape expected by the backend.
 */
export function repEventToSessionRep(event: RepEvent, exerciseId: string): SessionRepPayload {
  const tempoScore = (() => {
    // Simple tempo score: ideal duration ~2.5s
    const target = 2500;
    const ratio = event.durationMs / target;
    if (ratio < 0.6) return 60;
    if (ratio > 1.6) return 70;
    return 90;
  })();

  return {
    exerciseId,
    repIndex: event.repIndex,
    romMax: Math.round(event.romMax),
    romTarget: event.romTarget,
    accuracyScore: event.accuracyScore,
    tempoScore,
    formQuality: event.formQuality,
    errorSegment: event.errorSegment,
    timestampMs: event.timestampMs,
  };
}

