/**
 * Database type definitions for Supabase.
 * 
 * Updated to include demo tables for PhysioCheck demo mode.
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
      // Demo users table (replaces real auth for demo)
      demo_users: {
        Row: {
          id: string
          name: string
          email: string
          role: 'doctor' | 'patient'
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role: 'doctor' | 'patient'
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: 'doctor' | 'patient'
          avatar_url?: string | null
          created_at?: string
        }
      }
      // Doctor-patient relationships
      doctor_patients: {
        Row: {
          id: string
          doctor_id: string
          patient_id: string
          created_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          patient_id: string
          created_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          patient_id?: string
          created_at?: string
        }
      }
      // Exercise library
      exercises: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          joint: string | null
          position: string | null
          difficulty: string | null
          image_url: string | null
          normal_rom_min: number | null
          normal_rom_max: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          joint?: string | null
          position?: string | null
          difficulty?: string | null
          image_url?: string | null
          normal_rom_min?: number | null
          normal_rom_max?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          joint?: string | null
          position?: string | null
          difficulty?: string | null
          image_url?: string | null
          normal_rom_min?: number | null
          normal_rom_max?: number | null
          created_at?: string
        }
      }
      // Protocols (exercise plans)
      protocols: {
        Row: {
          id: string
          doctor_id: string
          title: string
          description: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          title: string
          description?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          title?: string
          description?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      // Sessions (workout sessions)
      sessions: {
        Row: {
          id: string
          patient_id: string
          doctor_id: string | null
          protocol_id: string | null
          assignment_id: string | null
          status: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed'
          started_at: string | null
          ended_at: string | null
          pain_score_pre: number | null
          pain_score_post: number | null
          notes: string | null
          summary: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          doctor_id?: string | null
          protocol_id?: string | null
          assignment_id?: string | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed'
          started_at?: string | null
          ended_at?: string | null
          pain_score_pre?: number | null
          pain_score_post?: number | null
          notes?: string | null
          summary?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          doctor_id?: string | null
          protocol_id?: string | null
          assignment_id?: string | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'missed'
          started_at?: string | null
          ended_at?: string | null
          pain_score_pre?: number | null
          pain_score_post?: number | null
          notes?: string | null
          summary?: Json | null
          created_at?: string
        }
      }
      // Session metrics (per-exercise data)
      session_metrics: {
        Row: {
          id: string
          session_id: string
          exercise_slug: string
          metrics: Json
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          exercise_slug: string
          metrics: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          exercise_slug?: string
          metrics?: Json
          created_at?: string
        }
      }
      // Assignments (protocol assignments to patients)
      assignments: {
        Row: {
          id: string
          patient_id: string
          protocol_id: string
          doctor_id: string
          start_date: string
          end_date: string | null
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
          end_date?: string | null
          frequency_per_week?: number
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
          end_date?: string | null
          frequency_per_week?: number
          status?: 'active' | 'paused' | 'completed'
          notes?: string | null
          created_at?: string
        }
      }
      // Legacy profiles table (kept for compatibility)
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
      // Legacy patients table
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
      // AI Insights
      ai_insights: {
        Row: {
          id: string
          patient_id: string
          insight_type: 'progress' | 'adherence' | 'pain' | 'form' | 'recommendation' | 'risk' | 'milestone'
          title: string
          description: string
          severity: 'info' | 'warning' | 'critical' | 'success' | null
          category: string | null
          metadata: Json | null
          is_read: boolean
          generated_at: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          insight_type: 'progress' | 'adherence' | 'pain' | 'form' | 'recommendation' | 'risk' | 'milestone'
          title: string
          description: string
          severity?: 'info' | 'warning' | 'critical' | 'success' | null
          category?: string | null
          metadata?: Json | null
          is_read?: boolean
          generated_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          insight_type?: 'progress' | 'adherence' | 'pain' | 'form' | 'recommendation' | 'risk' | 'milestone'
          title?: string
          description?: string
          severity?: 'info' | 'warning' | 'critical' | 'success' | null
          category?: string | null
          metadata?: Json | null
          is_read?: boolean
          generated_at?: string
          expires_at?: string | null
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
