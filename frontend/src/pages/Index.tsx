import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { AdherenceChart } from '@/components/dashboard/AdherenceChart';
import { RomPainChart } from '@/components/dashboard/RomPainChart';
import { PatientsAttention } from '@/components/dashboard/PatientsAttention';
import { RecentMessages } from '@/components/dashboard/RecentMessages';
import { useSession } from '@/context/SessionContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { getDemoUser, getDoctorPatients, DemoUser } from '@/lib/demoAuth';

const Index = () => {
  const { sessions: allSessions, loading: sessionsLoading } = useSession();
  const [patients, setPatients] = useState<DemoUser[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);

  // Fetch patients for the doctor
  useEffect(() => {
    const fetchPatients = async () => {
      const user = getDemoUser();
      if (user?.role === 'doctor') {
        const doctorPatients = await getDoctorPatients(user.id);
        setPatients(doctorPatients);
      }
      setPatientsLoading(false);
    };
    fetchPatients();
  }, []);

  // Calculate dashboard stats from real data
  const dashboardStats = useMemo(() => {
    const today = new Date();
    const getLocalDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayStr = getLocalDateString(today);

    const todaySessions = allSessions.filter((s) => {
      const sessionDateStr = s.scheduled_date || (s.started_at ? s.started_at.split('T')[0] : null);
      return sessionDateStr === todayStr;
    });

    // Calculate patients needing attention (those with incomplete or missed sessions recently)
    const recentSessions = allSessions.filter(s => {
      const sessionDate = new Date(s.started_at || s.created_at);
      const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7; // Last 7 days
    });

    const patientSessionMap = new Map<string, { completed: number; total: number; avgPain: number }>();
    recentSessions.forEach(s => {
      if (!patientSessionMap.has(s.patient_id)) {
        patientSessionMap.set(s.patient_id, { completed: 0, total: 0, avgPain: 0 });
      }
      const stats = patientSessionMap.get(s.patient_id)!;
      stats.total++;
      if (s.status === 'completed') stats.completed++;
      if (s.pain_score_post) stats.avgPain = (stats.avgPain + s.pain_score_post) / 2;
    });

    // Patients with low adherence (<50%) or high pain (>7)
    const patientsWithIssues = Array.from(patientSessionMap.entries()).filter(([_, stats]) => {
      const adherence = stats.total > 0 ? stats.completed / stats.total : 1;
      return adherence < 0.5 || stats.avgPain > 7;
    });

    const alertTags: string[] = [];
    if (patientsWithIssues.some(([_, s]) => s.total > s.completed)) alertTags.push('Low Adherence');
    if (patientsWithIssues.some(([_, s]) => s.avgPain > 7)) alertTags.push('Pain Spike');

    return {
      activePatients: patients.length,
      activePatientsTrend: 0,
      todaySessions: todaySessions.length,
      todaySessionsTrend: 0,
      urgentAlerts: patientsWithIssues.length,
      alertTags: alertTags.length > 0 ? alertTags : ['None'],
      totalSessions: allSessions.length,
      completedSessions: allSessions.filter(s => s.status === 'completed').length,
    };
  }, [allSessions, patients]);

  const isLoading = sessionsLoading || patientsLoading;

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
