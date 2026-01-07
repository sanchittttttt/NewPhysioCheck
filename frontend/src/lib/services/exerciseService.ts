/**
 * Exercise Service - Supabase Implementation
 * 
 * Handles all exercise-related database operations.
 * Exercises are predefined movements in the exercises table.
 */
import { supabase } from '@/lib/supabaseClient';

export interface Exercise {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  joint: string | null;
  position: string | null;
  difficulty: string | null;
  image_url: string | null;
  normal_rom_min: number | null;
  normal_rom_max: number | null;
  created_at: string;
}

export interface GetExercisesOptions {
  limit?: number;
  joint?: string;
  difficulty?: string;
  search?: string;
}

/**
 * Get all exercises
 */
export async function getExercises(options: GetExercisesOptions = {}): Promise<{ data: Exercise[]; error: any }> {
  try {
    let query = supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true });

    if (options.joint) {
      query = query.eq('joint', options.joint);
    }

    if (options.difficulty) {
      query = query.eq('difficulty', options.difficulty);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ExerciseService] getExercises error:', error);
      return { data: [], error };
    }

    // Apply search filter client-side (Supabase text search is more complex)
    let exercises = (data || []) as Exercise[];
    if (options.search) {
      const search = options.search.toLowerCase();
      exercises = exercises.filter(e =>
        e.name.toLowerCase().includes(search) ||
        (e.description && e.description.toLowerCase().includes(search))
      );
    }

    return { data: exercises, error: null };
  } catch (e) {
    console.error('[ExerciseService] getExercises exception:', e);
    return { data: [], error: e };
  }
}

/**
 * Get a single exercise by ID
 */
export async function getExerciseById(id: string): Promise<{ data: Exercise | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as Exercise, error: null };
  } catch (e) {
    console.error('[ExerciseService] getExerciseById error:', e);
    return { data: null, error: e };
  }
}

/**
 * Get exercise by slug
 */
export async function getExerciseBySlug(slug: string): Promise<{ data: Exercise | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as Exercise, error: null };
  } catch (e) {
    console.error('[ExerciseService] getExerciseBySlug error:', e);
    return { data: null, error: e };
  }
}

// Backward compatible export
export const exerciseService = {
  getAll: async (options: GetExercisesOptions = {}) => getExercises(options),
  getById: async (id: string) => getExerciseById(id),
  getBySlug: getExerciseBySlug,
};
