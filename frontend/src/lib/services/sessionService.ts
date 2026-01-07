/**
 * Sessions Service - Complete Supabase Implementation
 * 
 * Handles all session-related database operations:
 * - Create sessions
 * - Add session metrics
 * - Fetch sessions for patients/doctors
 * - Calculate stats
 */
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser, getPatientDoctor } from '@/lib/demoAuth';

// ============================================
// TYPES
// ============================================

export interface SessionSummary {
  total_reps: number;
  accuracy_avg: number;
  rom_delta: number;
  duration_seconds: number;
}

export interface SessionRecord {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  protocol_id: string | null;
  assignment_id: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed';
  started_at: string | null;
  ended_at: string | null;
  pain_score_pre: number | null;
  pain_score_post: number | null;
  notes: string | null;
  summary: SessionSummary | null;
  created_at: string;
}

export interface SessionMetrics {
  exercise_slug: string;
  exercise_name: string;
  total_reps: number;
  avg_accuracy: number;
  avg_rom: number;
  avg_tempo: number;
  reps_data: RepData[];
}

export interface RepData {
  rep_index: number;
  rom_achieved: number;
  rom_target: number;
  accuracy_score: number;
  tempo_score?: number;
  form_quality: string;
  timestamp_ms: number;
}

export interface SessionMetricRecord {
  id: string;
  session_id: string;
  exercise_slug: string;
  metrics: SessionMetrics;
  created_at: string;
}

// ============================================
// CREATE SESSION
// ============================================

export interface CreateSessionInput {
  patient_id: string;
  doctor_id?: string | null;
  protocol_id?: string | null;
  pain_score_pre?: number;
  notes?: string;
}

/**
 * Create a new session in Supabase
 */
export async function createSession(input: CreateSessionInput): Promise<SessionRecord | null> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        patient_id: input.patient_id,
        doctor_id: input.doctor_id || null,
        protocol_id: input.protocol_id || null,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        pain_score_pre: input.pain_score_pre || null,
        notes: input.notes || null,
      } as any)
      .select()
      .single();

    if (error || !data) {
      console.error('[SessionService] createSession error:', error);
      return null;
    }

    console.log('[SessionService] Session created:', data.id);
    return data as SessionRecord;
  } catch (e) {
    console.error('[SessionService] createSession exception:', e);
    return null;
  }
}

// ============================================
// ADD SESSION METRICS
// ============================================

/**
 * Add metrics for an exercise to a session
 */
export async function addSessionMetrics(
  sessionId: string,
  exerciseSlug: string,
  metrics: SessionMetrics
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('session_metrics')
      .insert({
        session_id: sessionId,
        exercise_slug: exerciseSlug,
        metrics: metrics as any,
      } as any);

    if (error) {
      console.error('[SessionService] addSessionMetrics error:', error);
      return false;
    }

    console.log('[SessionService] Metrics added for:', exerciseSlug);
    return true;
  } catch (e) {
    console.error('[SessionService] addSessionMetrics exception:', e);
    return false;
  }
}

// ============================================
// COMPLETE SESSION
// ============================================

export interface CompleteSessionInput {
  pain_score_post: number;
  notes?: string;
  summary: SessionSummary;
}

/**
 * Mark a session as completed with final data
 */
export async function completeSession(
  sessionId: string,
  input: CompleteSessionInput
): Promise<SessionRecord | null> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        pain_score_post: input.pain_score_post,
        notes: input.notes || null,
        summary: input.summary as any,
      } as any)
      .eq('id', sessionId)
      .select()
      .single();

    if (error || !data) {
      console.error('[SessionService] completeSession error:', error);
      return null;
    }

    console.log('[SessionService] Session completed:', sessionId);
    return data as SessionRecord;
  } catch (e) {
    console.error('[SessionService] completeSession exception:', e);
    return null;
  }
}

// ============================================
// SAVE SESSION (All-in-one for PatientSessionActive)
// ============================================

export interface SaveSessionInput {
  protocol_id?: string;
  started_at: string;
  ended_at: string;
  pain_score_pre?: number;
  pain_score_post: number;
  notes?: string;
  metrics: SessionMetrics[];
}

/**
 * Save a complete session with all metrics in one call
 * This is the main function used by PatientSessionActive
 */
export async function saveSessionToSupabase(
  input: SaveSessionInput
): Promise<SessionRecord | null> {
  const user = getDemoUser();
  if (!user || user.role !== 'patient') {
    console.error('[SessionService] No patient user logged in');
    return null;
  }

  try {
    // Get the doctor for this patient
    const doctor = await getPatientDoctor(user.id);

    // Calculate summary
    const totalReps = input.metrics.reduce((sum, m) => sum + m.total_reps, 0);
    const avgAccuracy = input.metrics.length > 0
      ? input.metrics.reduce((sum, m) => sum + m.avg_accuracy, 0) / input.metrics.length
      : 0;
    const avgRom = input.metrics.length > 0
      ? input.metrics.reduce((sum, m) => sum + m.avg_rom, 0) / input.metrics.length
      : 0;

    const startTime = new Date(input.started_at).getTime();
    const endTime = new Date(input.ended_at).getTime();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    const summary: SessionSummary = {
      total_reps: totalReps,
      accuracy_avg: Math.round(avgAccuracy),
      rom_delta: Math.round(avgRom),
      duration_seconds: durationSeconds,
    };

    // Create the session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        patient_id: user.id,
        doctor_id: doctor?.id || null,
        protocol_id: input.protocol_id || null,
        status: 'completed',
        started_at: input.started_at,
        ended_at: input.ended_at,
        pain_score_pre: input.pain_score_pre || null,
        pain_score_post: input.pain_score_post,
        notes: input.notes || null,
        summary: summary as any,
      } as any)
      .select()
      .single();

    if (sessionError || !session) {
      console.error('[SessionService] saveSession error:', sessionError);
      return null;
    }

    // Add metrics for each exercise
    for (const metric of input.metrics) {
      await addSessionMetrics(session.id, metric.exercise_slug, metric);
    }

    console.log('[SessionService] Full session saved:', session.id);
    return session as SessionRecord;
  } catch (e) {
    console.error('[SessionService] saveSessionToSupabase exception:', e);
    return null;
  }
}

// ============================================
// FETCH SESSIONS
// ============================================

/**
 * Get all sessions for a patient
 */
export async function getPatientSessions(patientId?: string): Promise<SessionRecord[]> {
  const user = getDemoUser();
  const targetId = patientId || user?.id;

  if (!targetId) {
    console.error('[SessionService] No patient ID provided');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('patient_id', targetId)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('[SessionService] getPatientSessions error:', error);
      return [];
    }

    return (data || []) as SessionRecord[];
  } catch (e) {
    console.error('[SessionService] getPatientSessions exception:', e);
    return [];
  }
}

/**
 * Get all sessions for a doctor's patients
 */
export async function getDoctorSessions(): Promise<SessionRecord[]> {
  const user = getDemoUser();
  if (!user || user.role !== 'doctor') {
    console.error('[SessionService] No doctor user logged in');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('doctor_id', user.id)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('[SessionService] getDoctorSessions error:', error);
      return [];
    }

    return (data || []) as SessionRecord[];
  } catch (e) {
    console.error('[SessionService] getDoctorSessions exception:', e);
    return [];
  }
}

/**
 * Get metrics for a specific session
 */
export async function getSessionMetrics(sessionId: string): Promise<SessionMetricRecord[]> {
  try {
    const { data, error } = await supabase
      .from('session_metrics')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      console.error('[SessionService] getSessionMetrics error:', error);
      return [];
    }

    return (data || []) as SessionMetricRecord[];
  } catch (e) {
    console.error('[SessionService] getSessionMetrics exception:', e);
    return [];
  }
}

// ============================================
// STATS
// ============================================

export interface PatientStats {
  totalSessions: number;
  completedSessions: number;
  totalReps: number;
  avgAccuracy: number;
  avgPainReduction: number;
}

/**
 * Get aggregated stats for a patient
 */
export async function getPatientStats(patientId?: string): Promise<PatientStats> {
  const sessions = await getPatientSessions(patientId);
  const completed = sessions.filter(s => s.status === 'completed');

  let totalReps = 0;
  let totalAccuracy = 0;
  let totalPainReduction = 0;
  let painCount = 0;

  for (const session of completed) {
    if (session.summary) {
      totalReps += session.summary.total_reps || 0;
      totalAccuracy += session.summary.accuracy_avg || 0;
    }
    if (session.pain_score_pre !== null && session.pain_score_post !== null) {
      totalPainReduction += session.pain_score_pre - session.pain_score_post;
      painCount++;
    }
  }

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    totalReps,
    avgAccuracy: completed.length > 0
      ? Math.round(totalAccuracy / completed.length)
      : 0,
    avgPainReduction: painCount > 0
      ? Math.round((totalPainReduction / painCount) * 10) / 10
      : 0,
  };
}

// ============================================
// BACKWARD COMPATIBLE EXPORT
// ============================================
// For components that import { sessionService } and expect object-based API

export const sessionService = {
  // Create
  create: createSession,

  // GetAll - returns in format expected by legacy components
  getAll: async (_options: any = {}) => {
    const user = getDemoUser();
    if (!user) return { data: [], error: null };

    if (user.role === 'doctor') {
      const sessions = await getDoctorSessions();
      return { data: sessions, error: null };
    } else {
      const sessions = await getPatientSessions();
      return { data: sessions, error: null };
    }
  },

  // GetById
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();
      return { data, error };
    } catch (e) {
      return { data: null, error: e };
    }
  },

  // Complete
  complete: completeSession,

  // Start session
  start: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({ status: 'in_progress', started_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      return { data, error };
    } catch (e) {
      return { data: null, error: e };
    }
  },
};
