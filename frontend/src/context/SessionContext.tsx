import { createContext, useContext, useState, ReactNode } from 'react';

export type SessionStatus = 'scheduled' | 'completed' | 'in_progress' | 'missed' | 'incomplete';

export interface Session {
    id: string;
    protocolId: string;
    patientId: string;
    date: string;       // 'YYYY-MM-DD'
    // Fields for compatibility with existing UI
    scheduled_date?: string;
    started_at?: string;

    notes?: string;
    status: SessionStatus;
    createdAt: string;  // ISO timestamp
}

interface SessionContextType {
    sessions: Session[];
    createSession: (input: {
        protocolId: string;
        patientId: string;
        date: string;
        notes?: string;
    }) => Session;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [sessions, setSessions] = useState<Session[]>([]);

    const createSession = (input: {
        protocolId: string;
        patientId: string;
        date: string;
        notes?: string;
    }) => {
        const newSession: Session = {
            id: crypto.randomUUID(),
            protocolId: input.protocolId,
            patientId: input.patientId,
            date: input.date,
            scheduled_date: input.date, // for UI compatibility
            notes: input.notes,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        setSessions(prev => [...prev, newSession]);
        console.log('SESSION_CREATED', newSession);
        return newSession;
    };

    const value = {
        sessions,
        createSession
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
