-- ==============================================
-- PhysioCheck Mock Data Script
-- ==============================================
-- Run this in Supabase SQL Editor to populate your database with demo data.
-- This assumes the tables from "supabase_schema.sql" already exist.

-- 1. Ensure Demo Users
INSERT INTO public.demo_users (id, name, email, role, avatar_url) VALUES
  ('demo-doctor-001', 'Dr. Sarah Chen', 'doctor@demo.physiocheck.com', 'doctor', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'),
  ('demo-patient-001', 'John Smith', 'patient1@demo.physiocheck.com', 'patient', 'https://api.dicebear.com/7.x/avataaars/svg?seed=John'),
  ('demo-patient-002', 'Emily Johnson', 'patient2@demo.physiocheck.com', 'patient', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily'),
  ('demo-patient-003', 'Michael Brown', 'patient3@demo.physiocheck.com', 'patient', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael')
ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url;

-- 2. Doctor Relationships
INSERT INTO public.doctor_patients (doctor_id, patient_id) VALUES
  ('demo-doctor-001', 'demo-patient-001'), -- John assigned to Dr. Sarah
  ('demo-doctor-001', 'demo-patient-002'), -- Emily assigned to Dr. Sarah
  ('demo-doctor-001', 'demo-patient-003')  -- Michael assigned to Dr. Sarah
ON CONFLICT (doctor_id, patient_id) DO NOTHING;

-- 3. Exercises (Base Library)
INSERT INTO public.exercises (id, name, slug, description, joint, position, difficulty) VALUES
  ('ex-squat', 'Squat', 'squat', 'Basic squat movement for lower body strengthening.', 'Knee/Hip', 'Standing', 'Intermediate'),
  ('ex-slr', 'Straight Leg Raise', 'slr', 'Leg raise while lying down for hip flexor strengthening.', 'Hip', 'Supine', 'Beginner'),
  ('ex-elbow', 'Elbow Flexion', 'elbow_flexion', 'Bicep curl movement for elbow rehabilitation.', 'Elbow', 'Sitting', 'Beginner')
ON CONFLICT (id) DO NOTHING;

-- 4. Protocols (Hardcoded UUIDs for referencing)
-- Protocol 1: ACL Rehab
INSERT INTO public.protocols (id, doctor_id, title, description, notes) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-doctor-001', 'ACL Rehabilitation - Phase 1', 'Initial phase focusing on range of motion and quad activation.', 'Focus on form over speed.')
ON CONFLICT (id) DO NOTHING;

-- Protocol 2: Total Knee Replacement
INSERT INTO public.protocols (id, doctor_id, title, description, notes) VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'demo-doctor-001', 'Total Knee Replacement - Post Op', 'Gentle movements to restore function.', 'Pain should be minimal.')
ON CONFLICT (id) DO NOTHING;

-- 5. Protocol Steps (Linking Exercises)
-- ACL Protocol Steps
INSERT INTO public.protocol_steps (protocol_id, exercise_id, sets, reps, duration_seconds, order_index) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ex-squat', 3, 10, NULL, 0),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ex-slr', 3, 15, NULL, 1)
ON CONFLICT DO NOTHING;

-- TKR Protocol Steps
INSERT INTO public.protocol_steps (protocol_id, exercise_id, sets, reps, duration_seconds, order_index) VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'ex-elbow', 3, 10, NULL, 0) -- Using elbow as placeholder for knee flexion
ON CONFLICT DO NOTHING;

-- 6. Assignments
-- Assign ACL Protocol to John (Active)
INSERT INTO public.assignments (id, patient_id, protocol_id, doctor_id, start_date, frequency_per_week, status) VALUES
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'demo-patient-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-doctor-001', CURRENT_DATE - INTERVAL '14 days', 5, 'active')
ON CONFLICT (id) DO NOTHING;

-- Assign TKR Protocol to Emily (Active)
INSERT INTO public.assignments (id, patient_id, protocol_id, doctor_id, start_date, frequency_per_week, status) VALUES
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'demo-patient-002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'demo-doctor-001', CURRENT_DATE - INTERVAL '5 days', 3, 'active')
ON CONFLICT (id) DO NOTHING;

-- 7. Sessions (Historical Data for John)
-- Session 1: 10 days ago (Completed)
INSERT INTO public.sessions (id, patient_id, doctor_id, protocol_id, assignment_id, status, started_at, ended_at, pain_score_pre, pain_score_post) VALUES
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'demo-patient-001', 'demo-doctor-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'completed', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '30 minutes', 3, 2)
ON CONFLICT (id) DO NOTHING;

-- Session 2: 7 days ago (Completed)
INSERT INTO public.sessions (id, patient_id, doctor_id, protocol_id, assignment_id, status, started_at, ended_at, pain_score_pre, pain_score_post) VALUES
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a52', 'demo-patient-001', 'demo-doctor-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'completed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '35 minutes', 2, 1)
ON CONFLICT (id) DO NOTHING;

-- Session 3: 3 days ago (Completed)
INSERT INTO public.sessions (id, patient_id, doctor_id, protocol_id, assignment_id, status, started_at, ended_at, pain_score_pre, pain_score_post) VALUES
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a53', 'demo-patient-001', 'demo-doctor-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '25 minutes', 1, 1)
ON CONFLICT (id) DO NOTHING;

-- Session 4: Today (Scheduled)
INSERT INTO public.sessions (id, patient_id, doctor_id, protocol_id, assignment_id, status, started_at, ended_at, pain_score_pre, pain_score_post) VALUES
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a54', 'demo-patient-001', 'demo-doctor-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'scheduled', NOW() + INTERVAL '10 hours', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Session 5: Tomorrow (Scheduled for Emily)
INSERT INTO public.sessions (id, patient_id, doctor_id, protocol_id, assignment_id, status, started_at, ended_at, pain_score_pre, pain_score_post) VALUES
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'demo-patient-002', 'demo-doctor-001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'scheduled', NOW() + INTERVAL '1 day', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 8. Messages (Conversation History)
-- Chat between Dr. Sarah and John
INSERT INTO public.messages (id, from_user, to_user, text, created_at, read_at) VALUES
  (gen_random_uuid(), 'demo-doctor-001', 'demo-patient-001', 'Hi John, how is the ACL rehab going?', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'demo-patient-001', 'demo-doctor-001', 'Going well Dr. Sarah! Squats feel much stronger.', NOW() - INTERVAL '4 days 23 hours', NOW() - INTERVAL '4 days 22 hours'),
  (gen_random_uuid(), 'demo-doctor-001', 'demo-patient-001', 'Great to hear. Remember to keep your back straight.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  (gen_random_uuid(), 'demo-patient-001', 'demo-doctor-001', 'Will do. Thanks!', NOW() - INTERVAL '3 days', NULL) -- Unread by doctor
ON CONFLICT DO NOTHING;

-- Chat between Dr. Sarah and Emily
INSERT INTO public.messages (id, from_user, to_user, text, created_at, read_at) VALUES
  (gen_random_uuid(), 'demo-doctor-001', 'demo-patient-002', 'Emily, please remember to log your pain scores.', NOW() - INTERVAL '2 days', NULL) -- Unread by Emily
ON CONFLICT DO NOTHING;
