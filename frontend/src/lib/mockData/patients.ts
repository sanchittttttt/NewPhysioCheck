/**
 * Mock patient data for development/testing
 * No backend required - all data is stored in localStorage
 */

export interface MockPatient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  age: number;
  condition: string;
  status: 'active' | 'on_hold' | 'discharged';
  joinedDate: string;
  lastSession?: string;
  protocol?: string;
  doctorId: string;
}

// Sample patients that doctors can work with
export const MOCK_PATIENTS: MockPatient[] = [
  {
    id: 'patient-1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    age: 45,
    condition: 'Knee Injury',
    status: 'active',
    joinedDate: '2025-11-15',
    lastSession: '2025-12-08',
    protocol: 'Knee Recovery - Phase 2',
    doctorId: 'doctor-1',
  },
  {
    id: 'patient-2',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+1 (555) 234-5678',
    age: 38,
    condition: 'Back Pain',
    status: 'active',
    joinedDate: '2025-10-20',
    lastSession: '2025-12-09',
    protocol: 'Lower Back Strengthening',
    doctorId: 'doctor-1',
  },
  {
    id: 'patient-3',
    name: 'Michael Chen',
    email: 'michael.chen@example.com',
    phone: '+1 (555) 345-6789',
    age: 52,
    condition: 'Shoulder Rehabilitation',
    status: 'active',
    joinedDate: '2025-09-10',
    lastSession: '2025-12-07',
    protocol: 'Rotator Cuff Therapy',
    doctorId: 'doctor-1',
  },
  {
    id: 'patient-4',
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    phone: '+1 (555) 456-7890',
    age: 29,
    condition: 'Post-Surgery Recovery',
    status: 'on_hold',
    joinedDate: '2025-11-05',
    lastSession: '2025-12-02',
    protocol: 'ACL Recovery Program',
    doctorId: 'doctor-1',
  },
  {
    id: 'patient-5',
    name: 'Robert Wilson',
    email: 'robert.wilson@example.com',
    phone: '+1 (555) 567-8901',
    age: 61,
    condition: 'Arthritis Management',
    status: 'active',
    joinedDate: '2025-08-25',
    lastSession: '2025-12-09',
    protocol: 'Joint Mobility Program',
    doctorId: 'doctor-1',
  },
];

// Get patients for a specific doctor (filtered by doctorId)
export function getMockPatients(doctorId: string): MockPatient[] {
  return MOCK_PATIENTS.filter((p) => p.doctorId === doctorId);
}

// Get a specific patient
export function getMockPatient(patientId: string): MockPatient | undefined {
  return MOCK_PATIENTS.find((p) => p.id === patientId);
}
