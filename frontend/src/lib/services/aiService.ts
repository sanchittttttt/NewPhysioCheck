/**
 * AI Insights Service - Pure Rule-based Implementation
 *
 * NOTE: There are **no external AI calls** here. All insights are generated
 * locally from pain, ROM, adherence and recent-session metrics so it works
 * 100% offline and never depends on Gemini/OpenAI.
 */

export interface PatientSessionData {
  patient_id: string;
  patient_name?: string;
  total_sessions: number;
  completed_sessions: number;
  recent_sessions: Array<{
    date: string;
    pain_score_pre: number | null;
    pain_score_post: number | null;
    rom_delta: number | null;
    accuracy_avg: number | null;
    exercises: Array<{
      name: string;
      reps: number;
      avg_accuracy: number;
      avg_rom: number;
    }>;
  }>;
  adherence_rate: number;
  pain_trend: 'increasing' | 'decreasing' | 'stable';
  rom_trend: 'improving' | 'declining' | 'stable';
}

export interface AIInsightSuggestion {
  insight_type: 'progress' | 'adherence' | 'pain' | 'form' | 'recommendation' | 'risk' | 'milestone';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  category: string;
  reasoning?: string;
}

/**
 * Rule-based insight generation
 */
function generateRuleBasedInsights(
  sessionData: PatientSessionData
): AIInsightSuggestion[] {
  const insights: AIInsightSuggestion[] = [];

  // 1) Adherence & engagement
  if (sessionData.adherence_rate < 70 && sessionData.total_sessions > 5) {
    insights.push({
      insight_type: 'adherence',
      title: 'Low Adherence Detected',
      description: `Patient has completed ${Math.round(sessionData.adherence_rate)}% of sessions. Consider checking in to understand any barriers to completion.`,
      severity: 'warning',
      category: 'engagement',
      reasoning: `Adherence rate of ${Math.round(sessionData.adherence_rate)}% is below the recommended 70% threshold.`,
    });
  } else if (sessionData.adherence_rate >= 90 && sessionData.total_sessions > 3) {
    insights.push({
      insight_type: 'adherence',
      title: 'Excellent Adherence',
      description: `Patient has maintained ${Math.round(sessionData.adherence_rate)}% adherence rate. This consistent engagement is contributing to positive outcomes.`,
      severity: 'success',
      category: 'engagement',
      reasoning: `Adherence rate of ${Math.round(sessionData.adherence_rate)}% exceeds the excellent threshold of 90%.`,
    });
  }

  // 2) Pain trend & safety
  if (sessionData.pain_trend === 'increasing') {
    const recentPain = sessionData.recent_sessions
      .filter(s => s.pain_score_post !== null)
      .map(s => s.pain_score_post as number);
    const avgPain = recentPain.length > 0
      ? recentPain.reduce((a, b) => a + b, 0) / recentPain.length
      : 0;

    if (avgPain > 6) {
      insights.push({
        insight_type: 'risk',
        title: 'Critical: Increasing Pain Levels',
        description: `Patient's pain scores are increasing and averaging ${avgPain.toFixed(1)}/10. Immediate review of exercise intensity and form is recommended. Consider pausing or modifying the protocol.`,
        severity: 'critical',
        category: 'safety',
        reasoning: `Pain trend is increasing with average score of ${avgPain.toFixed(1)}/10, indicating potential safety concern.`,
      });
    } else {
      insights.push({
        insight_type: 'pain',
        title: 'Pain Score Increase Detected',
        description: `Average pain score has increased in recent sessions. Review exercise intensity and patient form. Consider reducing load or adding rest days.`,
        severity: 'warning',
        category: 'safety',
        reasoning: `Pain trend shows increase with average score of ${avgPain.toFixed(1)}/10.`,
      });
    }
  } else if (sessionData.pain_trend === 'decreasing') {
    insights.push({
      insight_type: 'progress',
      title: 'Pain Reduction Progress',
      description: `Patient is showing positive response to treatment with decreasing pain scores. Continue current protocol with monitoring.`,
      severity: 'success',
      category: 'progress',
      reasoning: 'Pain trend is decreasing, indicating positive treatment response.',
    });
  }

  // 3) ROM trend / progress
  if (sessionData.rom_trend === 'improving') {
    const recentROM = sessionData.recent_sessions
      .filter(s => s.rom_delta !== null)
      .map(s => s.rom_delta as number);
    const avgROM = recentROM.length > 0
      ? recentROM.reduce((a, b) => a + b, 0) / recentROM.length
      : 0;

    if (avgROM > 5) {
      insights.push({
        insight_type: 'progress',
        title: 'Strong ROM Improvement',
        description: `Patient is showing consistent ROM improvements averaging ${avgROM.toFixed(1)}° per session. Excellent progress! Consider gradually increasing exercise difficulty.`,
        severity: 'success',
        category: 'performance',
        reasoning: `ROM trend is improving with average delta of ${avgROM.toFixed(1)}° per session.`,
      });
    }
  } else if (sessionData.rom_trend === 'declining') {
    insights.push({
      insight_type: 'risk',
      title: 'ROM Decline Detected',
      description: `Patient's ROM is declining. Review exercise form, check for pain, and consider protocol modifications.`,
      severity: 'warning',
      category: 'performance',
      reasoning: 'ROM trend is declining, which may indicate form issues or other concerns.',
    });
  }

  // 4) Milestone insights
  if (sessionData.completed_sessions === 10 || sessionData.completed_sessions === 25 || sessionData.completed_sessions === 50) {
    insights.push({
      insight_type: 'milestone',
      title: `Milestone: ${sessionData.completed_sessions} Sessions Completed`,
      description: `Congratulations! Patient has completed ${sessionData.completed_sessions} sessions. This is a significant achievement in their rehabilitation journey.`,
      severity: 'success',
      category: 'engagement',
      reasoning: `Patient reached milestone of ${sessionData.completed_sessions} completed sessions.`,
    });
  }

  // 5) Form/accuracy insights
  const recentAccuracy = sessionData.recent_sessions
    .filter(s => s.accuracy_avg !== null)
    .map(s => s.accuracy_avg as number);
  const avgAccuracy = recentAccuracy.length > 0
    ? recentAccuracy.reduce((a, b) => a + b, 0) / recentAccuracy.length
    : 0;

  if (avgAccuracy < 75 && recentAccuracy.length > 2) {
    insights.push({
      insight_type: 'form',
      title: 'Form Accuracy Below Target',
      description: `Average exercise form accuracy is ${avgAccuracy.toFixed(1)}%, below the recommended 70%. Consider reviewing exercise technique with the patient or adjusting exercise difficulty.`,
      severity: 'warning',
      category: 'performance',
      reasoning: `Average accuracy of ${avgAccuracy.toFixed(1)}% indicates form issues that may affect outcomes.`,
    });
  }

  // 6) Session‑level encouragement / recommendations based on the most recent session
  if (sessionData.recent_sessions.length > 0) {
    const last = sessionData.recent_sessions[0];

    if (
      last.rom_delta !== null &&
      last.rom_delta > 5 &&
      last.pain_score_pre !== null &&
      last.pain_score_post !== null &&
      last.pain_score_post < last.pain_score_pre
    ) {
      insights.push({
        insight_type: 'milestone',
        title: 'Milestone: Better ROM With Lower Pain',
        description: 'The latest session shows a meaningful ROM gain together with reduced pain. This is a strong indicator that the current rehab plan is effective.',
        severity: 'success',
        category: 'progress',
        reasoning: `ROM improved by ${last.rom_delta}° and pain decreased from ${last.pain_score_pre} to ${last.pain_score_post}.`,
      });
    }
  }

  // 7) Ensure at least one high‑level insight
  if (insights.length === 0) {
    insights.push({
      insight_type: 'progress',
      title: 'Stable Rehabilitation Status',
      description: 'Patient’s rehabilitation metrics are stable with no major changes in pain or ROM. Maintain the current protocol and continue to monitor adherence.',
      severity: 'info',
      category: 'progress',
      reasoning: 'No significant negative trends in pain, ROM, or adherence were detected.',
    });
  }

  return insights;
}

export const aiService = {
  // Now always rule‑based – no external AI calls.
  generateInsights: generateRuleBasedInsights,
  isAIConfigured: false,
};

