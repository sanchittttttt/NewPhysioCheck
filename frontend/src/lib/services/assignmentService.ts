/**
 * Assignment Service - Supabase Implementation
 * 
 * Handles protocol assignments to patients.
 * Assignments link a protocol to a patient with scheduling info.
 */
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser, getDoctorPatients } from '@/lib/demoAuth';

export interface Assignment {
  id: string;
  patient_id: string;
  protocol_id: string;
  doctor_id: string;
  start_date: string;
  end_date: string | null;
  frequency_per_week: number;
  status: 'active' | 'paused' | 'completed';
  notes: string | null;
  created_at: string;
  // Joined fields
  patient_name?: string;
  protocol_title?: string;
}

export interface CreateAssignmentInput {
  patient_id: string;
  protocol_id: string;
  start_date: string;
  end_date?: string;
  frequency_per_week?: number;
  notes?: string;
}

export interface GetAssignmentsOptions {
  patient_id?: string;
  protocol_id?: string;
  status?: string;
  limit?: number;
}

/**
 * Get all assignments
 */
export async function getAssignments(options: GetAssignmentsOptions = {}): Promise<{ data: Assignment[]; error: any }> {
  const user = getDemoUser();
  if (!user) {
    return { data: [], error: 'Not logged in' };
  }

  try {
    let query = supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by doctor if logged in as doctor
    if (user.role === 'doctor') {
      query = query.eq('doctor_id', user.id);
    }

    // Filter by patient if logged in as patient
    if (user.role === 'patient') {
      query = query.eq('patient_id', user.id);
    }

    if (options.patient_id) {
      query = query.eq('patient_id', options.patient_id);
    }

    if (options.protocol_id) {
      query = query.eq('protocol_id', options.protocol_id);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AssignmentService] getAssignments error:', error);
      return { data: [], error };
    }

    return { data: (data || []) as Assignment[], error: null };
  } catch (e) {
    console.error('[AssignmentService] getAssignments exception:', e);
    return { data: [], error: e };
  }
}

/**
 * Get a single assignment by ID
 */
export async function getAssignmentById(id: string): Promise<{ data: Assignment | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as Assignment, error: null };
  } catch (e) {
    console.error('[AssignmentService] getAssignmentById error:', e);
    return { data: null, error: e };
  }
}

/**
 * Create a new assignment
 */
export async function createAssignment(input: CreateAssignmentInput): Promise<{ data: Assignment | null; error: any }> {
  const user = getDemoUser();
  if (!user || user.role !== 'doctor') {
    return { data: null, error: 'Must be logged in as doctor' };
  }

  try {
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        patient_id: input.patient_id,
        protocol_id: input.protocol_id,
        doctor_id: user.id,
        start_date: input.start_date,
        end_date: input.end_date || null,
        frequency_per_week: input.frequency_per_week || 3,
        status: 'active',
        notes: input.notes || null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[AssignmentService] createAssignment error:', error);
      return { data: null, error };
    }

    console.log('[AssignmentService] Assignment created:', data?.id);
    return { data: data as Assignment, error: null };
  } catch (e) {
    console.error('[AssignmentService] createAssignment exception:', e);
    return { data: null, error: e };
  }
}

/**
 * Update assignment status
 */
export async function updateAssignmentStatus(id: string, status: 'active' | 'paused' | 'completed'): Promise<{ data: Assignment | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .update({ status } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as Assignment, error: null };
  } catch (e) {
    console.error('[AssignmentService] updateAssignmentStatus error:', e);
    return { data: null, error: e };
  }
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(id: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    return { error };
  } catch (e) {
    console.error('[AssignmentService] deleteAssignment exception:', e);
    return { error: e };
  }
}

/**
 * Get active assignments for the current patient
 */
export async function getPatientActiveAssignments(): Promise<Assignment[]> {
  const user = getDemoUser();
  if (!user || user.role !== 'patient') {
    return [];
  }

  const { data } = await getAssignments({ patient_id: user.id, status: 'active' });
  return data;
}

// Backward compatible export
export const assignmentService = {
  getAll: async (options: GetAssignmentsOptions = {}) => getAssignments(options),
  getById: async (id: string) => getAssignmentById(id),
  create: createAssignment,
  updateStatus: updateAssignmentStatus,
  delete: deleteAssignment,
  getPatientActive: getPatientActiveAssignments,
};
