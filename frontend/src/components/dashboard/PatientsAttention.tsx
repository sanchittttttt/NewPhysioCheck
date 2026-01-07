import { useSession } from '@/context/SessionContext';
import { User } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { getDemoUser, getDoctorPatients, DemoUser } from '@/lib/demoAuth';
import { useNavigate } from 'react-router-dom';

export function PatientsAttention() {
  const { sessions } = useSession();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch patients from Supabase
  useEffect(() => {
    const fetchPatients = async () => {
      const user = getDemoUser();
      if (user?.role === 'doctor') {
        const doctorPatients = await getDoctorPatients(user.id);
        setPatients(doctorPatients);
      }
      setLoading(false);
    };
    fetchPatients();
  }, []);

  // Calculate patients needing attention based on adherence and recent pain scores
  const patientsNeedingAttention = useMemo(() => {
    return patients
      .map((patient) => {
        // Get sessions for this patient (use patient_id from session data)
        const patientSessions = sessions.filter((s) => s.patient_id === patient.id);
        const completedSessions = patientSessions.filter((s) => s.status === 'completed');

        // Calculate simple adherence
        const adherence =
          patientSessions.length > 0
            ? Math.round((completedSessions.length / patientSessions.length) * 100)
            : 100; // Assume 100% if no sessions yet

        // Check for high pain scores in recent sessions
        const recentHighPain = completedSessions.some(
          (s) => s.pain_score_post !== null && s.pain_score_post >= 7
        );

        // Determine attention level
        let attentionLevel: 'low' | 'high' | null = null;
        if (patientSessions.length > 0 && adherence < 50) attentionLevel = 'low';
        if (recentHighPain) attentionLevel = 'high';

        return {
          patient,
          adherence,
          recentHighPain,
          attentionLevel,
          totalSessions: patientSessions.length,
          completedSessions: completedSessions.length,
        };
      })
      .filter((p) => p.attentionLevel !== null)
      .sort((a, b) => {
        // Prioritize high pain over low adherence
        if (a.attentionLevel === 'high' && b.attentionLevel !== 'high') return -1;
        if (b.attentionLevel === 'high' && a.attentionLevel !== 'high') return 1;
        return a.adherence - b.adherence;
      })
      .slice(0, 5); // Show top 5
  }, [patients, sessions]);

  if (loading) {
    return (
      <div className="stat-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Patients Needing Attention</h3>
        <p className="text-sm text-muted-foreground">Loading patients...</p>
      </div>
    );
  }

  if (patientsNeedingAttention.length === 0) {
    return (
      <div className="stat-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Patients Needing Attention</h3>
        <p className="text-sm text-muted-foreground">
          {patients.length === 0 ? 'No patients assigned yet' : 'All patients are doing well!'}
        </p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Patients Needing Attention</h3>

      <div className="space-y-4">
        {patientsNeedingAttention.map(({ patient, adherence, recentHighPain, attentionLevel, totalSessions, completedSessions }) => (
          <div
            key={patient.id}
            className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 p-2 rounded-lg transition-colors"
            onClick={() => navigate(`/patients/${patient.id}`)}
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{patient.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {completedSessions}/{totalSessions} sessions completed
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {attentionLevel === 'low' && (
                <span className="pill pill-warning text-xs">Low Adherence</span>
              )}
              {recentHighPain && (
                <span className="pill pill-danger text-xs">High Pain</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
