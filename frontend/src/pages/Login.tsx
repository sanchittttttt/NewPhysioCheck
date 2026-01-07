import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  fetchDemoUsers,
  checkDemoUsersExist,
  seedDemoData,
  DemoUser
} from '@/lib/demoAuth';
import { Loader2, UserCircle, Stethoscope, Users, Database, AlertCircle, CheckCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { toast } = useToast();

  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.role === 'doctor' ? '/dashboard' : '/patient/home');
    }
  }, [user, navigate]);

  // Fetch demo users on mount
  useEffect(() => {
    loadDemoUsers();
  }, []);

  const loadDemoUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      // First check if demo users exist
      const exists = await checkDemoUsersExist();

      if (!exists) {
        setNeedsSeed(true);
        setLoading(false);
        return;
      }

      // Fetch the demo users
      const users = await fetchDemoUsers();
      setDemoUsers(users);
      setNeedsSeed(false);
    } catch (e: any) {
      console.error('[Login] Error loading demo users:', e);
      setError(e.message || 'Failed to load demo users. Check Supabase connection.');
      setNeedsSeed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    setError(null);

    try {
      const result = await seedDemoData();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload demo users
        await loadDemoUsers();
      } else {
        setError(result.message);
        toast({
          title: 'Seed Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to seed demo data');
      toast({
        title: 'Error',
        description: 'Failed to seed demo data',
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleLogin = async (demoUser: DemoUser) => {
    setLoggingIn(demoUser.id);

    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 300));

      login(demoUser);

      toast({
        title: `Welcome, ${demoUser.name}!`,
        description: `Logged in as ${demoUser.role}`,
      });

      // Navigate based on role
      navigate(demoUser.role === 'doctor' ? '/dashboard' : '/patient/home');
    } catch (e) {
      console.error('[Login] Error:', e);
      toast({
        title: 'Login Failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoggingIn(null);
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'doctor' ? (
      <Stethoscope className="w-8 h-8 text-primary" />
    ) : (
      <UserCircle className="w-8 h-8 text-primary" />
    );
  };

  const getRoleDescription = (role: string, index: number) => {
    if (role === 'doctor') {
      return 'View patient progress, create protocols, manage sessions';
    }
    return index === 0
      ? 'View assigned exercises, complete sessions, track progress'
      : 'Secondary patient account for testing';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo/Title */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">PhysioCheck</h1>
          <p className="text-muted-foreground">
            AI-Powered Physical Therapy Platform
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Demo Login</CardTitle>
            <CardDescription>
              Select a demo account to explore the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading demo accounts...</p>
              </div>
            ) : error && needsSeed ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Database Setup Required</p>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSeedData}
                  disabled={seeding}
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Seeding Database...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Seed Demo Data
                    </>
                  )}
                </Button>
              </div>
            ) : needsSeed ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-lg">
                  <Database className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium">No Demo Data Found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click below to set up demo users and sample data.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSeedData}
                  disabled={seeding}
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Seeding Database...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Seed Demo Data
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {demoUsers.map((demoUser, index) => (
                  <Button
                    key={demoUser.id}
                    variant="outline"
                    className="w-full h-auto p-4 flex items-start gap-4 hover:bg-primary/5 hover:border-primary/30 transition-all"
                    onClick={() => handleLogin(demoUser)}
                    disabled={loggingIn !== null}
                  >
                    <div className="shrink-0">
                      {loggingIn === demoUser.id ? (
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      ) : (
                        getRoleIcon(demoUser.role)
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{demoUser.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getRoleDescription(demoUser.role, index)}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${demoUser.role === 'doctor'
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                          {demoUser.role === 'doctor' ? 'Doctor' : 'Patient'}
                        </span>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Demo Mode • No real authentication</p>
          <p>All session data persists to Supabase</p>
        </div>
      </div>
    </div>
  );
}
