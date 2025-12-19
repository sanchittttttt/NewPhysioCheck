/**
 * Exercise service - Supabase implementation
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  Exercise,
  ExerciseListResponse,
} from '@/types/api';

export const exerciseService = {
  /**
    * Get all exercises in the library
   */
  async getAll(): Promise<ExerciseListResponse> {
    const { data, error, count } = await supabase
      .from('exercises')
      .select('*', { count: 'exact' })
      .order('name');

    if (error) throw error;

    return {
      data: (data || []) as Exercise[],
      total: count || 0,
    };
  },

  /**
   * Get single exercise by ID
   */
  async getById(id: string): Promise<Exercise> {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Exercise;
  },
};
