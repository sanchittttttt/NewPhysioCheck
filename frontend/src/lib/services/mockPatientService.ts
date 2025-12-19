/**
 * Mock patient service for development/testing
 * Replaces backend API calls with localStorage-backed mock data
 */

import { getMockPatients, getMockPatient, type MockPatient } from '../mockData/patients';

interface GetPatientsParams {
  skip?: number;
  limit?: number;
  status?: 'active' | 'on_hold' | 'discharged';
  search?: string;
}

interface GetPatientsResponse {
  data: MockPatient[];
  total: number;
}

// Mock doctor ID (set from localStorage during login)
function getDoctorId(): string {
  const user = localStorage.getItem('currentUser');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      // Use email as a simple doctor identifier
      return 'doctor-1'; // For now, all doctors are 'doctor-1'
    } catch {
      return 'doctor-1';
    }
  }
  return 'doctor-1';
}

export const mockPatientService = {
  /**
   * Get all patients for the current doctor with optional filtering
   */
  async getAll(params?: GetPatientsParams): Promise<GetPatientsResponse> {
    const doctorId = getDoctorId();
    let patients = getMockPatients(doctorId);

    // Apply status filter
    if (params?.status) {
      patients = patients.filter((p) => p.status === params.status);
    }

    // Apply search filter
    if (params?.search) {
      const search = params.search.toLowerCase();
      patients = patients.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.email.toLowerCase().includes(search) ||
          p.condition.toLowerCase().includes(search)
      );
    }

    // Apply pagination
    const skip = params?.skip || 0;
    const limit = params?.limit || 20;
    const paginatedPatients = patients.slice(skip, skip + limit);

    return {
      data: paginatedPatients,
      total: patients.length,
    };
  },

  /**
   * Get a specific patient by ID
   */
  async getById(patientId: string): Promise<MockPatient | null> {
    const patient = getMockPatient(patientId);
    return patient || null;
  },

  /**
   * Create a new patient (mock - just stores in memory)
   */
  async create(data: Omit<MockPatient, 'id' | 'doctorId'>): Promise<MockPatient> {
    const doctorId = getDoctorId();
    const newPatient: MockPatient = {
      ...data,
      id: `patient-${Date.now()}`,
      doctorId,
    };

    // In a real app, this would persist to backend
    // For now, it's just in memory and won't survive page refresh
    console.log('[mockPatientService] Created patient:', newPatient);

    return newPatient;
  },

  /**
   * Update a patient
   */
  async update(patientId: string, data: Partial<MockPatient>): Promise<MockPatient> {
    const patient = getMockPatient(patientId);
    if (!patient) throw new Error('Patient not found');

    const updated = { ...patient, ...data };
    console.log('[mockPatientService] Updated patient:', updated);

    return updated;
  },

  /**
   * Delete a patient
   */
  async delete(patientId: string): Promise<void> {
    console.log('[mockPatientService] Deleted patient:', patientId);
    // In a real app, this would call backend
  },
};
