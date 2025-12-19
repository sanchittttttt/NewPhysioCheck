import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import ProtocolBuilder from "./pages/ProtocolBuilder";
import Sessions from "./pages/Sessions";
import Messages from "./pages/Messages";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

// Patient pages
import PatientHome from "./pages/patient/PatientHome";
import PatientSessions from "./pages/patient/PatientSessions";
import PatientSessionActive from "./pages/patient/PatientSessionActive";
import PatientProgress from "./pages/patient/PatientProgress";
import PatientMessages from "./pages/patient/PatientMessages";
import PatientSettings from "./pages/patient/PatientSettings";

const queryClient = new QueryClient();

/**
 * Root redirect component - handles "/" route
 * If user is logged in, redirect to appropriate dashboard
 * Otherwise, show login page
 */
import { useAuth } from "@/context/AuthContext";

/**
 * Root redirect component - handles "/" route
 * If user is logged in, redirect to appropriate dashboard
 * Otherwise, show login page
 */
function RootRedirect() {
  const { role, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>; // Simple loader
  }

  if (role === 'patient') return <Navigate to="/patient/home" replace />;
  if (role === 'doctor' || role === 'admin') return <Navigate to="/dashboard" replace />;

  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        {/* Root route - redirects based on selected role or shows picker */}
        <Route path="/" element={<RootRedirect />} />

        {/* Role picker (replaces auth) */}
        <Route path="/login" element={<Login />} />

        {/* Doctor/Admin routes */}
        <Route path="/dashboard" element={<Index />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/protocol-builder" element={<ProtocolBuilder />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />

        {/* Patient routes */}
        <Route path="/patient/home" element={<PatientHome />} />
        <Route path="/patient/sessions" element={<PatientSessions />} />
        <Route path="/patient/session/active" element={<PatientSessionActive />} />
        <Route path="/patient/progress" element={<PatientProgress />} />
        <Route path="/patient/messages" element={<PatientMessages />} />
        <Route path="/patient/settings" element={<PatientSettings />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;