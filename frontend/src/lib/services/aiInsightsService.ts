/**
 * AI Insights Service
 * 
 * Handles AI-generated insights for patients based on their session data,
 * progress, adherence, pain scores, and exercise performance.
 */
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser } from '@/lib/demoAuth';
import { aiService, type PatientSessionData } from './aiService';

export interface AIInsight {
  id: string;
  patient_id: string;
  insight_type: 'progress' | 'adherence' | 'pain' | 'form' | 'recommendation' | 'risk' | 'milestone';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | 'success' | null;
  category: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  generated_at: string;
  expires_at: string | null;
  created_at: string;
}

export interface CreateAIInsightInput {
  patient_id: string;
  insight_type: AIInsight['insight_type'];
  title: string;
  description: string;
  severity?: AIInsight['severity'];
  category?: string;
  metadata?: Record<string, any>;
  expires_at?: string;
}

export interface GetInsightsOptions {
  patient_id?: string;
  insight_type?: AIInsight['insight_type'];
  severity?: AIInsight['severity'];
  include_read?: boolean;
  limit?: number;
}

/**
 * Get AI insights for a patient or all patients (for doctors)
 */
export async function getAIInsights(options: GetInsightsOptions = {}): Promise<{
  data: AIInsight[];
  error: any;
}> {
  try {
    let query = supabase
      .from('ai_insights')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by patient
    if (options.patient_id) {
      query = query.eq('patient_id', options.patient_id);
    }

    // Filter by type
    if (options.insight_type) {
      query = query.eq('insight_type', options.insight_type);
    }

    // Filter by severity
    if (options.severity) {
      query = query.eq('severity', options.severity);
    }

    // Filter read/unread
    if (options.include_read === false) {
      query = query.eq('is_read', false);
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AIInsightsService] getAIInsights error:', error);
      return { data: [], error };
    }

    // Filter expired insights
    const now = new Date().toISOString();
    const validInsights = (data || []).filter((insight: any) => {
      if (!insight.expires_at) return true;
      return new Date(insight.expires_at) > new Date(now);
    });

    return { data: validInsights as AIInsight[], error: null };
  } catch (e) {
    console.error('[AIInsightsService] getAIInsights exception:', e);
    return { data: [], error: e };
  }
}

/**
 * Create a new AI insight
 */
export async function createAIInsight(input: CreateAIInsightInput): Promise<{
  data: AIInsight | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('ai_insights')
      .insert({
        patient_id: input.patient_id,
        insight_type: input.insight_type,
        title: input.title,
        description: input.description,
        severity: input.severity || 'info',
        category: input.category || null,
        metadata: input.metadata || null,
        expires_at: input.expires_at || null,
        is_read: false,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[AIInsightsService] createAIInsight error:', error);
      return { data: null, error };
    }

    return { data: data as AIInsight, error: null };
  } catch (e) {
    console.error('[AIInsightsService] createAIInsight exception:', e);
    return { data: null, error: e };
  }
}

/**
 * Mark an insight as read
 */
export async function markInsightAsRead(insightId: string): Promise<{
  error: any;
}> {
  try {
    const query = supabase.from('ai_insights') as any;
    const { error } = await query.update({ is_read: true }).eq('id', insightId);

    if (error) {
      console.error('[AIInsightsService] markInsightAsRead error:', error);
      return { error };
    }

    return { error: null };
  } catch (e) {
    console.error('[AIInsightsService] markInsightAsRead exception:', e);
    return { error: e };
  }
}

/**
 * Mark all insights for a patient as read
 */
export async function markAllInsightsAsRead(patientId: string): Promise<{
  error: any;
}> {
  try {
    const query = supabase.from('ai_insights') as any;
    const { error } = await query.update({ is_read: true }).eq('patient_id', patientId).eq('is_read', false);

    if (error) {
      console.error('[AIInsightsService] markAllInsightsAsRead error:', error);
      return { error };
    }

    return { error: null };
  } catch (e) {
    console.error('[AIInsightsService] markAllInsightsAsRead exception:', e);
    return { error: e };
  }
}

/**
 * Delete an insight
 */
export async function deleteAIInsight(insightId: string): Promise<{
  error: any;
}> {
  try {
    const { error } = await supabase
      .from('ai_insights')
      .delete()
      .eq('id', insightId);

    if (error) {
      console.error('[AIInsightsService] deleteAIInsight error:', error);
      return { error };
    }

    return { error: null };
  } catch (e) {
    console.error('[AIInsightsService] deleteAIInsight exception:', e);
    return { error: e };
  }
}

/**
 * Generate AI insights based on patient session data
 * Uses external AI service (OpenAI) if configured, otherwise falls back to rule-based generation
 */
export async function generateInsightsFromSessions(patientId: string): Promise<{
  data: AIInsight[];
  error: any;
}> {
  try {
    // Fetch patient info
    const patientResult = await supabase
      .from('demo_users')
      .select('name')
      .eq('id', patientId)
      .single() as { data: { name: string } | null; error: any };
    const patientData = patientResult.data;

    // Fetch patient sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(20);

    if (sessionsError || !sessions || sessions.length === 0) {
      return { data: [], error: sessionsError };
    }

    // Fetch session metrics separately
    const sessionIds = (sessions as any[]).map((s: any) => s.id);
    const { data: metricsData } = await supabase
      .from('session_metrics')
      .select('*')
      .in('session_id', sessionIds) as { data: any[] | null; error: any };

    // Type sessions properly
    const typedSessions = sessions as any[];

    // Calculate trends and prepare data for AI service
    const recentSessions = typedSessions.slice(0, 7);
    const olderSessions = typedSessions.slice(7, 14);

    // Calculate adherence
    const totalSessions = typedSessions.length;
    const completedSessions = typedSessions.filter((s: any) => s.status === 'completed').length;
    const adherence = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Calculate pain trend
    const recentPainScores = recentSessions
      .filter((s: any) => s.pain_score_post !== null)
      .map((s: any) => s.pain_score_post) as number[];
    const olderPainScores = olderSessions
      .filter((s: any) => s.pain_score_post !== null)
      .map((s: any) => s.pain_score_post) as number[];
    
    let painTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentPainScores.length > 0 && olderPainScores.length > 0) {
      const recentAvg = recentPainScores.reduce((a, b) => a + b, 0) / recentPainScores.length;
      const olderAvg = olderPainScores.reduce((a, b) => a + b, 0) / olderPainScores.length;
      const painChange = recentAvg - olderAvg;
      if (painChange > 1) painTrend = 'increasing';
      else if (painChange < -1) painTrend = 'decreasing';
    }

    // Calculate ROM trend
    const recentROM = recentSessions
      .filter((s: any) => s.summary && (s.summary as any).rom_delta !== null)
      .map((s: any) => (s.summary as any).rom_delta) as number[];
    const olderROM = olderSessions
      .filter((s: any) => s.summary && (s.summary as any).rom_delta !== null)
      .map((s: any) => (s.summary as any).rom_delta) as number[];
    
    let romTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentROM.length > 0 && olderROM.length > 0) {
      const recentAvg = recentROM.reduce((a, b) => a + b, 0) / recentROM.length;
      const olderAvg = olderROM.reduce((a, b) => a + b, 0) / olderROM.length;
      const romChange = recentAvg - olderAvg;
      if (romChange > 2) romTrend = 'improving';
      else if (romChange < -2) romTrend = 'declining';
    }

    // Prepare session data for AI service
    const sessionData: PatientSessionData = {
      patient_id: patientId,
      patient_name: patientData?.name,
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      adherence_rate: adherence,
      pain_trend: painTrend,
      rom_trend: romTrend,
      recent_sessions: recentSessions.map((s: any) => {
        const sessionMetrics = (metricsData || []).filter((m: any) => m.session_id === s.id);
        const exercises = sessionMetrics.map((m: any) => {
          const metricData = m.metrics as any;
          return {
            name: metricData.exercise_name || m.exercise_slug,
            reps: metricData.total_reps || 0,
            avg_accuracy: metricData.avg_accuracy || 0,
            avg_rom: metricData.avg_rom || 0,
          };
        });

        return {
          date: s.started_at ? new Date(s.started_at).toLocaleDateString() : '',
          pain_score_pre: s.pain_score_pre ?? null,
          pain_score_post: s.pain_score_post ?? null,
          rom_delta: s.summary ? (s.summary as any).rom_delta : null,
          accuracy_avg: s.summary ? (s.summary as any).accuracy_avg : null,
          exercises,
        };
      }),
    };

    // Generate insights using AI service (or fallback)
    const aiInsights = await aiService.generateInsights(sessionData);

    // Create insights in database
    const createdInsights: AIInsight[] = [];
    for (const insight of aiInsights) {
      const { data, error } = await createAIInsight({
        patient_id: patientId,
        insight_type: insight.insight_type,
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
        category: insight.category,
        metadata: insight.reasoning ? { reasoning: insight.reasoning } : undefined,
      });

      if (data && !error) {
        createdInsights.push(data);
      }
    }

    return { data: createdInsights, error: null };
  } catch (e) {
    console.error('[AIInsightsService] generateInsightsFromSessions exception:', e);
    return { data: [], error: e };
  }
}

// Service object for backward compatibility
export const aiInsightsService = {
  getAll: getAIInsights,
  create: createAIInsight,
  markAsRead: markInsightAsRead,
  markAllAsRead: markAllInsightsAsRead,
  delete: deleteAIInsight,
  generate: generateInsightsFromSessions,
};

