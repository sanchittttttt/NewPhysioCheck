import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Protocol, ProtocolStep, Exercise } from '@/types/api';
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser } from '@/lib/demoAuth';
import { getMockProtocols } from '@/lib/mockData/mockProtocols';
import { toDemoId, toMockId } from '@/lib/mockData/demoIdMap';

import StraightLegRaiseImg from '@/assets/images/StraightLegRaise.png';
import SquatImg from '@/assets/images/Squat.png';
import ElbowFlexionImg from '@/assets/images/ElbowFlexion.png';

// Re-export Exercise from api.ts
export { type Exercise };

interface ProtocolContextType {
    exercises: Exercise[];
    protocols: Protocol[];
    loading: boolean;
    createProtocol: (input: { title: string; steps: Omit<ProtocolStep, 'id' | 'created_at' | 'protocol_id'>[] }) => Promise<Protocol | null>;
    refreshProtocols: () => Promise<void>;
}

const ProtocolContext = createContext<ProtocolContextType | undefined>(undefined);

// Default exercise images mapping
const EXERCISE_IMAGES: Record<string, string> = {
    'slr': StraightLegRaiseImg,
    'straight_leg_raise': StraightLegRaiseImg,
    'squat': SquatImg,
    'elbow_flexion': ElbowFlexionImg,
};

export function ProtocolProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch exercises from Supabase
    const fetchExercises = async () => {
        try {
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .order('name');

            if (error) {
                console.error('[ProtocolContext] fetchExercises error:', error);
                return;
            }

            // Map database exercises to Exercise type with images
            const mapped: Exercise[] = (data || []).map((ex: any) => ({
                id: ex.id,
                name: ex.name,
                description: ex.description,
                joint: ex.joint,
                difficulty: ex.difficulty,
                position: ex.position,
                image_url: EXERCISE_IMAGES[ex.slug] || ex.image_url || null,
                created_at: ex.created_at,
                normal_range_min: ex.normal_rom_min,
                normal_range_max: ex.normal_rom_max,
                equipment: null,
            }));

            setExercises(mapped);
        } catch (e) {
            console.error('[ProtocolContext] fetchExercises exception:', e);
        }
    };

    // Fetch protocols from Supabase
    const fetchProtocols = async () => {
        const demoUser = getDemoUser();
        if (!demoUser) {
            setProtocols([]);
            return;
        }

        try {
            let query = supabase
                .from('protocols')
                .select('*')
                .order('created_at', { ascending: false });

            // If doctor, get only their protocols
            if (demoUser.role === 'doctor') {
                query = query.eq('doctor_id', demoUser.id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[ProtocolContext] fetchProtocols error:', error);
                // Fallback to mock protocols for demo/dev
                const mockDoctorId = toMockId(demoUser.id);
                const fallback = getMockProtocols(mockDoctorId || undefined).map((p) => ({
                    id: p.id,
                    title: p.title,
                    doctor_id: toDemoId(p.doctor_id) || p.doctor_id,
                    notes: p.notes,
                    created_at: p.created_at,
                    steps: [],
                })) as Protocol[];
                setProtocols(fallback);
                return;
            }

            // Map to Protocol type
            const mapped: Protocol[] = (data || []).map((p: any) => ({
                id: p.id,
                title: p.title,
                doctor_id: p.doctor_id,
                notes: p.description || p.notes,
                created_at: p.created_at,
                steps: [], // Steps would be fetched separately if needed
            }));

            if (mapped.length > 0) {
                setProtocols(mapped);
            } else {
                // If DB has no protocols yet, show mock protocols so UI isn't blank.
                const mockDoctorId = toMockId(demoUser.id);
                const fallback = getMockProtocols(mockDoctorId || undefined).map((p) => ({
                    id: p.id,
                    title: p.title,
                    doctor_id: toDemoId(p.doctor_id) || p.doctor_id,
                    notes: p.notes,
                    created_at: p.created_at,
                    steps: [],
                })) as Protocol[];
                setProtocols(fallback);
            }
        } catch (e) {
            console.error('[ProtocolContext] fetchProtocols exception:', e);
        }
    };

    // Initial load
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchExercises(), fetchProtocols()]);
            setLoading(false);
        };
        load();
    }, [user]);

    // Create protocol in Supabase
    const createProtocol = async (input: { title: string; steps: Omit<ProtocolStep, 'id' | 'created_at' | 'protocol_id'>[] }): Promise<Protocol | null> => {
        const demoUser = getDemoUser();
        if (!demoUser || demoUser.role !== 'doctor') {
            console.error('[ProtocolContext] Must be logged in as doctor');
            return null;
        }

        try {
            const { data, error } = await supabase
                .from('protocols')
                .insert({
                    doctor_id: demoUser.id,
                    title: input.title,
                    description: null,
                    notes: null,
                } as any)
                .select()
                .single();

            if (error || !data) {
                console.error('[ProtocolContext] createProtocol error:', error);
                return null;
            }

            const protocolData = data as any;

            // Insert steps into database
            if (input.steps.length > 0) {
                const stepsPayload = input.steps.map((step, index) => ({
                    protocol_id: protocolData.id,
                    exercise_id: step.exercise_id,
                    sets: step.sets ?? 3,
                    reps: step.reps ?? 10,
                    duration_seconds: step.duration_seconds ?? null,
                    side: step.side ?? 'both',
                    notes: step.notes ?? null,
                    order_index: step.order_index ?? index,
                }));

                const { error: stepsError } = await supabase
                    .from('protocol_steps')
                    .insert(stepsPayload as any);

                if (stepsError) {
                    console.error('[ProtocolContext] Error creating steps:', stepsError);
                }
            }

            const newProtocol: Protocol = {
                id: protocolData.id,
                title: protocolData.title,
                doctor_id: protocolData.doctor_id,
                notes: protocolData.notes,
                created_at: protocolData.created_at,
                steps: input.steps.map((step, index) => ({
                    ...step,
                    id: crypto.randomUUID(),
                    protocol_id: protocolData.id,
                    created_at: new Date().toISOString(),
                    sets: step.sets ?? null,
                    reps: step.reps ?? null,
                    duration_seconds: step.duration_seconds ?? null,
                    side: step.side ?? null,
                    notes: step.notes ?? null,
                    order_index: index
                }))
            };

            // Update local state
            setProtocols(prev => [newProtocol, ...prev]);

            console.log('[ProtocolContext] Protocol created:', newProtocol.id);
            return newProtocol;
        } catch (e) {
            console.error('[ProtocolContext] createProtocol exception:', e);
            return null;
        }
    };

    const refreshProtocols = async () => {
        await fetchProtocols();
    };

    const value = {
        exercises,
        protocols,
        loading,
        createProtocol,
        refreshProtocols,
    };

    return <ProtocolContext.Provider value={value}>{children}</ProtocolContext.Provider>;
}

export function useProtocol() {
    const context = useContext(ProtocolContext);
    if (context === undefined) {
        throw new Error('useProtocol must be used within a ProtocolProvider');
    }
    return context;
}
