import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, X, CheckCircle, AlertCircle, Clock, Target, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { useProtocol } from '@/context/ProtocolContext';
import { useToast } from '@/hooks/use-toast';
import type { Protocol, Session, Exercise } from '@/types/api';
import { saveSessionToSupabase, SessionMetrics } from '@/lib/services/sessionService';
import { protocolService } from '@/lib/services/protocolService';
import { createPoseClient, PoseClient } from '@/lib/vision/poseClient';
import type { PoseLandmark, ExerciseType, SessionRepPayload } from '@/lib/vision/types';
import {
  createElbowFlexionRepDetector,
  createSlrRepDetector,
  createSquatRepDetector,
  type RepDetector,
  type RepOutput
} from '@/lib/vision/repDetectors';

// --- DATA SHAPES FOR BACKEND INTEGRATION ---

interface SessionResult {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  exercises: ExerciseResult[];
}

interface ExerciseResult {
  exerciseKey: string; // 'squat', 'slr', etc.
  totalReps: number;
  avgMaxAngle: number;
  avgFormScore: number;
}

/**
 * PatientSessionActive Component
 */
export default function PatientSessionActive() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateSession } = useSession();
  const { protocols, exercises: allExercises } = useProtocol();

  // Get session_id and protocol_id from URL params
  const sessionIdParam = searchParams.get('session_id');
  const protocolIdParam = searchParams.get('protocol_id');

  // Initialize state
  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam);
  // Logically, we start session when we land here
  const [startedAt] = useState<string>(new Date().toISOString());

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [painLevelPre] = useState([0]);
  const [painLevelPost, setPainLevelPost] = useState([0]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [poseReady, setPoseReady] = useState(false);

  // Real-time Feedback State
  const [liveFeedback, setLiveFeedback] = useState('Get ready...');
  const [currentAngle, setCurrentAngle] = useState<number | null>(null);

  const [liveReps, setLiveReps] = useState<SessionRepPayload[]>([]);
  const [lastRep, setLastRep] = useState<SessionRepPayload | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Vision refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseClientRef = useRef<PoseClient | null>(null);
  const rafRef = useRef<number | null>(null);
  const repDetectorRef = useRef<RepDetector | null>(null);
  const isPausedRef = useRef<boolean>(false);

  // To detect NEW reps in the loop
  const lastRepCountRef = useRef<number>(0);

  // Track reps completed per exercise
  const [exerciseRepsCompleted, setExerciseRepsCompleted] = useState<Record<string, number>>({});

  // Find protocol
  const [protocol, setProtocol] = useState<Protocol | null>(protocols.find(p => p.id === protocolIdParam) || null);
  const [protocolLoading, setProtocolLoading] = useState(false);

  // Fetch full protocol with steps if not found or steps missing
  useEffect(() => {
    const fetchProtocol = async () => {
      if (!protocolIdParam) return;

      // If we already have protocol from context but it has no steps, we might need to fetch
      // But let's just always fetch to be safe and get fresh steps
      setProtocolLoading(true);
      const { data } = await protocolService.getById(protocolIdParam);
      if (data) {
        setProtocol(data);
      }
      setProtocolLoading(false);
    };

    fetchProtocol();
  }, [protocolIdParam]);

  // Use protocol steps - with fallback to generate from available exercises
  const steps = useMemo(() => {
    // If protocol has steps, use them
    if (protocol?.steps && protocol.steps.length > 0) {
      return protocol.steps;
    }

    // FALLBACK: For demo mode, create steps from available exercises
    // This allows testing the pose detection without a full protocol setup
    if (allExercises.length > 0) {
      console.log('[PatientSessionActive] Using fallback exercises for demo mode');
      return allExercises.slice(0, 3).map((ex, index) => ({
        id: crypto.randomUUID(),
        protocol_id: protocolIdParam || '',
        exercise_id: ex.id,
        sets: 2,
        reps: 10,
        duration_seconds: null,
        side: 'both' as const,
        notes: null,
        order_index: index,
        created_at: new Date().toISOString(),
      }));
    }

    return [];
  }, [protocol?.steps, allExercises, protocolIdParam]);

  const currentStep = steps[currentExerciseIndex];
  const totalExercises = steps.length;
  // Ref for access in animation loop
  const currentStepRef = useRef<typeof currentStep>(currentStep);

  // Map exercises for easy lookup
  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    allExercises.forEach(ex => map.set(ex.id, ex));
    return map;
  }, [allExercises]);

  const getCurrentExerciseName = () => {
    if (!currentStep) return '';
    return exerciseMap.get(currentStep.exercise_id)?.name || 'Unknown Exercise';
  };

  // Update session on mount if ID exists
  useEffect(() => {
    if (sessionIdParam) {
      setSessionId(sessionIdParam);
    }
  }, [sessionIdParam]);

  // Update refs
  useEffect(() => {
    currentStepRef.current = currentStep;
    isPausedRef.current = isPaused;
  }, [currentStep, isPaused]);

  // Helper to resolve exercise type
  const resolveExerciseType = (step: typeof currentStep, exerciseName?: string): ExerciseType => {
    if (!step) return 'squat';
    const name = (exerciseName || '').toLowerCase();

    if (name.includes('elbow') || name.includes('bicep') || name.includes('curl')) return 'elbow_flexion';
    if (name.includes('slr') || name.includes('leg raise')) return 'slr';
    if (name.includes('squat')) return 'squat';

    const note = (step.notes || '').toLowerCase();
    if (note.includes('elbow')) return 'elbow_flexion';

    return 'squat';
  };

  const createDetector = (type: ExerciseType, side: 'left' | 'right'): RepDetector => {
    switch (type) {
      case 'elbow_flexion':
        return createElbowFlexionRepDetector(side);
      case 'slr':
        return createSlrRepDetector(side);
      case 'squat':
      default:
        return createSquatRepDetector(side);
    }
  };

  // Recreate detector when exercise changes
  useEffect(() => {
    if (!currentStep) return;
    const exerciseName = exerciseMap.get(currentStep.exercise_id)?.name;
    const type = resolveExerciseType(currentStep, exerciseName);

    // Default to 'left' if not specified, or parse from notes if really needed. 
    // Ideally ProtocolStep should have a side field.
    const side = (currentStep.side as 'left' | 'right') || 'left';

    const detector = createDetector(type, side);
    detector.reset();
    repDetectorRef.current = detector;
    lastRepCountRef.current = 0;

    setLastRep(null);
    setLiveFeedback('Get ready...');
    setExerciseRepsCompleted((prev) => ({
      ...prev,
      [currentStep.exercise_id]: prev[currentStep.exercise_id] || 0,
    }));
  }, [currentStep, currentExerciseIndex, exerciseMap]);

  /**
   * Draw a simple skeleton on the canvas using normalized landmarks.
   */
  const drawSkeleton = (landmarks: PoseLandmark[]) => {
    const videoEl = videoRef.current;
    const canvas = canvasRef.current;
    if (!videoEl || !canvas) return;

    const width = videoEl.videoWidth || canvas.width;
    const height = videoEl.videoHeight || canvas.height;
    if (!width || !height) return;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#10b981';
    ctx.fillStyle = '#22d3ee';

    const connections: Array<[number, number]> = [
      [11, 12],
      [11, 13], [13, 15],
      [12, 14], [14, 16],
      [11, 23], [12, 24],
      [23, 24],
      [23, 25], [25, 27],
      [24, 26], [26, 28],
    ];

    const toPx = (lm: PoseLandmark) => ({ x: lm.x * width, y: lm.y * height });

    connections.forEach(([aIdx, bIdx]) => {
      const a = landmarks[aIdx];
      const b = landmarks[bIdx];
      if (!a || !b) return;
      const pa = toPx(a);
      const pb = toPx(b);
      // Only draw visible points
      if ((a.visibility ?? 1) > 0.5 && (b.visibility ?? 1) > 0.5) {
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    });

    landmarks.forEach((lm) => {
      if (!lm || (lm.visibility ?? 1) < 0.5) return;
      const p = toPx(lm);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  /**
   * Start camera + pose client loop.
   */
  useEffect(() => {
    let isMounted = true;

    const startVision = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (!isMounted) return;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            if (!videoRef.current) return resolve();
            const onReady = () => resolve();
            videoRef.current.addEventListener('loadedmetadata', onReady, { once: true });
            videoRef.current.play().catch(() => resolve());
          });
        }

        const client = createPoseClient();
        poseClientRef.current = client;
        await client.init();
        if (!isMounted) return;
        setPoseReady(true);

        const loop = async () => {
          if (!poseClientRef.current || !videoRef.current) return;
          const result = await poseClientRef.current.process(videoRef.current);

          if (result?.landmarks) {
            // Rep detection logic
            const detector = repDetectorRef.current;
            const step = currentStepRef.current;

            if (detector && step && !isPausedRef.current) {
              const output: RepOutput = detector.update({
                landmarks: result.landmarks,
                timestampMs: performance.now(),
              });

              // Update Live UI
              setLiveFeedback(output.feedback);
              if (output.currentAngle !== undefined) {
                setCurrentAngle(output.currentAngle);
              }

              // Check for NEW rep
              if (output.repCount > lastRepCountRef.current) {
                lastRepCountRef.current = output.repCount;

                // Rep completed!
                if (output.lastRep) {
                  const exerciseId = step.exercise_id || 'exercise-unknown';
                  const payload: SessionRepPayload = {
                    exerciseId,
                    repIndex: output.repCount,
                    romMax: output.lastRep.maxAngle - output.lastRep.minAngle, // Approximation
                    romTarget: 90, // Demo hardcoded or pull from protocol?
                    accuracyScore: Math.round((output.lastRep.formScore / 100) * 100), // Map to 0-100 if needed
                    formQuality: output.lastRep.formScore > 80 ? 'good' : 'improve',
                    timestampMs: Date.now()
                  };

                  setLiveReps(prev => [...prev, payload]);
                  setLastRep(payload);
                  setExerciseRepsCompleted(prev => ({
                    ...prev,
                    [exerciseId]: (prev[exerciseId] || 0) + 1
                  }));
                }
              }
            }

            drawSkeleton(result.landmarks);
          }
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error('[Camera] init failed', err);
        if (isMounted) {
          setCameraError('Cannot access camera. Please allow webcam access in your browser.');
        }
      }
    };

    startVision();

    return () => {
      isMounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      poseClientRef.current?.destroy();
    };
  }, []);

  const handleNextExercise = () => {
    if (currentExerciseIndex < totalExercises - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
    }
  };

  const handlePrevExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex((prev) => prev - 1);
    }
  };

  const handleEndSession = () => {
    setShowEndModal(true);
  };

  const handleSaveAndFinish = async () => {
    setIsSaving(true);

    try {
      // Build SessionMetrics for each exercise
      const metricsMap = new Map<string, {
        name: string;
        slug: string;
        reps: SessionRepPayload[]
      }>();

      // Group reps by exercise
      for (const rep of liveReps) {
        const exId = rep.exerciseId;
        const exercise = exerciseMap.get(exId);
        const exerciseName = exercise?.name || 'Unknown';

        // Determine exercise slug based on name
        let slug = 'unknown';
        const nameLower = exerciseName.toLowerCase();
        if (nameLower.includes('squat')) slug = 'squat';
        else if (nameLower.includes('leg raise') || nameLower.includes('slr')) slug = 'slr';
        else if (nameLower.includes('elbow') || nameLower.includes('curl')) slug = 'elbow_flexion';

        if (!metricsMap.has(exId)) {
          metricsMap.set(exId, { name: exerciseName, slug, reps: [] });
        }
        metricsMap.get(exId)!.reps.push(rep);
      }

      // Convert to SessionMetrics array
      const metrics: SessionMetrics[] = Array.from(metricsMap.entries()).map(([exId, data]) => {
        const reps = data.reps;
        const totalReps = reps.length;
        const avgAccuracy = totalReps > 0
          ? reps.reduce((sum, r) => sum + (r.accuracyScore || 0), 0) / totalReps
          : 0;
        const avgRom = totalReps > 0
          ? reps.reduce((sum, r) => sum + (r.romMax || 0), 0) / totalReps
          : 0;
        const avgTempo = totalReps > 0
          ? reps.reduce((sum, r) => sum + (r.tempoScore || 0), 0) / totalReps
          : 0;

        return {
          exercise_slug: data.slug,
          exercise_name: data.name,
          total_reps: totalReps,
          avg_accuracy: Math.round(avgAccuracy),
          avg_rom: Math.round(avgRom),
          avg_tempo: Math.round(avgTempo),
          reps_data: reps.map(r => ({
            rep_index: r.repIndex,
            rom_achieved: r.romMax || 0,
            rom_target: r.romTarget || 90,
            accuracy_score: r.accuracyScore || 0,
            tempo_score: r.tempoScore,
            form_quality: r.formQuality || 'unknown',
            timestamp_ms: r.timestampMs || 0,
          })),
        };
      });

      // Save to Supabase
      const savedSession = await saveSessionToSupabase({
        protocol_id: protocolIdParam || undefined,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        pain_score_pre: painLevelPre[0],
        pain_score_post: painLevelPost[0],
        notes: sessionNotes || undefined,
        metrics,
      });

      if (savedSession) {
        console.log('SESSION_SAVED_TO_SUPABASE', savedSession);
        toast({
          title: 'Session Completed! 🎉',
          description: `Great work! ${metrics.reduce((sum, m) => sum + m.total_reps, 0)} reps saved.`,
        });
      } else {
        // Fallback: still update local context
        if (sessionId) {
          updateSession(sessionId, {
            status: 'completed',
            pain_score_post: painLevelPost[0],
            notes: sessionNotes || undefined,
          });
        }
        toast({
          title: 'Session Completed',
          description: 'Saved locally (Supabase unavailable).',
          variant: 'default',
        });
      }

      navigate('/patient/home');
    } catch (e) {
      console.error('Session save error:', e);
      toast({ title: 'Error', variant: 'destructive', description: 'Failed to save session.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Metrics calculation
  const currentReps = currentStep ? (exerciseRepsCompleted[currentStep.exercise_id] || 0) : 0;
  const targetReps = currentStep?.reps || 10;
  const overallProgress = totalExercises > 0
    ? ((currentExerciseIndex + (currentReps / targetReps)) / totalExercises) * 100
    : 0;

  // Error state
  if (!protocolIdParam) return <div className="p-10 text-center">Missing Protocol ID</div>;

  // Show loading while exercises are being fetched
  if (steps.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p>Loading exercises...</p>
        <p className="text-sm text-muted-foreground">
          Make sure exercises are seeded in the database
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="h-14 border-b bg-background flex items-center justify-between px-6 sticky top-0 z-40">
        <h1 className="font-semibold">{protocol?.title || 'Demo Session'}</h1>
        <Button variant="ghost" size="icon" onClick={handleEndSession}>
          <X className="w-5 h-5" />
        </Button>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Left: Video */}
        <div className="flex-1 p-4 relative bg-black flex flex-col justify-center overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-60" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Overlay Feedback */}
          <div className="z-10 text-center space-y-2">
            <div className="text-4xl md:text-6xl font-bold text-white drop-shadow-md">
              {liveFeedback}
            </div>
            {currentAngle !== null && (
              <div className="text-xl md:text-2xl text-emerald-400 font-mono drop-shadow-md">
                {currentAngle}°
              </div>
            )}
          </div>

          {/* Exercise Info Overlay */}
          <div className="absolute top-4 left-4 bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm z-20">
            <div className="text-sm opacity-80">Exercise {currentExerciseIndex + 1}/{totalExercises}</div>
            <div className="font-bold text-lg">{getCurrentExerciseName()}</div>
            {currentStep.side && <div className="text-sm text-emerald-400 uppercase tracking-wider">{currentStep.side} Side</div>}
          </div>

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background text-destructive z-30">
              {cameraError}
            </div>
          )}
          {!poseReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black text-white z-30">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
          )}
        </div>

        {/* Right: Controls & Stats */}
        <div className="w-full lg:w-96 border-l p-6 overflow-y-auto bg-card">
          <div className="space-y-6">

            {/* Rep Counter */}
            <div className="text-center p-6 bg-secondary/20 rounded-2xl border-2 border-primary/20">
              <div className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-2">Reps</div>
              <div className="text-6xl font-bold text-primary mb-1">
                {currentReps}
                <span className="text-2xl text-muted-foreground font-normal"> / {targetReps}</span>
              </div>
            </div>

            {/* Last Rep Stats */}
            {lastRep && (
              <div className="bg-secondary/20 p-4 rounded-xl border border-border">
                <div className="text-xs text-muted-foreground mb-2 font-medium uppercase">Last Rep Analysis</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{lastRep.accuracyScore}%</div>
                    <div className="text-xs text-muted-foreground">Form Score</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{Math.round(lastRep.romMax || 0)}°</div>
                    <div className="text-xs text-muted-foreground">ROM</div>
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handlePrevExercise}
                  disabled={currentExerciseIndex === 0}
                >
                  <SkipBack className="w-4 h-4 mr-2" /> Prev
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleNextExercise}
                  disabled={currentExerciseIndex === totalExercises - 1}
                >
                  Next <SkipForward className="w-4 h-4 ml-2" />
                </Button>
              </div>

              <Button
                variant={isPaused ? "default" : "secondary"}
                className="w-full"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                {isPaused ? "Resume Session" : "Pause Session"}
              </Button>

              <Button
                variant="destructive"
                className="w-full"
                onClick={handleEndSession}
              >
                End Session
              </Button>
            </div>

            {/* Debug/Notes */}
            <div className="text-xs text-muted-foreground text-center pt-10">
              <p>Camera-based detection active.</p>
              <p>Ensure your full body is visible.</p>
            </div>
          </div>
        </div>
      </div>

      {/* End Session Modal */}
      <Dialog open={showEndModal} onOpenChange={setShowEndModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish Session</DialogTitle>
            <DialogDescription>Rate your pain level to complete.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Pain Level: {painLevelPost}</span>
              </div>
              <Slider
                value={painLevelPost}
                onValueChange={setPainLevelPost}
                max={10}
                step={1}
              />
            </div>
            <Textarea
              placeholder="Session notes..."
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
            />
            <Button className="w-full" onClick={handleSaveAndFinish} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save & Finish'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
