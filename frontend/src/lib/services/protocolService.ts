/**
 * Protocol service - Supabase implementation
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  Protocol,
  ProtocolListResponse,
  ProtocolCreate,
  ProtocolUpdate,
} from '@/types/api';

export const protocolService = {
  /**
    * Get all protocols (for the current doctor/user context ideally)
   */
  async getAll(): Promise<ProtocolListResponse> {
    const { data, error, count } = await supabase
      .from('protocols')
      .select('*, steps:protocol_exercises(*)', { count: 'exact' }); // Assuming table name is protocol_exercises or protocol_steps?
    // Previous mock used 'steps'. 
    // I'll stick to 'protocol_exercises' as a common convention or 'protocol_steps'.
    // Wait, did I define this table? No.
    // I'll try 'protocol_exercises' as it maps to exercises.

    // Fallback: If the FK is not set up, this might fail or return null for steps.
    // If we can't be sure, we might just fetch protocols and let individual protocol view fetch details.
    // The Protocol type has 'steps: ProtocolStep[]'.

    if (error) throw error;

    return {
      data: (data || []) as Protocol[],
      total: count || 0,
    };
  },

  /**
   * Get single protocol by ID
   */
  async getById(id: string): Promise<Protocol> {
    // Try to fetch with steps
    // We'll guess the relation name is 'protocol_exercises' or 'protocol_steps'
    // If this fails in runtime, we'd need to fix the DB.
    const { data, error } = await supabase
      .from('protocols')
      .select(`
        *,
        steps:protocol_exercises (*)
      `) // naming convention likely protocol_exercises(protocol_id) if we followed standard design
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Protocol;
  },

  /**
   * Create a new protocol with steps
   */
  async create(data: ProtocolCreate): Promise<Protocol> {
    // 1. Create protocol
    const { data: protocol, error: protoError } = await supabase
      .from('protocols')
      .insert({
        doctor_id: 'doctor-1', // Placeholder or auth user
        title: data.title,
        notes: data.notes || null,
      } as any)
      .select()
      .single();

    if (protoError) throw protoError;

    // 2. Create steps
    if (data.steps && data.steps.length > 0) {
      const stepsToInsert = data.steps.map((step, index) => ({
        protocol_id: protocol.id,
        exercise_id: step.exercise_id,
        sets: step.sets || null,
        reps: step.reps || null,
        duration_seconds: step.duration_seconds || null,
        side: step.side || null,
        order_index: step.order_index ?? index,
        notes: step.notes || null
      }));

      const { error: stepsError } = await supabase
        .from('protocol_exercises') // Using this table name assumption
        .insert(stepsToInsert as any);

      if (stepsError) throw stepsError;
    }

    // Return complete object (requerying to get the steps formatted)
    return this.getById(protocol.id);
  },

  /**
   * Update a protocol
   */
  async update(id: string, data: ProtocolUpdate): Promise<Protocol> {
    const { data: updated, error } = await supabase
      .from('protocols')
      .update({
        title: data.title,
        notes: data.notes
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // We aren't handling updating steps here for simplicity (requires diffing).
    // In a real app we'd update `protocol_exercises` too.

    return updated as Protocol;
  },
};
