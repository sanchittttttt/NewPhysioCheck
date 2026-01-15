import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session, SessionStatus } from '@/types/api';
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser } from '@/lib/demoAuth';
import { useAuth } from '@/context/AuthContext';
import { MOCK_SESSIONS } from '@/lib/mockData/sessions';
import { toDemoId, toMockId } from '@/lib/mockData/demoIdMap';

interface SessionContextType {
    sessions: Session[];
    loading: boolean;
    createSession: (input: {
        protocol_id: string;
        patient_id: string;
        date: string;
        notes?: string;
    }) => Promise<Session | null>;
    updateSession: (id: string, updates: Partial<Session>) => Promise<Session | null>;
    refreshSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    const getFallbackSessions = (demoUserId: string, role: 'patient' | 'doctor'): Session[] => {
        const mockId = toMockId(demoUserId);
        const relevant = MOCK_SESSIONS.filter((s) => (role === 'patient' ? s.patientId === mockId : s.doctorId === mockId));

        return relevant.map((s) => ({
            id: `mock-${s.id}`,
            protocol_id: s.protocolId,
            patient_id: toDemoId(s.patientId) || s.patientId,
            assignment_id: null,
            scheduled_date: s.startDate ? s.startDate.split('T')[0] : null,
            status: (s.status === 'cancelled' ? 'missed' : s.status) as SessionStatus,
            notes: s.notes || null,
            created_at: s.startDate,
            started_at: s.startDate,
            ended_at: s.endDate || null,
            pain_score_pre: s.painLevel ?? null,
            pain_score_post: s.painLevel ?? null,
            accuracy_avg: null,
            rom_delta: null,
            adherence_score: null,
            reps: [],
        }));
    };

    // Fetch sessions from Supabase
    const fetchSessions = async () => {
        const demoUser = user || getDemoUser();
        if (!demoUser) {
            setSessions([]);
            setLoading(false);
            return;
        }

        try {
            let query = supabase
                .from('sessions')
                .select('*')
                .order('created_at', { ascending: false });

            // Filter by role
            if (demoUser.role === 'patient') {
                query = query.eq('patient_id', demoUser.id);
            } else if (demoUser.role === 'doctor') {
                query = query.eq('doctor_id', demoUser.id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[SessionContext] fetchSessions error:', error);
                setSessions(getFallbackSessions(demoUser.id, demoUser.role));
                return;
            }

            // Map to Session type
            const mapped: Session[] = (data || []).map((s: any) => ({
                id: s.id,
                protocol_id: s.protocol_id,
                patient_id: s.patient_id,
                assignment_id: s.assignment_id,
                scheduled_date: s.started_at ? s.started_at.split('T')[0] : null,
                status: s.status as SessionStatus,
                notes: s.notes,
                created_at: s.created_at,
                started_at: s.started_at,
                ended_at: s.ended_at,
                pain_score_pre: s.pain_score_pre,
                pain_score_post: s.pain_score_post,
                accuracy_avg: s.summary?.accuracy_avg || null,
                rom_delta: s.summary?.rom_delta || null,
                adherence_score: null,
                reps: [],
            }));

            // If DB has no sessions yet, show demo/mock sessions so UI isn't blank.
            setSessions(mapped.length > 0 ? mapped : getFallbackSessions(demoUser.id, demoUser.role));
        } catch (e) {
            console.error('[SessionContext] fetchSessions exception:', e);
            const demoUser = user || getDemoUser();
            setSessions(demoUser ? getFallbackSessions(demoUser.id, demoUser.role) : []);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchSessions();
    }, []);

    // Refresh sessions when auth user changes (login/logout)
    useEffect(() => {
        setLoading(true);
        fetchSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Create session in Supabase
    const createSession = async (input: {
        protocol_id: string;
        patient_id: string;
        date: string;
        notes?: string;
    }): Promise<Session | null> => {
        const user = getDemoUser();
        if (!user) {
            console.error('[SessionContext] No user logged in');
            return null;
        }

        try {
            // Get doctor_id if creating for patient
            let doctorId = user.role === 'doctor' ? user.id : null;
            if (user.role === 'patient') {
                // Try to get doctor from doctor_patients
                const { data: rel } = await supabase
                    .from('doctor_patients')
                    .select('doctor_id')
                    .eq('patient_id', user.id)
                    .limit(1)
                    .single();
                doctorId = rel?.doctor_id || null;
            }

            const { data, error } = await supabase
                .from('sessions')
                .insert({
                    patient_id: input.patient_id,
                    doctor_id: doctorId,
                    protocol_id: input.protocol_id,
                    status: 'scheduled',
                    started_at: input.date ? `${input.date}T09:00:00Z` : null,
                    notes: input.notes || null,
                } as any)
                .select()
                .single();

            if (error || !data) {
                console.error('[SessionContext] createSession error:', error);
                return null;
            }

            const newSession: Session = {
                id: data.id,
                protocol_id: data.protocol_id,
                patient_id: data.patient_id,
                assignment_id: data.assignment_id,
                scheduled_date: input.date,
                status: data.status,
                notes: data.notes,
                created_at: data.created_at,
                started_at: data.started_at,
                ended_at: data.ended_at,
                pain_score_pre: data.pain_score_pre,
                pain_score_post: data.pain_score_post,
                accuracy_avg: null,
                rom_delta: null,
                adherence_score: null,
                reps: [],
            };

            // Update local state
            setSessions(prev => [newSession, ...prev]);

            console.log('[SessionContext] Session created:', newSession.id);
            return newSession;
        } catch (e) {
            console.error('[SessionContext] createSession exception:', e);
            return null;
        }
    };

    // Update session in Supabase
    const updateSession = async (id: string, updates: Partial<Session>): Promise<Session | null> => {
        try {
            const supabaseUpdates: any = {};
            if (updates.status) supabaseUpdates.status = updates.status;
            if (updates.started_at) supabaseUpdates.started_at = updates.started_at;
            if (updates.ended_at) supabaseUpdates.ended_at = updates.ended_at;
            if (updates.pain_score_pre !== undefined) supabaseUpdates.pain_score_pre = updates.pain_score_pre;
            if (updates.pain_score_post !== undefined) supabaseUpdates.pain_score_post = updates.pain_score_post;
            if (updates.notes) supabaseUpdates.notes = updates.notes;

            const { data, error } = await supabase
                .from('sessions')
                .update(supabaseUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('[SessionContext] updateSession error:', error);
                // Still update locally
                setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
                return sessions.find(s => s.id === id) || null;
            }

            // Update local state
            const updatedSession = { ...sessions.find(s => s.id === id), ...updates } as Session;
            setSessions(prev => prev.map(s => s.id === id ? updatedSession : s));

            return updatedSession;
        } catch (e) {
            console.error('[SessionContext] updateSession exception:', e);
            return null;
        }
    };

    const refreshSessions = async () => {
        setLoading(true);
        await fetchSessions();
    };

    const value = {
        sessions,
        loading,
        createSession,
        updateSession,
        refreshSessions,
    };

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
