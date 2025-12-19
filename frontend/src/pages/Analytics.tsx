import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Download, Check, Star, ArrowDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { patientService } from '@/lib/services/patientService';
import { sessionService } from '@/lib/services/sessionService';
import { useMemo } from 'react';
import type { Session, Patient } from '@/types/api';

const Analytics = () => {
  // Fetch all data
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'analytics'],
    queryFn: () => patientService.getAll({ limit: 100 }),
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', 'analytics'],
    queryFn: () => sessionService.getAll({}),
  });

  const patients: Patient[] = patientsData?.data || [];
  const sessions: Session[] = sessionsData?.data || [];

  // Calculate overall adherence
  const overallAdherence = useMemo(() => {
    if (!sessions.length) return 0;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    return Math.round((completed / sessions.length) * 100);
  }, [sessions]);

  // Calculate adherence trend (compare last month vs previous month)
  // TODO: Implement proper month comparison when date filtering is available
  const adherenceTrend = 3.1; // Placeholder

  // Calculate average pain and trend
  const averagePain = useMemo(() => {
    const sessionsWithPain = sessions.filter((s) => s.pain_score_post !== null);
    if (sessionsWithPain.length === 0) return 0;
    const avg = sessionsWithPain.reduce((sum, s) => sum + (s.pain_score_post || 0), 0) / sessionsWithPain.length;
    return Math.round(avg * 10) / 10;
  }, [sessions]);

  // Generate pain trend data (last 30 days)
  const painTrendData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSessions = sessions
      .filter((s) => new Date(s.started_at) >= thirtyDaysAgo && s.pain_score_post !== null)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

    // Group by day and average
    const dayMap = new Map<number, number[]>();
    recentSessions.forEach((s) => {
      const day = Math.floor((Date.now() - new Date(s.started_at).getTime()) / (24 * 60 * 60 * 1000));
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(s.pain_score_post!);
    });

    return Array.from(dayMap.entries())
      .map(([day, scores]) => ({
        day: 30 - day,
        pain: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => a.day - b.day);
  }, [sessions]);

  // Generate treatment outcomes by protocol
  const outcomeData = useMemo(() => {
    // Group sessions by protocol and calculate averages
    const protocolMap = new Map<string, { romDeltas: number[]; painReductions: number[] }>();

    sessions
      .filter((s) => s.status === 'completed')
      .forEach((s) => {
        if (!protocolMap.has(s.protocol_id)) {
          protocolMap.set(s.protocol_id, { romDeltas: [], painReductions: [] });
        }
        const data = protocolMap.get(s.protocol_id)!;
        if (s.rom_delta !== null) data.romDeltas.push(s.rom_delta);
        if (s.pain_score_pre !== null && s.pain_score_post !== null) {
          data.painReductions.push(s.pain_score_pre - s.pain_score_post);
        }
      });

    // Convert to chart data format
    return Array.from(protocolMap.entries())
      .map(([protocolId, data]) => {
        const romAvg = data.romDeltas.length > 0 ? data.romDeltas.reduce((a, b) => a + b, 0) / data.romDeltas.length : 0;
        const painAvg =
          data.painReductions.length > 0
            ? (data.painReductions.reduce((a, b) => a + b, 0) / data.painReductions.length) * 10
            : 0; // Scale to 0-100

        return {
          name: `Protocol ${protocolId.slice(0, 8)}...`, // TODO: Get protocol names
          romGain: Math.round(romAvg * 10),
          painReduction: Math.round(painAvg),
        };
      })
      .slice(0, 3); // Top 3
  }, [sessions]);

  // Patient demographics
  const genderData = useMemo(() => {
    // TODO: Get gender from patient profile when available
    // For now, placeholder
    return [
      { name: 'Female', value: 55, color: 'hsl(168 76% 42%)' },
      { name: 'Male', value: 45, color: 'hsl(280 60% 60%)' },
    ];
  }, []);

  const ageData = useMemo(() => {
    // TODO: Calculate from patient date_of_birth when available
    return [
      { name: '50-65', value: 40, color: 'hsl(168 76% 42%)' },
      { name: 'Other', value: 60, color: 'hsl(217 33% 30%)' },
    ];
  }, []);

  const isLoading = patientsLoading || sessionsLoading;

  if (isLoading) {
    return (
      <MainLayout title="Analytics & Reports" subtitle="Detailed insights into patient progress and outcomes.">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Analytics & Reports" subtitle="Detailed insights into patient progress and outcomes.">
      <div className="space-y-6 animate-fade-in">
        {/* Top Filter Bar */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {/* TODO: Add date range and filter controls when backend supports them */}
            Analytics computed from all available data
          </div>

          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Report
          </Button>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Adherence */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Overall Adherence</h3>
              <Check className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-center justify-center py-4">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(217 33% 25%)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(168 76% 42%)"
                    strokeWidth="8"
                    strokeDasharray={`${overallAdherence * 2.51} ${100 * 2.51}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-foreground">{overallAdherence}%</span>
                  <span className="text-sm text-success">↑ +{adherenceTrend}%</span>
                </div>
              </div>
            </div>
            <p className="text-center text-muted-foreground text-sm">Compared to last month</p>
          </div>

          {/* Average Pain Trend */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Average Pain Trend</h3>
              <ArrowDown className="w-5 h-5 text-accent" />
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-foreground">{averagePain}</span>
              <span className="text-lg text-muted-foreground">/ 10</span>
            </div>
            <p className="text-success text-sm mb-4">↓ Based on {sessions.filter((s) => s.pain_score_post !== null).length} sessions</p>
            {painTrendData.length > 0 && (
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={painTrendData}>
                    <defs>
                      <linearGradient id="painGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(280 60% 60%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(280 60% 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="pain" stroke="hsl(280 60% 60%)" strokeWidth={2} fill="url(#painGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Patient Satisfaction */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Patient Satisfaction</h3>
              <Star className="w-5 h-5 text-warning" />
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-foreground">N/A</span>
              <span className="text-lg text-muted-foreground">/ 5</span>
            </div>
            <p className="text-muted-foreground text-sm mb-4">TODO: Implement satisfaction surveys</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Treatment Outcomes */}
          <div className="lg:col-span-2 stat-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Treatment Outcomes by Protocol</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">ROM Gain</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(280 60% 60%)' }} />
                  <span className="text-muted-foreground">Pain Reduction</span>
                </div>
              </div>
            </div>

            {outcomeData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={outcomeData} barGap={8}>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
                      tickFormatter={(value) => (value === 100 ? 'High' : value === 50 ? 'Med' : 'Low')}
                      ticks={[0, 50, 100]}
                    />
                    <Bar dataKey="romGain" radius={[4, 4, 0, 0]} fill="hsl(168 76% 42%)" barSize={40} />
                    <Bar dataKey="painReduction" radius={[4, 4, 0, 0]} fill="hsl(280 60% 60%)" barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No treatment outcome data available yet
              </div>
            )}
          </div>

          {/* Patient Demographics */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold text-foreground mb-6">Patient Demographics</h3>

            <div className="flex justify-around">
              {/* Gender Chart */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Gender</p>
                <div className="w-24 h-24 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={genderData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value">
                        {genderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-foreground">55%</span>
                    <span className="text-xs text-muted-foreground">Female</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">45% Male (TODO: Compute from data)</p>
              </div>

              {/* Age Group Chart */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Age Group</p>
                <div className="w-24 h-24 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ageData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value">
                        {ageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-foreground">40%</span>
                    <span className="text-xs text-muted-foreground">50-65</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">60% Other (TODO: Compute from date_of_birth)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Analytics;
