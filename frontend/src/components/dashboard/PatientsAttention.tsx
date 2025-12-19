import { useQuery } from '@tanstack/react-query';
import { patientService } from '@/lib/services/patientService';
import { sessionService } from '@/lib/services/sessionService';
import { Loader2, User } from 'lucide-react';
import { useMemo } from 'react';
import type { Patient, Session } from '@/types/api';

export function PatientsAttention() {
  // Fetch all patients
  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'all'],
    queryFn: () => patientService.getAll({ limit: 100 }),
  });

  // Fetch recent sessions to calculate adherence
  const { data: sessionsData } = useQuery({
    queryKey: ['sessions', 'recent'],
    queryFn: () => sessionService.getAll({}),
  });

  const patients: Patient[] = patientsData?.data || [];
  const sessions: Session[] = sessionsData?.data || [];

  // Calculate patients needing attention based on adherence and recent pain scores
  const patientsNeedingAttention = useMemo(() => {
    return patients
      .map((patient) => {
        // Get sessions for this patient
        const patientSessions = sessions.filter((s) => s.patient_id === patient.id);
        const completedSessions = patientSessions.filter((s) => s.status === 'completed');

        // Calculate simple adherence: sessions completed vs expected (rough estimate)
        // TODO: Replace with proper adherence calculation from assignments
        const adherence =
          completedSessions.length > 0
            ? Math.min(100, (completedSessions.length / Math.max(patientSessions.length, 1)) * 100)
            : 0;

        // Check for high pain scores in recent sessions
        const recentHighPain = completedSessions.some(
          (s) => s.pain_score_post !== null && s.pain_score_post >= 7
        );

        // Determine attention level
        let attentionLevel: 'low' | 'high' | null = null;
        if (adherence < 50) attentionLevel = 'low';
        if (recentHighPain) attentionLevel = 'high';

        return {
          patient,
          adherence,
          recentHighPain,
          attentionLevel,
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

  if (patientsNeedingAttention.length === 0) {
    return (
      <div className="stat-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Patients Needing Attention</h3>
        <p className="text-sm text-muted-foreground">All patients are doing well!</p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Patients Needing Attention</h3>

      <div className="space-y-4">
        {patientsNeedingAttention.map(({ patient, adherence, recentHighPain, attentionLevel }) => (
          <div key={patient.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{patient.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {patient.condition || 'No condition specified'}
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
