/**
 * Database type definitions for Supabase.
 * 
 * This file will be auto-generated once you connect your Supabase project.
 * For now, it's a placeholder with a minimal Database type.
 * 
 * To generate types:
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Run: supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
 * 
 * Or use the Supabase dashboard: Settings > API > Generate TypeScript types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'doctor' | 'patient'
          first_name: string | null
          last_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          role: 'doctor' | 'patient'
          first_name?: string | null
          last_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'doctor' | 'patient'
          first_name?: string | null
          last_name?: string | null
          created_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          doctor_id: string
          full_name: string
          date_of_birth: string | null
          condition: string | null
          status: 'active' | 'on_hold' | 'discharged'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          full_name: string
          date_of_birth?: string | null
          condition?: string | null
          status?: 'active' | 'on_hold' | 'discharged'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          full_name?: string
          date_of_birth?: string | null
          condition?: string | null
          status?: 'active' | 'on_hold' | 'discharged'
          notes?: string | null
          created_at?: string
        }
      }
      protocols: {
        Row: {
          id: string
          doctor_id: string
          title: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          title: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          title?: string
          notes?: string | null
          created_at?: string
        }
      }
      assignments: {
        Row: {
          id: string
          patient_id: string
          protocol_id: string
          doctor_id: string
          start_date: string
          frequency_per_week: number
          status: 'active' | 'paused' | 'completed'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          protocol_id: string
          doctor_id: string
          start_date: string
          frequency_per_week: number
          status?: 'active' | 'paused' | 'completed'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          protocol_id?: string
          doctor_id?: string
          start_date?: string
          frequency_per_week?: number
          status?: 'active' | 'paused' | 'completed'
          notes?: string | null
          created_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          patient_id: string
          assignment_id: string
          protocol_id: string
          status: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed'
          scheduled_date: string | null
          started_at: string | null
          ended_at: string | null
          pain_score_pre: number | null
          pain_score_post: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          assignment_id: string
          protocol_id: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed'
          scheduled_date?: string | null
          started_at?: string | null
          ended_at?: string | null
          pain_score_pre?: number | null
          pain_score_post?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          assignment_id?: string
          protocol_id?: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed'
          scheduled_date?: string | null
          started_at?: string | null
          ended_at?: string | null
          pain_score_pre?: number | null
          pain_score_post?: number | null
          notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}


