import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Supabase project URL.
 * Must be set in environment variables as VITE_SUPABASE_URL
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

/**
 * Supabase anonymous/public key.
 * Must be set in environment variables as VITE_SUPABASE_ANON_KEY
 */
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Validates that required environment variables are present.
 * Throws a descriptive error if they are missing.
 */
if (!supabaseUrl) {
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable. Please add it to your .env file.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. Please add it to your .env file.'
  );
}

/**
 * Typed Supabase client instance.
 * 
 * This client is used throughout the application for:
 * - Authentication (sign in, sign out, session management)
 * - Database queries (once types are added to database.types.ts)
 * 
 * Usage:
 * ```ts
 * import { supabase } from '@/lib/supabaseClient';
 * const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 * ```
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

