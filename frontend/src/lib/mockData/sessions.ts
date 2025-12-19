/**
 * Mock session and protocol data for development/testing
 */

export interface MockSession {
  id: string;
  patientId: string;
  doctorId: string;
  protocolId: string;
  startDate: string;
  endDate?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  romData?: {
    shoulder?: number;
    elbow?: number;
    knee?: number;
    ankle?: number;
  };
  painLevel?: number; // 0-10
}

export interface MockProtocol {
  id: string;
  patientId: string;
  doctorId: string;
  name: string;
  description: string;
  duration: string; // e.g., "4 weeks"
  exercises: string[];
  frequency: string; // e.g., "3 times per week"
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'paused';
}

// Sample sessions
export const MOCK_SESSIONS: MockSession[] = [
  {
    id: 'session-1',
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    protocolId: 'protocol-1',
    startDate: '2025-12-09T10:00:00',
    status: 'completed',
    romData: {
      knee: 115,
      ankle: 45,
    },
    painLevel: 3,
    notes: 'Patient showed good progress. Range of motion improved by 10 degrees.',
  },
  {
    id: 'session-2',
    patientId: 'patient-2',
    doctorId: 'doctor-1',
    protocolId: 'protocol-2',
    startDate: '2025-12-10T14:00:00',
    status: 'scheduled',
    notes: 'Scheduled for lower back assessment',
  },
  {
    id: 'session-3',
    patientId: 'patient-3',
    doctorId: 'doctor-1',
    protocolId: 'protocol-3',
    startDate: '2025-12-08T09:30:00',
    status: 'completed',
    romData: {
      shoulder: 165,
    },
    painLevel: 2,
  },
];

// Sample protocols
export const MOCK_PROTOCOLS: MockProtocol[] = [
  {
    id: 'protocol-1',
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    name: 'Knee Recovery - Phase 2',
    description: 'Progressive strengthening and range of motion exercises for post-operative knee rehabilitation',
    duration: '6 weeks',
    exercises: [
      'Quad sets with resistance band',
      'Hamstring curls',
      'Leg press with light weight',
      'Balance exercises',
      'Gait training',
    ],
    frequency: '3 times per week',
    startDate: '2025-11-15',
    status: 'active',
  },
  {
    id: 'protocol-2',
    patientId: 'patient-2',
    doctorId: 'doctor-1',
    name: 'Lower Back Strengthening',
    description: 'Core strengthening program for chronic lower back pain management',
    duration: '8 weeks',
    exercises: [
      'Planks progression',
      'Bird dogs',
      'Glute bridges',
      'Dead bug variations',
      'Stretching routine',
    ],
    frequency: '4 times per week',
    startDate: '2025-10-20',
    status: 'active',
  },
  {
    id: 'protocol-3',
    patientId: 'patient-3',
    doctorId: 'doctor-1',
    name: 'Rotator Cuff Therapy',
    description: 'Comprehensive shoulder rehabilitation focusing on rotator cuff strength and stability',
    duration: '12 weeks',
    exercises: [
      'Internal/external rotation with band',
      'Scapular stabilization',
      'Pendulum exercises',
      'Progressive resistance exercises',
      'Postural training',
    ],
    frequency: '3 times per week',
    startDate: '2025-09-10',
    status: 'active',
  },
];

// Get sessions for a patient
export function getMockPatientSessions(patientId: string): MockSession[] {
  return MOCK_SESSIONS.filter((s) => s.patientId === patientId);
}

// Get protocols for a patient
export function getMockPatientProtocols(patientId: string): MockProtocol[] {
  return MOCK_PROTOCOLS.filter((p) => p.patientId === patientId);
}

// Get a specific session
export function getMockSession(sessionId: string): MockSession | undefined {
  return MOCK_SESSIONS.find((s) => s.id === sessionId);
}

// Get a specific protocol
export function getMockProtocol(protocolId: string): MockProtocol | undefined {
  return MOCK_PROTOCOLS.find((p) => p.id === protocolId);
}
