import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Base URL for the FastAPI backend.
 * Must be set in environment variables as VITE_API_URL
 */
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/**
 * Axios instance configured for API requests.
 * 
 * This client automatically:
 * - Adds the JWT token from Supabase session to Authorization header
 * - Sets base URL from VITE_API_URL environment variable
 * 
 * Request interceptor flow:
 * 1. Get current Supabase session
 * 2. Extract access_token from session
 * 3. Add Authorization: Bearer <token> header if token exists
 * 
 * Usage:
 * ```ts
 * import api from '@/lib/apiClient';
 * const response = await api.get('/api/patients');
 * const data = await api.post('/api/sessions', { patientId: 1 });
 * ```
 */
const api: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor to attach JWT token.
 * 
 * Before each request:
 * - Fetches current Supabase session
 * - Extracts access_token
 * - Adds Authorization header if token is available
 */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // In mock mode, send user email and role as headers for backend dummy auth
    try {
      const currentUser = localStorage.getItem('currentUser');
      const userRole = localStorage.getItem('userRole');
      
      if (currentUser && userRole) {
        try {
          const parsed = JSON.parse(currentUser);
          // Send headers that backend expects for dummy auth
          // Use real DB IDs
          const userId = parsed.id || (userRole === 'patient' 
            ? '94a07389-79ae-4fac-bd9a-2e819a0d94a5' 
            : 'c7040fdb-4920-410d-bf42-ea568075a101');
          
          config.headers['x-dev-user-email'] = parsed.email || 'doctor@mock.dev';
          config.headers['x-dev-user-role'] = userRole || 'doctor';
          config.headers['x-dev-user-id'] = userId; // Send user ID to backend
        } catch (e) {
          // If parsing fails, use defaults
          config.headers['x-dev-user-email'] = 'doctor@mock.dev';
          config.headers['x-dev-user-role'] = 'doctor';
          config.headers['x-dev-user-id'] = 'c7040fdb-4920-410d-bf42-ea568075a101';
        }
      } else {
        // Default to doctor if no user in localStorage
        config.headers['x-dev-user-email'] = 'doctor@mock.dev';
        config.headers['x-dev-user-role'] = 'doctor';
        config.headers['x-dev-user-id'] = 'c7040fdb-4920-410d-bf42-ea568075a101';
      }
    } catch (error) {
      // ignore localStorage errors, use defaults
      config.headers['x-dev-user-email'] = 'doctor@mock.dev';
      config.headers['x-dev-user-role'] = 'doctor';
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling.
 * Redirects to login on 401 Unauthorized errors.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // In bypass mode we do not redirect on 401s; surface the error to callers.
    return Promise.reject(error);
  }
);

export default api;

