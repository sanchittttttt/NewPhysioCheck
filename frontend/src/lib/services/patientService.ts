/**
 * Patient Service - Supabase Implementation
 * 
 * Handles all patient-related database operations.
 * Uses demo_users table with role='patient' for patient data.
 */
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser, getDoctorPatients, DemoUser } from '@/lib/demoAuth';

// Patient type (extends DemoUser with additional fields)
export interface Patient extends DemoUser {
  condition?: string;
  status?: 'active' | 'on_hold' | 'discharged';
  notes?: string;
  date_of_birth?: string;
  // Computed/joined fields
  lastSession?: string;
  adherence?: number;
}

export interface GetPatientsOptions {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}

/**
 * Get all patients for the current doctor
 */
export async function getPatients(options: GetPatientsOptions = {}): Promise<{ data: Patient[]; error: any }> {
  const user = getDemoUser();
  if (!user || user.role !== 'doctor') {
    return { data: [], error: 'Not logged in as doctor' };
  }

  try {
    // Get patients linked to this doctor
    const patients = await getDoctorPatients(user.id);

    // Apply search filter if provided
    let filtered = patients as Patient[];
    if (options.search) {
      const search = options.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search)
      );
    }

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return { data: filtered, error: null };
  } catch (e) {
    console.error('[PatientService] getPatients error:', e);
    return { data: [], error: e };
  }
}

/**
 * Get a single patient by ID
 */
export async function getPatientById(id: string): Promise<{ data: Patient | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('demo_users')
      .select('*')
      .eq('id', id)
      .eq('role', 'patient')
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as Patient, error: null };
  } catch (e) {
    console.error('[PatientService] getPatientById error:', e);
    return { data: null, error: e };
  }
}

/**
 * Get patient stats (sessions, adherence, etc.)
 */
export async function getPatientStats(patientId: string): Promise<{
  totalSessions: number;
  completedSessions: number;
  adherence: number;
  lastSessionDate: string | null;
}> {
  try {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id, status, started_at')
      .eq('patient_id', patientId);

    if (error || !sessions) {
      return { totalSessions: 0, completedSessions: 0, adherence: 0, lastSessionDate: null };
    }

    const total = sessions.length;
    const completed = sessions.filter(s => s.status === 'completed').length;
    const adherence = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Get most recent session
    const sorted = sessions.sort((a, b) =>
      new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime()
    );
    const lastSessionDate = sorted[0]?.started_at || null;

    return { totalSessions: total, completedSessions: completed, adherence, lastSessionDate };
  } catch (e) {
    console.error('[PatientService] getPatientStats error:', e);
    return { totalSessions: 0, completedSessions: 0, adherence: 0, lastSessionDate: null };
  }
}

// Backward compatible export
export const patientService = {
  getAll: async (options: GetPatientsOptions = {}) => getPatients(options),
  getById: async (id: string) => getPatientById(id),
  getStats: getPatientStats,
};
