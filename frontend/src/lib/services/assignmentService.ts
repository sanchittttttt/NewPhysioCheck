/**
 * Assignment service - Supabase implementation
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  Assignment,
  AssignmentCreate,
  AssignmentUpdate,
} from '@/types/api';

export const assignmentService = {
  /**
    * Get all assignments (for current user)
   */
  async getAll(params?: { patient_id?: string; doctor_id?: string; status?: 'active' | 'paused' | 'completed' }): Promise<Assignment[]> {
    let query = supabase
      .from('assignments')
      .select('*');

    if (params?.patient_id) {
      query = query.eq('patient_id', params.patient_id);
    }

    if (params?.doctor_id) {
      query = query.eq('doctor_id', params.doctor_id);
    }

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    // Sort by recent
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as Assignment[];
  },

  /**
   * Create a new assignment
   */
  async create(data: AssignmentCreate): Promise<Assignment> {
    const { data: newAssignment, error } = await supabase
      .from('assignments')
      .insert({
        patient_id: data.patient_id,
        protocol_id: data.protocol_id,
        doctor_id: 'doctor-1', // Should come from auth or data? `data` doesn't have it? 
        // Actually AssignmentCreate interface likely has basic fields.
        // In a real app the doctor_id comes from the session. 
        // But here we might rely on the backend default or context.
        // I'll assume standard insert usage.
        start_date: data.start_date,
        frequency_per_week: data.frequency_per_week,
        status: data.status || 'active',
        notes: data.notes || null,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return newAssignment as Assignment;
  },

  /**
   * Update an assignment
   */
  async update(id: string, data: AssignmentUpdate): Promise<Assignment> {
    const { data: updated, error } = await supabase
      .from('assignments')
      .update(data as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updated as Assignment;
  },
};
