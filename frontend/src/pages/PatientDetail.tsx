import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, User, Calendar, FileText, MessageCircle, Loader2, Plus, Brain, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScheduleSessionDialog } from '@/components/doctor/ScheduleSessionDialog';
import { useMemo, useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { useProtocol } from '@/context/ProtocolContext';
import { supabase } from '@/lib/supabaseClient';
import { DemoUser } from '@/lib/demoAuth';
import type { Protocol } from '@/types/api';
import { aiInsightsService, type AIInsight } from '@/lib/services/aiInsightsService';

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [patient, setPatient] = useState<DemoUser | null>(null);
  const [patientLoading, setPatientLoading] = useState(true);

  const { sessions: allSessions } = useSession();
  const { protocols: allProtocols } = useProtocol();

  // Fetch patient from Supabase
  useEffect(() => {
    const fetchPatient = async () => {
      if (!id) {
        setPatientLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('demo_users')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('[PatientDetail] Error fetching patient:', error);
          setPatient(null);
        } else {
          setPatient(data as DemoUser);
        }
      } catch (e) {
        console.error('[PatientDetail] Exception:', e);
        setPatient(null);
      } finally {
        setPatientLoading(false);
      }
    };

    fetchPatient();
  }, [id]);

  // Filter sessions for this patient
  const sessions = useMemo(() => {
    return allSessions.filter(s => s.patient_id === id);
  }, [allSessions, id]);

  // Get assignments from Supabase
  const [assignments, setAssignments] = useState<any[]>([]);
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAssignments(data);
      }
    };
    fetchAssignments();
  }, [id]);

  // Get AI insights for this patient
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  useEffect(() => {
    const fetchInsights = async () => {
      if (!id) {
        setInsightsLoading(false);
        return;
      }

      setInsightsLoading(true);
      const { data, error } = await aiInsightsService.getAll({
        patient_id: id,
        limit: 10,
      });

      if (!error && data) {
        setAiInsights(data);
      }
      setInsightsLoading(false);
    };
    fetchInsights();
  }, [id]);

  const handleGenerateInsights = async () => {
    if (!id) return;
    setInsightsLoading(true);
    const { data, error } = await aiInsightsService.generate(id);
    if (!error && data) {
      toast({
        title: 'Insights Generated',
        description: `Generated ${data.length} new insights for this patient.`,
      });
      // Refresh insights
      const { data: refreshed } = await aiInsightsService.getAll({
        patient_id: id,
        limit: 10,
      });
      if (refreshed) setAiInsights(refreshed);
    } else {
      toast({
        title: 'Error',
        description: 'Failed to generate insights. Please try again.',
        variant: 'destructive',
      });
    }
    setInsightsLoading(false);
  };

  const handleMarkAsRead = async (insightId: string) => {
    await aiInsightsService.markAsRead(insightId);
    setAiInsights(prev => prev.map(i => i.id === insightId ? { ...i, is_read: true } : i));
  };

  const handleDeleteInsight = async (insightId: string) => {
    const { error } = await aiInsightsService.delete(insightId);
    if (!error) {
      setAiInsights(prev => prev.filter(i => i.id !== insightId));
      toast({
        title: 'Insight Deleted',
        description: 'The insight has been removed.',
      });
    }
  };

  const getSeverityIcon = (severity: AIInsight['severity']) => {
    switch (severity) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default:
        return <Info className="w-5 h-5 text-primary" />;
    }
  };

  const getSeverityColor = (severity: AIInsight['severity']) => {
    switch (severity) {
      case 'success':
        return 'border-success/50 bg-success/10';
      case 'warning':
        return 'border-warning/50 bg-warning/10';
      case 'critical':
        return 'border-destructive/50 bg-destructive/10';
      default:
        return 'border-primary/50 bg-primary/10';
    }
  };

  const protocolMap = useMemo(() => {
    const map = new Map<string, Protocol>();
    allProtocols.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProtocols]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'in_progress':
        return 'bg-green-500';
      case 'completed':
        return 'bg-blue-500';
      case 'scheduled':
        return 'bg-yellow-500';
      case 'missed':
        return 'bg-red-500';
      case 'incomplete':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (patientLoading) {
    return (
      <MainLayout title="Patient Details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!patient) {
    return (
      <MainLayout title="Patient Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Patient not found</p>
          <Button onClick={() => navigate('/patients')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Patient: ${patient.name}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button onClick={() => navigate('/patients')} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate(`/messages?patientId=${patient.id}`)}
              variant="outline"
              size="sm"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
            <Button onClick={() => setScheduleDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </div>
        </div>

        {/* Patient Info Card */}
        <div className="stat-card">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-foreground mb-2">{patient.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{patient.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p className="font-medium text-foreground capitalize">{patient.role}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sessions</p>
                  <p className="font-medium text-foreground">{sessions.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completed</p>
                  <p className="font-medium text-foreground">
                    {sessions.filter(s => s.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Insights
            </h3>
            <Button
              onClick={handleGenerateInsights}
              variant="outline"
              size="sm"
              disabled={insightsLoading}
            >
              {insightsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>

          {insightsLoading && aiInsights.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : aiInsights.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground mb-2">No AI insights available yet.</p>
              <p className="text-xs text-muted-foreground">Click "Generate Insights" to analyze patient data and get recommendations.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {aiInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`rounded-lg p-4 border-2 ${getSeverityColor(insight.severity)} ${
                    insight.is_read ? 'opacity-70' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getSeverityIcon(insight.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <h4 className="font-semibold text-foreground text-sm">{insight.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground capitalize">
                              {insight.insight_type}
                            </span>
                            {insight.category && (
                              <span className="text-xs text-muted-foreground">
                                {insight.category}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(insight.generated_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!insight.is_read && (
                            <Button
                              onClick={() => handleMarkAsRead(insight.id)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            onClick={() => handleDeleteInsight(insight.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {insight.description}
                      </p>
                      {insight.metadata && Object.keys(insight.metadata).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(insight.metadata).map(([key, value]) => (
                              <span key={key} className="text-xs text-muted-foreground">
                                <span className="font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                                {typeof value === 'number' ? value.toFixed(1) : String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assigned Protocols */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Assigned Protocols
            </h3>
            <Button
              onClick={() => navigate('/protocol-builder')}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Assign Protocol
            </Button>
          </div>

          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No protocols assigned yet. Create and assign a protocol to get started.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const protocol = protocolMap.get(assignment.protocol_id);
                const assignmentSessions = sessions.filter(s => s.protocol_id === assignment.protocol_id);
                const completed = assignmentSessions.filter(s => s.status === 'completed').length;

                return (
                  <div key={assignment.id} className="bg-secondary/50 rounded-lg p-4 border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{protocol?.title || 'Unknown Protocol'}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Started: {formatDate(assignment.start_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(assignment.status)}`} />
                        <span className="text-sm text-foreground capitalize">{assignment.status}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sessions Completed</span>
                        <span className="font-medium text-foreground">{completed} / {assignmentSessions.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Sessions
            </h3>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 10).map((session) => {
                const protocol = protocolMap.get(session.protocol_id);
                const sessionDate = session.scheduled_date || (session.started_at ? session.started_at.split('T')[0] : '');
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {sessionDate ? formatDate(sessionDate) : 'N/A'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {session.started_at ? formatTime(session.started_at) : 'Scheduled'}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(session.status)}`} />
                        <span className="text-sm text-foreground capitalize">{session.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{protocol?.title || 'Unknown Protocol'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Session Dialog */}
      <ScheduleSessionDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        patientId={patient.id}
      />
    </MainLayout>
  );
};

export default PatientDetail;
