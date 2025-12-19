/**
 * TypeScript types matching backend API schemas.
 * Based on backend/app/models/schemas.py
 */

// Common types
export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // ISO 8601 datetime

// Error response
export interface ErrorResponse {
  error: string;
  detail?: string | null;
}

// Patient types
export interface Patient {
  id: UUID;
  doctor_id: UUID;
  full_name: string;
  date_of_birth: ISODate | null;
  condition: string | null;
  status: 'active' | 'on_hold' | 'discharged';
  notes: string | null;
  created_at: ISODateTime;
  total_sessions?: number;
  missed_sessions?: number;
}

export interface PatientListResponse {
  data: Patient[];
  total: number;
  skip: number;
  limit: number;
}

export interface PatientCreate {
  full_name: string;
  date_of_birth?: ISODate;
  condition?: string;
  status?: 'active' | 'on_hold' | 'discharged';
  notes?: string;
  doctor_id?: UUID; // Optional - backend sets this from current user
}

export interface PatientUpdate {
  full_name?: string;
  date_of_birth?: ISODate;
  condition?: string;
  status?: 'active' | 'on_hold' | 'discharged';
  notes?: string;
}

// Protocol types
export interface ProtocolStep {
  id: UUID;
  protocol_id: UUID;
  exercise_id: UUID;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  side: 'left' | 'right' | 'both' | null;
  order_index: number;
  notes: string | null;
  created_at: ISODateTime;
}

export interface Protocol {
  id: UUID;
  doctor_id: UUID;
  title: string;
  notes: string | null;
  created_at: ISODateTime;
  steps: ProtocolStep[];
}

export interface ProtocolListResponse {
  data: Protocol[];
  total: number;
}

export interface ProtocolStepCreate {
  exercise_id: UUID;
  sets?: number;
  reps?: number;
  duration_seconds?: number;
  side?: 'left' | 'right' | 'both';
  order_index: number;
  notes?: string;
}

export interface ProtocolCreate {
  title: string;
  notes?: string;
  steps: ProtocolStepCreate[];
}

export interface ProtocolUpdate {
  title?: string;
  notes?: string;
}

// Assignment types
export interface Assignment {
  id: UUID;
  patient_id: UUID;
  protocol_id: UUID;
  doctor_id: UUID;
  start_date: ISODate;
  frequency_per_week: number;
  status: 'active' | 'paused' | 'completed';
  notes: string | null;
  created_at: ISODateTime;
}

export interface AssignmentCreate {
  patient_id: UUID;
  protocol_id: UUID;
  start_date: ISODate;
  frequency_per_week: number;
  status?: 'active' | 'paused' | 'completed';
  notes?: string;
}

export interface AssignmentUpdate {
  start_date?: ISODate;
  frequency_per_week?: number;
  status?: 'active' | 'paused' | 'completed';
  notes?: string;
}

// Session types
export interface SessionRep {
  id: UUID;
  session_id: UUID;
  exercise_id: UUID;
  rep_index: number;
  rom_max: number | null;
  rom_target: number | null;
  accuracy_score: number | null;
  tempo_score: number | null;
  form_quality: number | null;
  error_segment: string | null;
  timestamp_ms: number | null;
  created_at: ISODateTime;
}

export interface Session {
  id: UUID;
  patient_id: UUID;
  assignment_id: UUID;
  protocol_id: UUID;
  status: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed';
  scheduled_date: string | null; // ISO date string (YYYY-MM-DD)
  pain_score_pre: number | null;
  pain_score_post: number | null;
  notes: string | null;
  accuracy_avg: number | null;
  rom_delta: number | null;
  adherence_score: number | null;
  created_at: ISODateTime | null; // May be null for newly created sessions
  started_at: ISODateTime | null; // NULL for scheduled sessions until patient starts
  ended_at: ISODateTime | null;
  reps: SessionRep[];
}

export interface SessionListResponse {
  data: Session[];
  total: number;
}

export interface SessionCreate {
  patient_id: UUID;
  assignment_id: UUID;
  protocol_id: UUID;
  scheduled_date?: string; // ISO date string (YYYY-MM-DD), optional (defaults to today)
}

export interface SessionRepCreate {
  exercise_id: UUID;
  rep_index: number;
  rom_max?: number;
  rom_target?: number;
  accuracy_score?: number;
  tempo_score?: number;
  form_quality?: number;
  error_segment?: string;
  timestamp_ms?: number;
}

export interface SessionComplete {
  pain_score_pre?: number;
  pain_score_post?: number;
  notes?: string;
  reps: SessionRepCreate[];
}

// Message types
export interface Message {
  id: UUID;
  from_user: UUID;
  to_user: UUID;
  text: string;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
}

export interface MessageListResponse {
  data: Message[];
  total: number;
}

export interface MessageCreate {
  to_user: UUID;
  text: string;
}

// Exercise types (for protocol builder)
export interface Exercise {
  id: UUID;
  name: string;
  description: string | null;
  image_url: string | null;
  joint: string | null;
  position: string | null;
  equipment: string | null;
  difficulty: string | null;
  normal_range_min: number | null;
  normal_range_max: number | null;
  created_at: ISODateTime;
}

export interface ExerciseListResponse {
  data: Exercise[];
  total: number;
}

// Query parameter types
export interface PatientListParams {
  skip?: number;
  limit?: number;
  status_filter?: 'active' | 'on_hold' | 'discharged';
  search?: string;
}

export interface SessionListParams {
  patient_id?: UUID;
  date_from?: ISODateTime;
  date_to?: ISODateTime;
}

export interface MessageListParams {
  conversation_with?: UUID;
  limit?: number;
  before?: ISODateTime;
}

