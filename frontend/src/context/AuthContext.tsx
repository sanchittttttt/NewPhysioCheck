import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DemoUser, getDemoUser, setDemoUser, logoutDemoUser } from '@/lib/demoAuth';

// Re-export DemoUser as AuthUser for compatibility
export type AuthUser = DemoUser;
export type Role = 'doctor' | 'patient';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  // Legacy compatibility
  loginAsDoctor: () => void;
  loginAsPatient: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage on mount
  useEffect(() => {
    const storedUser = getDemoUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = (demoUser: AuthUser) => {
    setDemoUser(demoUser);
    setUser(demoUser);
  };

  const logout = () => {
    logoutDemoUser();
    setUser(null);
  };

  // Legacy compatibility for components that use these
  const loginAsDoctor = () => {
    const doctorUser: AuthUser = {
      id: 'demo-doctor-001',
      name: 'Dr. Sarah Chen',
      email: 'doctor@demo.physiocheck.com',
      role: 'doctor',
    };
    login(doctorUser);
  };

  const loginAsPatient = () => {
    const patientUser: AuthUser = {
      id: 'demo-patient-001',
      name: 'John Smith',
      email: 'patient1@demo.physiocheck.com',
      role: 'patient',
    };
    login(patientUser);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    loginAsDoctor,
    loginAsPatient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
