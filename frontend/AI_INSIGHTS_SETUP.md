# AI Insights Setup Guide

This guide explains how to set up and use the AI Insights feature with external AI service integration.

## Features

✅ **External AI Service Integration** - Connect to OpenAI for sophisticated insights  
✅ **Real-time Insight Generation** - Automatically generates insights after each session  
✅ **Critical Insight Notifications** - Get notified when critical insights are generated  
✅ **Fallback to Rule-based** - Works without AI service using rule-based logic  

## Environment Variables

Add these to your `.env` file in the `frontend` directory:

```env
# Google Gemini Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent

# Enable AI Service
VITE_USE_AI_SERVICE=true

# Existing Supabase variables
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Getting Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env` file

**Benefits of Gemini:**
- Free tier available (generous limits)
- Fast response times
- Excellent JSON generation
- No credit card required for basic usage

**Note:** If you don't set `VITE_USE_AI_SERVICE=true` or don't provide an API key, the system will automatically fall back to rule-based insight generation.

## How It Works

### 1. Real-time Insight Generation

When a patient completes a session:
- The system automatically analyzes session data
- Generates insights using AI (if configured) or rule-based logic
- Stores insights in the database
- Triggers notifications for critical insights

### 2. AI Service Integration

The AI service (`aiService.ts`) uses Google Gemini API to:
- Analyze patient session patterns
- Identify trends in pain, ROM, adherence
- Generate clinically relevant insights
- Prioritize by severity (critical > warning > info > success)

**Gemini Features:**
- Fast response times
- Free tier with generous limits
- Excellent JSON generation
- No credit card required for basic usage

### 3. Notification System

- **Critical insights** trigger immediate toast notifications
- **Notification bell** in the top bar shows unread count
- **Auto-refresh** every 30 seconds
- **Click to view** navigates to patient detail page

## Insight Types

The system generates insights in these categories:

- **Progress** - ROM improvements, milestones
- **Adherence** - Session completion rates
- **Pain** - Pain score trends and changes
- **Form** - Exercise form accuracy issues
- **Recommendation** - Protocol adjustments
- **Risk** - Safety concerns
- **Milestone** - Achievement celebrations

## Severity Levels

- **Critical** 🔴 - Requires immediate attention (e.g., increasing pain, safety concerns)
- **Warning** 🟡 - Needs review (e.g., low adherence, form issues)
- **Info** 🔵 - Informational (e.g., progress updates)
- **Success** 🟢 - Positive achievements (e.g., milestones, improvements)

## Usage

### For Doctors

1. **View Insights**: Go to any patient detail page (`/patients/:id`)
2. **Generate Insights**: Click "Generate Insights" button
3. **View Notifications**: Click the notification bell in the top bar
4. **Auto-generation**: Insights are automatically generated after each patient session

### For Patients

1. **View Insights**: Go to Progress page (`/patient/progress`)
2. **See Notifications**: Notification bell shows critical insights
3. **Auto-updates**: Insights update automatically as you complete sessions

## Database Schema

The `ai_insights` table stores:
- Patient ID
- Insight type and category
- Title and description
- Severity level
- Metadata (JSONB)
- Read/unread status
- Generated timestamp

Run the SQL schema update in Supabase:
```sql
-- See supabase_schema.sql for the full schema
```

## Customization

### Modify AI Prompts

Edit `frontend/src/lib/services/aiService.ts`:
- Update the `prompt` variable in `generateInsightsWithGemini()` function
- Adjust `temperature` (0.0-1.0) for different response styles (default: 0.7)
- Modify `maxOutputTokens` for longer/shorter responses (default: 2000)
- Change model in `VITE_GEMINI_API_URL` (default: `gemini-pro`)

### Add Custom Insight Types

1. Update `insight_type` enum in database schema
2. Add to TypeScript types in `database.types.ts`
3. Update AI service prompts
4. Add UI handling in components

### Change Notification Behavior

Edit `frontend/src/context/NotificationContext.tsx`:
- Modify refresh interval (currently 30 seconds)
- Change notification display duration
- Customize toast notifications

## Troubleshooting

### Insights Not Generating

1. Check browser console for errors
2. Verify database connection
3. Ensure patient has completed sessions
4. Check if AI service is configured correctly

### AI Service Not Working

1. Verify `VITE_GEMINI_API_KEY` is set in your `.env` file
2. Check `VITE_USE_AI_SERVICE=true` is set
3. Verify API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)
4. Check API quota/limits in Google Cloud Console
5. Review network requests in browser DevTools
6. Check browser console for specific error messages
7. System will automatically fallback to rule-based generation if Gemini fails

### Notifications Not Showing

1. Check `NotificationProvider` is in `main.tsx`
2. Verify user is logged in
3. Check browser console for errors
4. Ensure critical insights exist in database

## Cost Considerations

**Google Gemini:**
- **Free tier**: 60 requests per minute, generous daily quota
- **Paid tier**: Very competitive pricing (~$0.00025-0.0005 per insight generation)
- Average insight generation: ~500-1000 tokens per patient
- **Cost**: Free for most use cases with generous free tier

**Recommendations:**
- **Free tier is perfect** for development and testing
- Use `gemini-pro` model (default) - excellent quality and free
- Batch insights generation to optimize API usage
- Cache insights for a period before regenerating
- Consider rate limiting for high-volume usage
- Monitor usage in Google Cloud Console

## Security Notes

- **Never commit API keys** to version control
- Use environment variables for all secrets
- Consider using a backend proxy for API calls in production
- Implement rate limiting to prevent abuse
- Monitor API usage and costs

## Future Enhancements

Potential improvements:
- [ ] Backend API proxy for AI calls
- [ ] Caching and deduplication
- [ ] Scheduled insight generation
- [ ] Email notifications for critical insights
- [ ] Insight history and trends
- [ ] Custom AI model fine-tuning
- [ ] Multi-language support

