# Data Persistence Guide

## ✅ Data IS Stored Permanently in Database

All session data including **pain levels** and **ROM (Range of Motion)** are stored permanently in Supabase:

### Database Tables

1. **`sessions` table** stores:
   - `pain_score_pre` (INTEGER, 0-10) - Pre-session pain level
   - `pain_score_post` (INTEGER, 0-10) - Post-session pain level  
   - `summary` (JSONB) - Contains `rom_delta` (Range of Motion improvement)
   - `started_at` (TIMESTAMPTZ) - Session start time
   - `ended_at` (TIMESTAMPTZ) - Session end time
   - `created_at` (TIMESTAMPTZ) - Record creation time

2. **`session_metrics` table** stores:
   - Per-exercise metrics including `avg_rom` (average ROM per exercise)
   - Exercise-specific ROM data
   - Form accuracy data

### Data Persistence

✅ **All data persists across:**
- Day changes
- Browser refreshes
- Logout/login cycles
- App restarts

## Why Data Might Seem to Reset

### 1. Date Range Filters

Some pages filter sessions by date range:
- **Patient Progress** page defaults to "Last 30 days"
- **Patient Sessions** page has time filters (30/90 days/all)

**Solution:** Change the date filter to "All time" to see all historical data.

### 2. Session Context Refresh

After saving a session, the SessionContext automatically refreshes to show the new session immediately.

### 3. Viewing Different Pages

Different pages may show different subsets of data:
- **Home page** shows recent/upcoming sessions
- **Progress page** shows filtered sessions based on date range
- **Sessions page** shows all sessions (with optional filters)

## Verifying Data Persistence

### Check Database Directly

1. Go to Supabase Dashboard → Table Editor → `sessions`
2. You should see all sessions with:
   - Pain scores (`pain_score_pre`, `pain_score_post`)
   - ROM data in `summary` JSONB field
   - Timestamps (`started_at`, `ended_at`, `created_at`)

### Check Session Metrics

1. Go to Supabase Dashboard → Table Editor → `session_metrics`
2. You should see exercise-level ROM data (`avg_rom` in metrics JSONB)

## Data Flow

```
Patient Completes Session
    ↓
saveSessionToSupabase() saves to database
    ↓
- pain_score_pre/post → sessions table
- rom_delta → sessions.summary JSONB
- exercise ROM → session_metrics table
    ↓
SessionContext.refreshSessions() fetches from database
    ↓
All pages show updated data
```

## Troubleshooting

### If data seems to disappear:

1. **Check date filters** - Make sure you're not filtering by date range
2. **Refresh the page** - Data loads from database on page load
3. **Check browser console** - Look for database errors
4. **Verify Supabase connection** - Check `.env` file has correct credentials
5. **Check database directly** - Use Supabase Dashboard to verify data exists

### If data is not saving:

1. Check browser console for errors
2. Verify Supabase connection is working
3. Check network tab for failed API calls
4. Ensure user is logged in (required for saving)

## Important Notes

- **No local storage** - All data is in Supabase database
- **No data expiration** - Sessions persist indefinitely
- **Date filters are UI-only** - They don't delete data, just filter the view
- **Automatic refresh** - SessionContext refreshes after saving

## Data Retention

All session data is retained permanently unless:
- Manually deleted from database
- Patient account is deleted (CASCADE delete)
- Database is reset/cleared

