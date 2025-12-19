/**
 * Utility to seed demo patients for development/testing.
 * 
 * This creates a small set of demo patients via the API.
 * Used when a doctor has no patients yet, to make the app usable.
 * 
 * For hackathon: Also tries to create patient records for common test emails
 * so logged-in patient users can be assigned protocols.
 */

import { patientService } from '../services/patientService';
import type { PatientCreate } from '@/types/api';

const DEMO_PATIENTS: Omit<PatientCreate, 'doctor_id'>[] = [
  {
    full_name: 'Sarah Johnson',
    date_of_birth: '1985-06-15',
    condition: 'Lower back pain',
    status: 'active',
    notes: 'Post-surgical rehabilitation. Progressing well with core strengthening exercises.',
  },
  {
    full_name: 'Michael Chen',
    date_of_birth: '1992-03-22',
    condition: 'Knee rehabilitation',
    status: 'active',
    notes: 'ACL reconstruction recovery. Focus on ROM and stability.',
  },
  {
    full_name: 'Emma Williams',
    date_of_birth: '1978-11-08',
    condition: 'Shoulder impingement',
    status: 'active',
    notes: 'Rotator cuff strengthening protocol. Good compliance with exercises.',
  },
  {
    full_name: 'David Rodriguez',
    date_of_birth: '1990-09-30',
    condition: 'Ankle sprain',
    status: 'on_hold',
    notes: 'Patient on vacation. Resume protocol next week.',
  },
];

// Hackathon: Patient names for common test emails (so doctors can identify them)
const HACKATHON_PATIENT_NAMES: Record<string, string> = {
  'sbcv32@gmail.com': 'Test Patient (sbcv32@gmail.com)',
};

/**
 * Seed demo patients if the doctor has no patients.
 * Returns the number of patients created.
 */
export async function seedDemoPatientsIfNeeded(): Promise<number> {
  try {
    // Check if doctor already has patients
    const existingPatients = await patientService.getAll({ limit: 1 });
    
    if (existingPatients.data.length > 0) {
      // Doctor already has patients, don't seed
      return 0;
    }

    // Create demo patients
    const created: Promise<any>[] = [];
    for (const patientData of DEMO_PATIENTS) {
      created.push(patientService.create(patientData));
    }

    await Promise.all(created);
    return DEMO_PATIENTS.length;
  } catch (error) {
    console.error('Failed to seed demo patients:', error);
    // Don't throw - seeding is optional
    return 0;
  }
}

