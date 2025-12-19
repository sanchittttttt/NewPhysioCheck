/**
 * Patient service - Supabase implementation
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  Patient,
  PatientListResponse,
  PatientCreate,
  PatientUpdate,
  PatientListParams,
} from '@/types/api';

export const patientService = {
  /**
    * Get paginated list of patients with optional filters
   */
  async getAll(params?: PatientListParams): Promise<PatientListResponse> {
    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' });

    // Apply status filter
    if (params?.status_filter) {
      query = query.eq('status', params.status_filter);
    }

    // Apply search filter
    if (params?.search) {
      const search = params.search;
      query = query.or(`full_name.ilike.%${search}%,condition.ilike.%${search}%`);
    }

    // Pagination
    const skip = params?.skip || 0;
    const limit = params?.limit || 100;

    // range is inclusive
    query = query.range(skip, skip + limit - 1);

    // Order by created_at desc by default
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    // TODO: Add session counts via join or separate query if needed
    // For now we map strictly to table columns, optional fields will be undefined
    const patients = (data || []).map(p => ({
      ...p,
      // Ensure nullable fields are handled if types mismatch slightly
      date_of_birth: p.date_of_birth || null,
      condition: p.condition || null,
      notes: p.notes || null,
    })) as Patient[];

    return {
      data: patients,
      total: count || 0,
      skip,
      limit
    };
  },

  /**
   * Get single patient by ID
   */
  async getById(id: string): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Patient;
  },

  /**
   * Create a new patient
   */
  async create(data: PatientCreate): Promise<Patient> {
    // If doctor_id is not provided, we should probably get it from session, 
    // but typically service just sends what it's given. 
    // The RLS policy should ideally enforce doctor_id = auth.uid() or validation here.

    // If doctor_id missing, we try to get current user
    let doctorId = data.doctor_id;
    if (!doctorId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) doctorId = session.user.id;
    }

    if (!doctorId) throw new Error("Doctor ID required");

    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({
        doctor_id: doctorId,
        full_name: data.full_name,
        date_of_birth: data.date_of_birth,
        condition: data.condition,
        status: data.status || 'active',
        notes: data.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return newPatient as Patient;
  },

  /**
   * Update a patient
   */
  async update(id: string, data: PatientUpdate): Promise<Patient> {
    const { data: updated, error } = await supabase
      .from('patients')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updated as Patient;
  },

  /**
   * Delete a patient
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};


