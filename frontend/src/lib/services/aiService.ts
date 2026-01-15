/**
 * External AI Service Wrapper
 * 
 * Connects to Google Gemini API to generate sophisticated insights.
 * Falls back to rule-based generation if Gemini API is not configured.
 */

// Google Gemini Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = import.meta.env.VITE_GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const USE_AI_SERVICE = import.meta.env.VITE_USE_AI_SERVICE === 'true' && !!GEMINI_API_KEY;

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
 * Generate AI insights using Google Gemini
 */
async function generateInsightsWithGemini(
  sessionData: PatientSessionData
): Promise<AIInsightSuggestion[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const prompt = `You are an AI assistant specialized in physiotherapy and rehabilitation. 
Analyze patient session data and generate actionable insights for healthcare providers.

Generate insights that are:
- Clinically relevant and evidence-based
- Actionable for doctors
- Patient-friendly when appropriate
- Prioritized by severity (critical > warning > info > success)

Return insights in JSON format as a JSON object with an "insights" array. Each insight should have:
- insight_type: one of 'progress', 'adherence', 'pain', 'form', 'recommendation', 'risk', 'milestone'
- title: concise title (max 60 chars)
- description: detailed description (2-4 sentences)
- severity: 'critical', 'warning', 'info', or 'success'
- category: e.g., 'safety', 'performance', 'engagement', 'progress'
- reasoning: brief explanation of why this insight was generated (optional)

Focus on:
1. Safety concerns (pain increases, form issues)
2. Progress milestones and achievements
3. Adherence patterns
4. Recommendations for protocol adjustments
5. Risk factors that need attention

**CRITICAL METRICS TO ANALYZE:**
- **Pain Levels**: Pre-session vs Post-session pain scores (0-10 scale). Increasing pain may indicate overexertion or injury risk.
- **Range of Motion (ROM)**: ROM delta per session shows joint mobility improvement. Positive trends indicate recovery progress.
- **Pain Trends**: Compare recent sessions vs older sessions to identify worsening or improving pain patterns.
- **ROM Trends**: Track ROM improvements/declines to assess rehabilitation effectiveness.

Analyze this patient's rehabilitation data:

Patient: ${sessionData.patient_name || sessionData.patient_id}
Total Sessions: ${sessionData.total_sessions}
Completed Sessions: ${sessionData.completed_sessions}
Adherence Rate: ${sessionData.adherence_rate.toFixed(1)}%

**TREND ANALYSIS:**
- Pain Trend: ${sessionData.pain_trend} (comparing recent vs older sessions)
- ROM Trend: ${sessionData.rom_trend} (comparing recent vs older sessions)

**RECENT SESSION DETAILS:**
${sessionData.recent_sessions.map((s, i) => `
Session ${i + 1} (${s.date}):
  - Pain Score: ${s.pain_score_pre !== null ? s.pain_score_pre : 'N/A'} (pre) → ${s.pain_score_post !== null ? s.pain_score_post : 'N/A'} (post) ${s.pain_score_pre !== null && s.pain_score_post !== null ? `[Change: ${(s.pain_score_post - s.pain_score_pre).toFixed(1)}]` : ''}
  - ROM Delta: ${s.rom_delta !== null ? `${s.rom_delta}°` : 'N/A'} (range of motion improvement)
  - Form Accuracy: ${s.accuracy_avg !== null ? `${s.accuracy_avg}%` : 'N/A'}
  - Exercises Performed:
${s.exercises.map(e => `    • ${e.name}: ${e.reps} reps, ${e.avg_rom !== null ? `${e.avg_rom}° ROM` : 'ROM N/A'}, ${e.avg_accuracy !== null ? `${e.avg_accuracy}% accuracy` : 'accuracy N/A'}`).join('\n')}
`).join('\n')}

**ANALYSIS REQUIREMENTS:**
- Pay special attention to pain score increases (especially if post-session pain > 6/10)
- Identify ROM improvement patterns (consistent gains indicate good progress)
- Flag any sessions where pain increased significantly (>2 points)
- Highlight ROM improvements (>5° per session indicates strong progress)
- Consider the relationship between pain and ROM (high pain may limit ROM gains)

Generate 3-7 insights. Prioritize critical safety issues first (especially pain increases). Return ONLY valid JSON, no markdown formatting.`;

  try {
    const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Extract text from Gemini response
    let contentText = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      contentText = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid Gemini response format');
    }

    // Parse JSON response
    let parsedContent;
    try {
      // Remove markdown code blocks if present
      contentText = contentText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedContent = JSON.parse(contentText);
    } catch (parseError) {
      console.error('[AIService] Failed to parse Gemini JSON:', contentText);
      throw new Error('Failed to parse Gemini response as JSON');
    }
    
    // Handle both array and object with 'insights' key
    const insights = Array.isArray(parsedContent) ? parsedContent : (parsedContent.insights || []);
    
    return insights.map((insight: any) => ({
      insight_type: insight.insight_type || 'recommendation',
      title: insight.title || 'Insight',
      description: insight.description || '',
      severity: insight.severity || 'info',
      category: insight.category || 'general',
      reasoning: insight.reasoning,
    })) as AIInsightSuggestion[];
  } catch (error) {
    console.error('[AIService] Gemini API error:', error);
    throw error;
  }
}

/**
 * Generate insights using Google Gemini API or fallback to rule-based
 */
export async function generateAIInsights(
  sessionData: PatientSessionData
): Promise<AIInsightSuggestion[]> {
  if (USE_AI_SERVICE) {
    try {
      console.log('[AIService] Using Google Gemini to generate insights');
      return await generateInsightsWithGemini(sessionData);
    } catch (error) {
      console.warn('[AIService] Gemini failed, falling back to rule-based generation:', error);
      // Fall through to rule-based generation
    }
  }

  // Fallback to rule-based generation
  console.log('[AIService] Using rule-based insight generation');
  return generateRuleBasedInsights(sessionData);
}

/**
 * Rule-based insight generation (fallback)
 */
function generateRuleBasedInsights(
  sessionData: PatientSessionData
): AIInsightSuggestion[] {
  const insights: AIInsightSuggestion[] = [];

  // Adherence insights
  if (sessionData.adherence_rate < 70 && sessionData.total_sessions > 5) {
    insights.push({
      insight_type: 'adherence',
      title: 'Low Adherence Detected',
      description: `Patient has completed ${Math.round(sessionData.adherence_rate)}% of sessions. Consider checking in to understand any barriers to completion.`,
      severity: 'warning',
      category: 'engagement',
      reasoning: `Adherence rate of ${Math.round(sessionData.adherence_rate)}% is below the recommended 70% threshold.`,
    });
  } else if (sessionData.adherence_rate >= 90 && sessionData.total_sessions > 5) {
    insights.push({
      insight_type: 'adherence',
      title: 'Excellent Adherence',
      description: `Patient has maintained ${Math.round(sessionData.adherence_rate)}% adherence rate. This consistent engagement is contributing to positive outcomes.`,
      severity: 'success',
      category: 'engagement',
      reasoning: `Adherence rate of ${Math.round(sessionData.adherence_rate)}% exceeds the excellent threshold of 90%.`,
    });
  }

  // Pain trend insights
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

  // ROM trend insights
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

  // Milestone insights
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

  // Form/accuracy insights
  const recentAccuracy = sessionData.recent_sessions
    .filter(s => s.accuracy_avg !== null)
    .map(s => s.accuracy_avg as number);
  const avgAccuracy = recentAccuracy.length > 0
    ? recentAccuracy.reduce((a, b) => a + b, 0) / recentAccuracy.length
    : 0;

  if (avgAccuracy < 70 && recentAccuracy.length > 3) {
    insights.push({
      insight_type: 'form',
      title: 'Form Accuracy Below Target',
      description: `Average exercise form accuracy is ${avgAccuracy.toFixed(1)}%, below the recommended 70%. Consider reviewing exercise technique with the patient or adjusting exercise difficulty.`,
      severity: 'warning',
      category: 'performance',
      reasoning: `Average accuracy of ${avgAccuracy.toFixed(1)}% indicates form issues that may affect outcomes.`,
    });
  }

  return insights;
}

export const aiService = {
  generateInsights: generateAIInsights,
  isAIConfigured: USE_AI_SERVICE,
};

