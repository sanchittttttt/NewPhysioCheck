import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { AdherenceChart } from '@/components/dashboard/AdherenceChart';
import { RomPainChart } from '@/components/dashboard/RomPainChart';
import { PatientsAttention } from '@/components/dashboard/PatientsAttention';
import { RecentMessages } from '@/components/dashboard/RecentMessages';
import { patientService } from '@/lib/services/patientService';
import { sessionService } from '@/lib/services/sessionService';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

const Index = () => {
  // Fetch patients
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'dashboard'],
    queryFn: () => patientService.getAll({ limit: 100, status: 'active' }),
  });

  // Fetch sessions for stats
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', 'dashboard'],
    queryFn: () => sessionService.getAll({}),
  });

  const isLoading = patientsLoading || sessionsLoading;

  // Calculate dashboard stats from real data
  const dashboardStats = useMemo(() => {
    const patients = patientsData?.data || [];
    const sessions = sessionsData?.data || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const todaySessions = sessions.filter((s) => {
      const sessionDateStr = s.scheduled_date || (s.started_at ? s.started_at.split('T')[0] : null);
      if (!sessionDateStr) return false;
      return sessionDateStr === todayStr.split('T')[0]; // Include all sessions for today, not just completed
    });

    // Calculate patients needing attention (low adherence or high pain)
    const patientsWithIssues = patients.filter((patient) => {
      const patientSessions = sessions.filter((s) => s.patient_id === patient.id);
      const completedSessions = patientSessions.filter((s) => s.status === 'completed');
      const adherence =
        completedSessions.length > 0
          ? (completedSessions.length / Math.max(patientSessions.length, 1)) * 100
          : 0;
      const recentHighPain = completedSessions.some(
        (s) => s.pain_score_post !== null && s.pain_score_post >= 7
      );
      return adherence < 50 || recentHighPain;
    });

    // Calculate trend (simple: compare to previous period)
    // TODO: Replace with proper trend calculation when date filtering is implemented
    const activePatientsTrend = 0; // Placeholder
    const todaySessionsTrend = 0; // Placeholder

    return {
      activePatients: patients.filter((p) => p.status === 'active').length,
      activePatientsTrend,
      todaySessions: todaySessions.length,
      todaySessionsTrend,
      urgentAlerts: patientsWithIssues.length,
      alertTags: Array.from(
        new Set(
          patientsWithIssues.flatMap((p) => {
            const tags: string[] = [];
            const patientSessions = sessions.filter((s) => s.patient_id === p.id);
            const completedSessions = patientSessions.filter((s) => s.status === 'completed');
            const adherence =
              completedSessions.length > 0
                ? (completedSessions.length / Math.max(patientSessions.length, 1)) * 100
                : 0;
            if (adherence < 50) tags.push('Low Adherence');
            if (completedSessions.some((s) => s.pain_score_post !== null && s.pain_score_post >= 7)) {
              tags.push('Pain Spike');
            }
            return tags;
          })
        )
      ).slice(0, 2),
    };
  }, [patientsData, sessionsData]);

  if (isLoading) {
    return (
      <MainLayout title="Home Dashboard">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading dashboard...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Home Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Active Patients"
            value={dashboardStats.activePatients}
            trend={dashboardStats.activePatientsTrend}
          />
          <StatCard
            title="Today's Sessions"
            value={dashboardStats.todaySessions}
            trend={dashboardStats.todaySessionsTrend}
          />
          <StatCard
            title="Urgent Alerts"
            value={dashboardStats.urgentAlerts}
            tags={dashboardStats.alertTags}
            highlight
            icon={<AlertTriangle className="w-5 h-5 text-warning" />}
          />
        </div>

        {/* Middle Row - Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AdherenceChart />
          <RomPainChart />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PatientsAttention />
          <RecentMessages />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
