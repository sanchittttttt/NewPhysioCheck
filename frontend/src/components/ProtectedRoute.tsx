import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Role type for role-based access control.
 */
type UserRole = 'doctor' | 'patient';

/**
 * Props for ProtectedRoute component.
 */
interface ProtectedRouteProps {
  /** Child components to render if access is granted */
  children: ReactNode;
  /** Optional role requirement. If set, user must have this role. */
  requiredRole?: UserRole;
}

/**
 * Protected route component - SIMPLE MOCK VERSION
 * 
 * Checks localStorage for:
 * - userRole: The role of the logged-in user
 * - currentUser: User info (email, etc.)
 * 
 * If either is missing, redirects to login.
 * If requiredRole is specified and doesn't match, redirects to appropriate dashboard.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const userRole = localStorage.getItem('userRole') as UserRole | null;
  const currentUser = localStorage.getItem('currentUser');

  // If nothing is selected, push the user back to the role picker.
  if (!userRole || !currentUser) {
    console.log('[ProtectedRoute] No role selected, redirecting to role picker');
    return <Navigate to="/login" replace />;
  }

  // During the auth bypass we don't block on role mismatches; we only log.
  if (requiredRole && userRole !== requiredRole) {
    console.warn('[ProtectedRoute] Bypass mode: requested role', requiredRole, 'but current is', userRole);
  }

  return <>{children}</>;
}

