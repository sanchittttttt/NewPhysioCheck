-- ==============================================
-- PhysioCheck Demo Mode - Supabase Schema
-- ==============================================
-- Run this SQL in your Supabase Dashboard > SQL Editor
-- This creates all tables needed for demo mode WITHOUT auth.

-- Demo Users Table (replaces real auth for demo)
CREATE TABLE IF NOT EXISTS public.demo_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'patient')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor-Patient Relationships
CREATE TABLE IF NOT EXISTS public.doctor_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id TEXT NOT NULL REFERENCES public.demo_users(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES public.demo_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_id, patient_id)
);

-- Exercises Library
CREATE TABLE IF NOT EXISTS public.exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  joint TEXT,
  position TEXT,
  difficulty TEXT,
  image_url TEXT,
  normal_rom_min NUMERIC,
  normal_rom_max NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protocols (Exercise Plans)
CREATE TABLE IF NOT EXISTS public.protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id TEXT REFERENCES public.demo_users(id),
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protocol Steps (Exercises in a Protocol)
CREATE TABLE IF NOT EXISTS public.protocol_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES public.exercises(id),
  sets INTEGER DEFAULT 3,
  reps INTEGER DEFAULT 10,
  duration_seconds INTEGER,
  rest_seconds INTEGER,
  side TEXT, -- 'left', 'right', 'both'
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (Workout Sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES public.demo_users(id) ON DELETE CASCADE,
  doctor_id TEXT REFERENCES public.demo_users(id),
  protocol_id UUID REFERENCES public.protocols(id),
  assignment_id UUID,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'incomplete', 'missed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  pain_score_pre INTEGER CHECK (pain_score_pre BETWEEN 0 AND 10),
  pain_score_post INTEGER CHECK (pain_score_post BETWEEN 0 AND 10),
  notes TEXT,
  summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Metrics (Per-Exercise Data)
CREATE TABLE IF NOT EXISTS public.session_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  exercise_slug TEXT NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments (Protocol Assignments)
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES public.demo_users(id) ON DELETE CASCADE,
  protocol_id UUID NOT NULL REFERENCES public.protocols(id),
  doctor_id TEXT NOT NULL REFERENCES public.demo_users(id),
  start_date DATE NOT NULL,
  end_date DATE,
  frequency_per_week INTEGER DEFAULT 3,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (Doctor-Patient Communication)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user TEXT NOT NULL REFERENCES public.demo_users(id) ON DELETE CASCADE,
  to_user TEXT NOT NULL REFERENCES public.demo_users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON public.sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor ON public.sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_metrics_session ON public.session_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patients_patient ON public.doctor_patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_from ON public.messages(from_user);
CREATE INDEX IF NOT EXISTS idx_messages_to ON public.messages(to_user);
CREATE INDEX IF NOT EXISTS idx_protocol_steps_protocol ON public.protocol_steps(protocol_id);

-- ==============================================
-- DISABLE RLS FOR DEMO MODE (No auth)
-- ==============================================
-- For demo mode, we keep RLS open so any client can read/write
-- In production, you would enable RLS and add proper policies

ALTER TABLE public.demo_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_steps ENABLE ROW LEVEL SECURITY;

-- Open policies for demo mode (allow all operations)
CREATE POLICY "Allow all for demo_users" ON public.demo_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for doctor_patients" ON public.doctor_patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for exercises" ON public.exercises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for protocols" ON public.protocols FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for session_metrics" ON public.session_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for protocol_steps" ON public.protocol_steps FOR ALL USING (true) WITH CHECK (true);

-- ==============================================
-- SEED DATA (Optional - can also be done from UI)
-- ==============================================

-- Demo Users
INSERT INTO public.demo_users (id, name, email, role) VALUES
  ('demo-doctor-001', 'Dr. Sarah Chen', 'doctor@demo.physiocheck.com', 'doctor'),
  ('demo-patient-001', 'John Smith', 'patient1@demo.physiocheck.com', 'patient'),
  ('demo-patient-002', 'Emily Johnson', 'patient2@demo.physiocheck.com', 'patient')
ON CONFLICT (id) DO NOTHING;

-- Doctor-Patient Relationships
INSERT INTO public.doctor_patients (doctor_id, patient_id) VALUES
  ('demo-doctor-001', 'demo-patient-001'),
  ('demo-doctor-001', 'demo-patient-002')
ON CONFLICT (doctor_id, patient_id) DO NOTHING;

-- Exercises
INSERT INTO public.exercises (id, name, slug, description, joint, position, difficulty) VALUES
  ('ex-squat', 'Squat', 'squat', 'Basic squat movement for lower body strengthening', 'Knee/Hip', 'Standing', 'Intermediate'),
  ('ex-slr', 'Straight Leg Raise', 'slr', 'Leg raise while lying down for hip flexor strengthening', 'Hip', 'Supine', 'Beginner'),
  ('ex-elbow', 'Elbow Flexion', 'elbow_flexion', 'Bicep curl movement for elbow rehabilitation', 'Elbow', 'Sitting/Standing', 'Beginner')
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- VERIFICATION QUERY
-- ==============================================
-- Run this to verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
