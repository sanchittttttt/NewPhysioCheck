/**
 * Mock protocol templates and assignments
 */

export interface MockProtocolStep {
    id: string;
    protocol_id: string;
    exercise_id: string;
    sets: number | null;
    reps: number | null;
    duration_seconds: number | null;
    side: 'left' | 'right' | 'both' | null;
    order_index: number;
    notes: string | null;
    created_at: string;
}

export interface MockProtocol {
    id: string;
    doctor_id: string;
    title: string;
    notes: string | null;
    created_at: string;
    steps: MockProtocolStep[];
}

export interface MockAssignment {
    id: string;
    patient_id: string;
    protocol_id: string;
    doctor_id: string;
    start_date: string;
    frequency_per_week: number;
    status: 'active' | 'paused' | 'completed';
    notes: string | null;
    created_at: string;
}

export const MOCK_PROTOCOLS: MockProtocol[] = [
    {
        id: 'protocol-1',
        doctor_id: 'doctor-1',
        title: 'Knee Recovery - Phase 2',
        notes: 'Progressive strengthening for post-operative knee rehabilitation',
        created_at: '2025-11-01T00:00:00Z',
        steps: [
            {
                id: 'step-1',
                protocol_id: 'protocol-1',
                exercise_id: 'ex-1',
                sets: 3,
                reps: 15,
                duration_seconds: null,
                side: 'both',
                order_index: 0,
                notes: 'Focus on muscle contraction',
                created_at: '2025-11-01T00:00:00Z',
            },
            {
                id: 'step-2',
                protocol_id: 'protocol-1',
                exercise_id: 'ex-2',
                sets: 3,
                reps: 12,
                duration_seconds: null,
                side: 'both',
                order_index: 1,
                notes: 'Slow and controlled movement',
                created_at: '2025-11-01T00:00:00Z',
            },
            {
                id: 'step-3',
                protocol_id: 'protocol-1',
                exercise_id: 'ex-8',
                sets: 3,
                reps: 10,
                duration_seconds: null,
                side: 'both',
                order_index: 2,
                notes: 'Start with light weight',
                created_at: '2025-11-01T00:00:00Z',
            },
        ],
    },
    {
        id: 'protocol-2',
        doctor_id: 'doctor-1',
        title: 'Lower Back Strengthening',
        notes: 'Core strengthening program for chronic lower back pain',
        created_at: '2025-10-15T00:00:00Z',
        steps: [
            {
                id: 'step-4',
                protocol_id: 'protocol-2',
                exercise_id: 'ex-3',
                sets: 3,
                reps: null,
                duration_seconds: 30,
                side: null,
                order_index: 0,
                notes: 'Maintain neutral spine',
                created_at: '2025-10-15T00:00:00Z',
            },
            {
                id: 'step-5',
                protocol_id: 'protocol-2',
                exercise_id: 'ex-4',
                sets: 3,
                reps: 10,
                duration_seconds: null,
                side: 'both',
                order_index: 1,
                notes: 'Alternate sides',
                created_at: '2025-10-15T00:00:00Z',
            },
            {
                id: 'step-6',
                protocol_id: 'protocol-2',
                exercise_id: 'ex-7',
                sets: 3,
                reps: 15,
                duration_seconds: null,
                side: null,
                order_index: 2,
                notes: 'Squeeze glutes at top',
                created_at: '2025-10-15T00:00:00Z',
            },
        ],
    },
    {
        id: 'protocol-3',
        doctor_id: 'doctor-1',
        title: 'Rotator Cuff Therapy',
        notes: 'Shoulder rehabilitation focusing on rotator cuff strength',
        created_at: '2025-09-01T00:00:00Z',
        steps: [
            {
                id: 'step-7',
                protocol_id: 'protocol-3',
                exercise_id: 'ex-5',
                sets: 3,
                reps: 15,
                duration_seconds: null,
                side: 'both',
                order_index: 0,
                notes: 'Keep elbow at 90 degrees',
                created_at: '2025-09-01T00:00:00Z',
            },
            {
                id: 'step-8',
                protocol_id: 'protocol-3',
                exercise_id: 'ex-6',
                sets: 3,
                reps: 15,
                duration_seconds: null,
                side: 'both',
                order_index: 1,
                notes: 'Control the movement',
                created_at: '2025-09-01T00:00:00Z',
            },
        ],
    },
];

export const MOCK_ASSIGNMENTS: MockAssignment[] = [
    {
        id: 'assign-1',
        patient_id: 'patient-1',
        protocol_id: 'protocol-1',
        doctor_id: 'doctor-1',
        start_date: '2025-11-15',
        frequency_per_week: 3,
        status: 'active',
        notes: 'Patient responding well to treatment',
        created_at: '2025-11-15T00:00:00Z',
    },
    {
        id: 'assign-2',
        patient_id: 'patient-2',
        protocol_id: 'protocol-2',
        doctor_id: 'doctor-1',
        start_date: '2025-10-20',
        frequency_per_week: 4,
        status: 'active',
        notes: 'Monitor for pain during exercises',
        created_at: '2025-10-20T00:00:00Z',
    },
    {
        id: 'assign-3',
        patient_id: 'patient-3',
        protocol_id: 'protocol-3',
        doctor_id: 'doctor-1',
        start_date: '2025-09-10',
        frequency_per_week: 3,
        status: 'active',
        notes: 'Excellent progress on ROM',
        created_at: '2025-09-10T00:00:00Z',
    },
];

export function getMockProtocols(doctorId?: string): MockProtocol[] {
    if (doctorId) {
        return MOCK_PROTOCOLS.filter((p) => p.doctor_id === doctorId);
    }
    return MOCK_PROTOCOLS;
}

export function getMockProtocol(id: string): MockProtocol | undefined {
    return MOCK_PROTOCOLS.find((p) => p.id === id);
}

export function getMockAssignments(patientId?: string): MockAssignment[] {
    if (patientId) {
        return MOCK_ASSIGNMENTS.filter((a) => a.patient_id === patientId);
    }
    return MOCK_ASSIGNMENTS;
}

export function getMockAssignment(id: string): MockAssignment | undefined {
    return MOCK_ASSIGNMENTS.find((a) => a.id === id);
}
