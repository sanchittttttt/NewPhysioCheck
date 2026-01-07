/**
 * Demo Authentication Helper
 * 
 * This module provides demo login functionality without real Supabase Auth.
 * It stores the selected demo user in localStorage and provides functions
 * to manage the demo session.
 */

import { supabase } from './supabaseClient';

// Demo user types
export type DemoRole = 'doctor' | 'patient';

export interface DemoUser {
    id: string;
    name: string;
    email: string;
    role: DemoRole;
    avatar_url?: string | null;
}

const DEMO_USER_KEY = 'physiocheck_demo_user';

/**
 * Get the currently logged-in demo user from localStorage
 */
export function getDemoUser(): DemoUser | null {
    try {
        const stored = localStorage.getItem(DEMO_USER_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as DemoUser;
    } catch (e) {
        console.error('[DemoAuth] Failed to parse demo user', e);
        return null;
    }
}

/**
 * Set the demo user in localStorage
 */
export function setDemoUser(user: DemoUser): void {
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
}

/**
 * Log out the demo user
 */
export function logoutDemoUser(): void {
    localStorage.removeItem(DEMO_USER_KEY);
}

/**
 * Fetch all demo users from Supabase demo_users table
 */
export async function fetchDemoUsers(): Promise<DemoUser[]> {
    const { data, error } = await supabase
        .from('demo_users')
        .select('id, name, email, role, avatar_url')
        .order('role', { ascending: true }); // doctor first

    if (error) {
        console.error('[DemoAuth] Failed to fetch demo users:', error);
        throw error;
    }

    return (data || []) as DemoUser[];
}

/**
 * Check if demo users exist in the database
 */
export async function checkDemoUsersExist(): Promise<boolean> {
    try {
        const { count, error } = await supabase
            .from('demo_users')
            .select('id', { count: 'exact', head: true });

        if (error) {
            console.warn('[DemoAuth] demo_users table check failed:', error.message);
            return false;
        }

        return (count || 0) >= 3;
    } catch (e) {
        console.warn('[DemoAuth] checkDemoUsersExist exception:', e);
        return false;
    }
}

/**
 * Seed the demo users and relationships if they don't exist
 */
export async function seedDemoData(): Promise<{ success: boolean; message: string }> {
    try {
        // Define demo users
        const demoUsers = [
            {
                id: 'demo-doctor-001',
                name: 'Dr. Sarah Chen',
                email: 'doctor@demo.physiocheck.com',
                role: 'doctor',
                avatar_url: null
            },
            {
                id: 'demo-patient-001',
                name: 'John Smith',
                email: 'patient1@demo.physiocheck.com',
                role: 'patient',
                avatar_url: null
            },
            {
                id: 'demo-patient-002',
                name: 'Emily Johnson',
                email: 'patient2@demo.physiocheck.com',
                role: 'patient',
                avatar_url: null
            }
        ];

        // Upsert demo users
        const { error: usersError } = await supabase
            .from('demo_users')
            .upsert(demoUsers as any, { onConflict: 'id' });

        if (usersError) {
            console.error('[DemoAuth] Failed to seed demo users:', usersError);
            return { success: false, message: `Failed to seed users: ${usersError.message}` };
        }

        // Create doctor-patient relationships
        const doctorPatients = [
            { doctor_id: 'demo-doctor-001', patient_id: 'demo-patient-001' },
            { doctor_id: 'demo-doctor-001', patient_id: 'demo-patient-002' }
        ];

        const { error: relError } = await supabase
            .from('doctor_patients')
            .upsert(doctorPatients as any, { onConflict: 'doctor_id,patient_id' });

        if (relError) {
            console.error('[DemoAuth] Failed to seed doctor-patient relationships:', relError);
            return { success: false, message: `Failed to seed relationships: ${relError.message}` };
        }

        // Seed exercises if not exist
        const exercises = [
            {
                id: 'ex-squat',
                name: 'Squat',
                slug: 'squat',
                description: 'Basic squat movement for lower body strengthening',
                joint: 'Knee/Hip',
                position: 'Standing',
                difficulty: 'Intermediate'
            },
            {
                id: 'ex-slr',
                name: 'Straight Leg Raise',
                slug: 'slr',
                description: 'Leg raise while lying down for hip flexor strengthening',
                joint: 'Hip',
                position: 'Supine',
                difficulty: 'Beginner'
            },
            {
                id: 'ex-elbow',
                name: 'Elbow Flexion',
                slug: 'elbow_flexion',
                description: 'Bicep curl movement for elbow rehabilitation',
                joint: 'Elbow',
                position: 'Sitting/Standing',
                difficulty: 'Beginner'
            }
        ];

        const { error: exError } = await supabase
            .from('exercises')
            .upsert(exercises as any, { onConflict: 'id' });

        if (exError) {
            console.error('[DemoAuth] Failed to seed exercises:', exError);
            // Don't fail completely if exercises fail
        }

        return { success: true, message: 'Demo data seeded successfully!' };
    } catch (e) {
        console.error('[DemoAuth] Seed error:', e);
        return { success: false, message: `Unexpected error: ${String(e)}` };
    }
}

/**
 * Get patients for a demo doctor
 * Uses simple query + separate fetch instead of PostgREST embedding
 */
export async function getDoctorPatients(doctorId: string): Promise<DemoUser[]> {
    try {
        // First get patient IDs
        const { data: relationships, error: relError } = await supabase
            .from('doctor_patients')
            .select('patient_id')
            .eq('doctor_id', doctorId);

        if (relError || !relationships?.length) {
            console.warn('[DemoAuth] No patients found for doctor:', relError?.message);
            return [];
        }

        const patientIds = relationships.map((r: any) => r.patient_id);

        // Then fetch patient details
        const { data: patients, error: patientsError } = await supabase
            .from('demo_users')
            .select('id, name, email, role, avatar_url')
            .in('id', patientIds);

        if (patientsError) {
            console.error('[DemoAuth] Failed to fetch patients:', patientsError);
            return [];
        }

        return (patients || []) as DemoUser[];
    } catch (e) {
        console.error('[DemoAuth] getDoctorPatients exception:', e);
        return [];
    }
}

/**
 * Get the doctor for a patient
 * Uses simple query + separate fetch instead of PostgREST embedding
 */
export async function getPatientDoctor(patientId: string): Promise<DemoUser | null> {
    try {
        // First get doctor ID
        const { data: relationship, error: relError } = await supabase
            .from('doctor_patients')
            .select('doctor_id')
            .eq('patient_id', patientId)
            .limit(1)
            .single();

        if (relError || !relationship) {
            console.warn('[DemoAuth] No doctor found for patient:', relError?.message);
            return null;
        }

        const doctorId = (relationship as any).doctor_id;

        // Then fetch doctor details
        const { data: doctor, error: doctorError } = await supabase
            .from('demo_users')
            .select('id, name, email, role, avatar_url')
            .eq('id', doctorId)
            .single();

        if (doctorError) {
            console.error('[DemoAuth] Failed to fetch doctor:', doctorError);
            return null;
        }

        return doctor as DemoUser;
    } catch (e) {
        console.error('[DemoAuth] getPatientDoctor exception:', e);
        return null;
    }
}
