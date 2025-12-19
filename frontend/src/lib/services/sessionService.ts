/**
 * Session service - Supabase implementation
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  Session,
  SessionListResponse,
  SessionCreate,
  SessionComplete,
  SessionListParams,
} from '@/types/api';

export const sessionService = {
  /**
    * Get list of sessions with optional filters
   */
  async getAll(params?: SessionListParams): Promise<SessionListResponse> {
    let query = supabase
      .from('sessions')
      .select('*', { count: 'exact' });

    if (params?.patient_id) {
      query = query.eq('patient_id', params.patient_id);
    }

    if (params?.date_from) {
      query = query.gte('scheduled_date', params.date_from);
    }

    if (params?.date_to) {
      query = query.lte('scheduled_date', params.date_to);
    }

    // Default sort
    query = query.order('scheduled_date', { ascending: true });

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: (data || []) as Session[],
      total: count || 0,
    };
  },

  /**
   * Get single session by ID
   */
  async getById(id: string): Promise<Session> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Session;
  },

  /**
   * Start a new session (creates it)
   */
  async create(data: SessionCreate): Promise<Session> {
    const sessionData = {
      patient_id: data.patient_id,
      assignment_id: data.assignment_id,
      protocol_id: data.protocol_id,
      status: 'scheduled',
      scheduled_date: data.scheduled_date || new Date().toISOString().split('T')[0],
      started_at: new Date().toISOString(),
    };

    // Create as in_progress immediately for active session flow
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        ...sessionData,
        status: 'in_progress',
      } as any)
      .select()
      .single();

    if (error) throw error;
    return newSession as Session;
  },

  /**
   * Start a scheduled session
   */
  async start(id: string): Promise<Session> {
    const { data, error } = await supabase
      .from('sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Session;
  },

  /**
   * Complete a session with metrics
   */
  async complete(id: string, data: SessionComplete): Promise<Session> {
    // 1. Update session status
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        pain_score_pre: data.pain_score_pre,
        pain_score_post: data.pain_score_post,
        notes: data.notes
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (sessionError) throw sessionError;

    // 2. Insert reps
    if (data.reps && data.reps.length > 0) {
      const repsToInsert = data.reps.map(r => ({
        session_id: id,
        exercise_id: r.exercise_id,
        rep_index: r.rep_index,
        rom_max: r.rom_max,
        rom_target: r.rom_target,
        accuracy_score: r.accuracy_score,
        tempo_score: r.tempo_score,
        form_quality: r.form_quality,
        error_segment: r.error_segment,
        timestamp_ms: r.timestamp_ms
      }));

      const { error: repsError } = await supabase
        .from('session_reps' as any)
        .insert(repsToInsert as any);

      if (repsError) console.error('Error inserting reps:', repsError);
    }

    return session as Session;
  },
};
