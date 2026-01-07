/**
 * Protocol Service - Supabase Implementation
 * 
 * Handles all protocol-related database operations.
 * Protocols are exercise plans created by doctors.
 */
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser } from '@/lib/demoAuth';

export interface ProtocolExercise {
  exercise_id: string;
  exercise_name?: string;
  sets: number;
  reps: number;
  hold_seconds?: number;
  notes?: string;
}

export interface Protocol {
  id: string;
  doctor_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  exercises?: ProtocolExercise[];
  created_at: string;
}

export interface CreateProtocolInput {
  title: string;
  description?: string;
  notes?: string;
  exercises?: ProtocolExercise[];
}

export interface GetProtocolsOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * Get all protocols (for doctor: their protocols, for patient: assigned protocols)
 */
export async function getProtocols(options: GetProtocolsOptions = {}): Promise<{ data: Protocol[]; error: any }> {
  const user = getDemoUser();
  if (!user) {
    return { data: [], error: 'Not logged in' };
  }

  try {
    let query = supabase
      .from('protocols')
      .select('*')
      .order('created_at', { ascending: false });

    // If doctor, get their protocols
    if (user.role === 'doctor') {
      query = query.eq('doctor_id', user.id);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ProtocolService] getProtocols error:', error);
      return { data: [], error };
    }

    return { data: (data || []) as Protocol[], error: null };
  } catch (e) {
    console.error('[ProtocolService] getProtocols exception:', e);
    return { data: [], error: e };
  }
}

/**
 * Get a single protocol by ID with its exercises
 */
export async function getProtocolById(id: string): Promise<{ data: Protocol | null; error: any }> {
  try {
    // Get protocol
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('*')
      .eq('id', id)
      .single();

    if (protocolError) {
      return { data: null, error: protocolError };
    }

    // Get steps
    const { data: steps, error: stepsError } = await supabase
      .from('protocol_steps')
      .select(`
        *,
        exercise:exercises(name)
      `)
      .eq('protocol_id', id)
      .order('order_index', { ascending: true });

    if (stepsError) {
      console.error('[ProtocolService] Error fetching steps:', stepsError);
      // Return protocol without steps rather than failing completely
      return { data: protocol as Protocol, error: null };
    }

    // Map steps to ProtocolExercise format
    const exercises: ProtocolExercise[] = (steps || []).map((step: any) => ({
      exercise_id: step.exercise_id,
      exercise_name: step.exercise?.name,
      sets: step.sets,
      reps: step.reps,
      hold_seconds: step.duration_seconds, // Map duration to hold_seconds
      notes: step.notes,
      order_index: step.order_index,
      side: step.side, // Add side property if ProtocolExercise supports it
    }));

    // Add steps and exercises to protocol object
    const protocolWithSteps = {
      ...protocol,
      steps: steps || [], // Raw steps for session usage
      exercises: exercises, // Mapped exercises for UI usage
    };

    return { data: protocolWithSteps as Protocol, error: null };
  } catch (e) {
    console.error('[ProtocolService] getProtocolById error:', e);
    return { data: null, error: e };
  }
}

/**
 * Create a new protocol
 */
export async function createProtocol(input: CreateProtocolInput): Promise<{ data: Protocol | null; error: any }> {
  const user = getDemoUser();
  if (!user || user.role !== 'doctor') {
    return { data: null, error: 'Must be logged in as doctor' };
  }

  try {
    // 1. Create Protocol
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .insert({
        doctor_id: user.id,
        title: input.title,
        description: input.description || null,
        notes: input.notes || null,
      } as any)
      .select()
      .single();

    if (protocolError) {
      console.error('[ProtocolService] createProtocol error:', protocolError);
      return { data: null, error: protocolError };
    }

    // 2. Insert Steps if any
    // Handle both input.exercises (from types) and input.steps (passed from ProtocolBuilder)
    const stepsToInsert = (input as any).steps || input.exercises;

    if (stepsToInsert?.length) {
      const stepsPayload = stepsToInsert.map((ex: any, index: number) => ({
        protocol_id: protocol.id,
        exercise_id: ex.exercise_id || ex.id, // Handle both formats
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        duration_seconds: ex.duration_seconds || ex.hold_seconds || null,
        side: ex.side || 'both',
        notes: ex.notes || null,
        order_index: ex.order_index ?? index,
      }));

      const { error: stepsError } = await supabase
        .from('protocol_steps')
        .insert(stepsPayload);

      if (stepsError) {
        console.error('[ProtocolService] Error creating steps:', stepsError);
        // We don't rollback the protocol creation, but we warn
      }
    }

    console.log('[ProtocolService] Protocol created:', protocol.id);
    return { data: protocol as Protocol, error: null };
  } catch (e) {
    console.error('[ProtocolService] createProtocol exception:', e);
    return { data: null, error: e };
  }
}

/**
 * Update a protocol
 */
export async function updateProtocol(id: string, input: Partial<CreateProtocolInput>): Promise<{ data: Protocol | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('protocols')
      .update({
        title: input.title,
        description: input.description,
        notes: input.notes,
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as Protocol, error: null };
  } catch (e) {
    console.error('[ProtocolService] updateProtocol error:', e);
    return { data: null, error: e };
  }
}

/**
 * Delete a protocol
 */
export async function deleteProtocol(id: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('protocols')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[ProtocolService] deleteProtocol error:', error);
    }

    return { error };
  } catch (e) {
    console.error('[ProtocolService] deleteProtocol exception:', e);
    return { error: e };
  }
}

// Backward compatible export
export const protocolService = {
  getAll: async (options: GetProtocolsOptions = {}) => getProtocols(options),
  getById: async (id: string) => getProtocolById(id),
  create: createProtocol,
  update: updateProtocol,
  delete: deleteProtocol,
};
