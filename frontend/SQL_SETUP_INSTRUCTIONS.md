# SQL Setup Instructions for AI Insights

## ✅ Yes, that's the ONLY SQL you need to add!

The SQL you provided is correct and complete. Here's what to do:

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Run the AI Insights SQL

Copy and paste this **EXACT** SQL (the one you provided):

```sql
-- AI Insights (Patient Analysis and Recommendations)
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES public.demo_users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('progress', 'adherence', 'pain', 'form', 'recommendation', 'risk', 'milestone')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  category TEXT, -- e.g., 'performance', 'safety', 'engagement'
  metadata JSONB, -- Additional data like trends, percentages, etc.
  is_read BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiry date for temporary insights
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_patient ON public.ai_insights(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON public.ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON public.ai_insights(created_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for ai_insights" ON public.ai_insights FOR ALL USING (true) WITH CHECK (true);
```

### Step 3: Execute

Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 4: Verify

Check that the table was created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'ai_insights';
```

You should see `ai_insights` in the results.

## ✅ That's It!

No other SQL changes are needed. The existing schema already has:
- ✅ `sessions` table (stores pain scores, ROM data)
- ✅ `session_metrics` table (stores exercise-level ROM)
- ✅ All other required tables

## Important Notes

1. **Data Persistence**: All session data (pain, ROM, etc.) is already stored permanently in the `sessions` and `session_metrics` tables
2. **No Data Loss**: Sessions persist across day changes - they're stored in Supabase, not localStorage
3. **Session History**: The Patient Dashboard now shows a "Session History" section with all completed sessions

## Troubleshooting

If you see errors:
- **"relation already exists"**: Table already exists, that's fine - the `IF NOT EXISTS` handles this
- **"permission denied"**: Make sure you're using the SQL Editor with proper permissions
- **"syntax error"**: Copy the SQL exactly as shown above

## What This SQL Does

1. Creates `ai_insights` table to store AI-generated insights
2. Creates indexes for fast queries
3. Enables Row Level Security (RLS)
4. Creates a policy allowing all operations (for demo mode)

After running this SQL, the AI Insights feature will work immediately!

