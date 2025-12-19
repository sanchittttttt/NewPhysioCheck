import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, SkipBack, SkipForward, X, CheckCircle, AlertCircle, Clock, Target, Activity, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { sessionService } from '@/lib/services/sessionService';
import { protocolService } from '@/lib/services/protocolService';
import { exerciseService } from '@/lib/services/exerciseService';
import { useToast } from '@/hooks/use-toast';
import type { Protocol, Session, SessionRepCreate, SessionComplete, Exercise } from '@/types/api';
import { createPoseClient, PoseClient } from '@/lib/vision/poseClient';
import type { PoseLandmark, ExerciseType, SessionRepPayload } from '@/lib/vision/types';
import {
  createElbowFlexionRepDetector,
  createSlrRepDetector,
  createSquatRepDetector,
  type RepDetector,
} from '@/lib/vision/repDetectors';
import { repEventToSessionRep } from '@/lib/vision/sessionReps';

/**
 * PatientSessionActive Component
 * 
 * Handles active exercise session with pose detection integration point.
 * 
 * Session Flow:
 * 1. On mount or "Start Session": POST /api/v1/sessions (creates session_id)
 * 2. During session: Track exercises, reps (currently mock, future: MediaPipe)
 * 3. On "Save & Finish": POST /api/v1/sessions/{id}/complete with:
 *    - Pain scores
 *    - Notes
 *    - Reps array (currently mock, replace with MediaPipe-derived data)
 * 
 * MediaPipe Integration Point:
 * The generateMockReps() function should be replaced with MediaPipe pose detection.
 * All MediaPipe logic should live in this component to keep it isolated.
 */
export default function PatientSessionActive() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get assignment_id and protocol_id from URL params
  const assignmentId = searchParams.get('assignment_id');
  const protocolId = searchParams.get('protocol_id');

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [painLevelPre] = useState([0]);
  const [painLevelPost, setPainLevelPost] = useState([0]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [poseReady, setPoseReady] = useState(false);
  const [liveReps, setLiveReps] = useState<SessionRepPayload[]>([]);
  const [lastRep, setLastRep] = useState<SessionRepPayload | null>(null);

  // Vision: webcam + pose client + canvas
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseClientRef = useRef<PoseClient | null>(null);
  const rafRef = useRef<number | null>(null);
  const repDetectorRef = useRef<RepDetector | null>(null);
  const isPausedRef = useRef<boolean>(false);

  // Track reps completed per exercise (mock data for now)
  const [exerciseRepsCompleted, setExerciseRepsCompleted] = useState<Record<string, number>>({});

  // Fetch protocol to get exercises
  const { data: protocolData, isLoading: protocolLoading } = useQuery({
    queryKey: ['protocol', protocolId],
    queryFn: () => protocolService.getById(protocolId!),
    enabled: !!protocolId,
  });

  const protocol: Protocol | null = protocolData || null;
  const exercises = protocol?.steps || [];
  const currentExercise = exercises[currentExerciseIndex];
  const totalExercises = exercises.length;
  const currentExerciseRef = useRef<typeof currentExercise>(currentExercise);

  // Fetch exercise details for all exercises in protocol to get names
  const exerciseIds = exercises.map(step => step.exercise_id);
  const { data: exercisesData } = useQuery({
    queryKey: ['exercises', 'protocol', exerciseIds.join(',')],
    queryFn: async () => {
      if (!exerciseIds.length) return [];
      const exercisePromises = exerciseIds.map(id =>
        exerciseService.getById(id).catch(() => null)
      );
      return (await Promise.all(exercisePromises)).filter((e): e is Exercise => e !== null);
    },
    enabled: exerciseIds.length > 0,
  });

  // Create exercise map for quick lookup
  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    (exercisesData || []).forEach(ex => map.set(ex.id, ex));
    return map;
  }, [exercisesData]);

  // Calculate progress
  const currentReps = currentExercise ? (exerciseRepsCompleted[currentExercise.exercise_id] || 0) : 0;
  const targetReps = currentExercise?.reps || 1;
  const overallProgress = totalExercises > 0
    ? ((currentExerciseIndex + (currentReps / targetReps)) / totalExercises) * 100
    : 0;

  const accuracyAvg = liveReps.length
    ? Math.round(
      liveReps
        .map((r) => r.accuracyScore ?? 0)
        .reduce((a, b) => a + b, 0) / liveReps.length,
    )
    : null;

  useEffect(() => {
    currentExerciseRef.current = currentExercise;
    isPausedRef.current = isPaused;
  }, [currentExercise]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const resolveExerciseType = (exercise: typeof currentExercise, exerciseName?: string): ExerciseType => {
    if (!exercise) return 'squat';

    // Check exercise name first (most reliable)
    const name = (exerciseName || '').toLowerCase();

    // Elbow Flexion detection
    if (name.includes('elbow') && name.includes('flexion')) return 'elbow_flexion';
    if (name.includes('elbow')) return 'elbow_flexion';
    if (name.includes('bicep')) return 'elbow_flexion';

    // SLR detection
    if (name.includes('slr')) return 'slr';
    if (name.includes('straight leg raise')) return 'slr';
    if (name.includes('straight leg')) return 'slr';
    if (name.includes('leg raise')) return 'slr';

    // Squat detection
    if (name.includes('squat')) return 'squat';

    // Fallback to notes (for backward compatibility)
    const note = (exercise.notes || '').toLowerCase();
    if (note.includes('elbow') || note.includes('bicep')) return 'elbow_flexion';
    if (note.includes('slr') || note.includes('raise') || note.includes('leg')) return 'slr';
    if (note.includes('squat') || note === 'squat') return 'squat';

    // Default to squat (safest default)
    return 'squat';
  };

  const createDetector = (type: ExerciseType): RepDetector => {
    switch (type) {
      case 'elbow_flexion':
        return createElbowFlexionRepDetector();
      case 'slr':
        return createSlrRepDetector();
      case 'squat':
      default:
        return createSquatRepDetector();
    }
  };

  // Recreate detector when exercise changes
  useEffect(() => {
    if (!currentExercise) return;
    const exerciseDetails = exerciseMap.get(currentExercise.exercise_id);
    const exerciseName = exerciseDetails?.name;
    const type = resolveExerciseType(currentExercise, exerciseName);
    const detector = createDetector(type);
    detector.reset();
    repDetectorRef.current = detector;
    setLastRep(null);
    // Ensure counters are initialized for this exercise
    setExerciseRepsCompleted((prev) => ({
      ...prev,
      [currentExercise.exercise_id]: prev[currentExercise.exercise_id] || 0,
    }));
  }, [currentExercise, currentExerciseIndex, exerciseMap]);

  const formQualityToScore = (quality?: string | null) => {
    switch (quality) {
      case 'good':
        return 90;
      case 'too_shallow':
        return 65;
      case 'too_fast':
        return 70;
      case 'compensated':
        return 60;
      default:
        return null;
    }
  };

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      if (!assignmentId || !protocolId || !user?.id) {
        throw new Error('Missing required data to start session');
      }
      const session = await sessionService.create({
        patient_id: user.id,
        assignment_id: assignmentId,
        protocol_id: protocolId,
      });
      return session;
    },
    onSuccess: (session: Session) => {
      setSessionId(session.id);
      setSessionStarted(true);
      toast({
        title: 'Session Started',
        description: 'Your session has begun. Good luck!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to start session',
        variant: 'destructive',
      });
    },
  });

  // Complete session mutation
  const completeSessionMutation = useMutation({
    mutationFn: async (completionData: SessionComplete) => {
      if (!sessionId) throw new Error('No active session');
      return sessionService.complete(sessionId, completionData);
    },
    onSuccess: () => {
      toast({
        title: 'Session Completed',
        description: 'Great work! Your session has been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      navigate('/patient/home');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to complete session',
        variant: 'destructive',
      });
    },
  });

  // Auto-start session if assignment_id and protocol_id are provided
  useEffect(() => {
    if (assignmentId && protocolId && !sessionId && !sessionStarted && !startSessionMutation.isPending) {
      startSessionMutation.mutate();
    }
  }, [assignmentId, protocolId, sessionId, sessionStarted]);

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
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });

    landmarks.forEach((lm) => {
      if (!lm) return;
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
            // Rep detection
            const detector = repDetectorRef.current;
            const exercise = currentExerciseRef.current;
            if (detector && exercise && !isPausedRef.current) {
              const event = detector.update({
                landmarks: result.landmarks,
                timestampMs: performance.now(),
              });
              if (event) {
                const exerciseId = exercise.exercise_id || 'exercise-unknown'; // TODO: replace with real exercise metadata if available
                const payload = repEventToSessionRep(event, exerciseId);
                setLiveReps((prev) => [...prev, payload]);
                setLastRep(payload);
                setExerciseRepsCompleted((prev) => ({
                  ...prev,
                  [exerciseId]: (prev[exerciseId] || 0) + 1,
                }));
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

  const handleCompleteRep = () => {
    toast({
      title: 'Reps are counted automatically',
      description: 'Keep moving—camera-based rep detection is active.',
    });
  };

  const handleEndSession = () => {
    setShowEndModal(true);
  };

  const handleSaveAndFinish = () => {
    if (!sessionId) {
      toast({
        title: 'Error',
        description: 'No active session to complete',
        variant: 'destructive',
      });
      return;
    }

    if (liveReps.length === 0) {
      const confirmEmpty = window.confirm(
        'No reps were detected. Do you still want to save this session?'
      );
      if (!confirmEmpty) return;
    }

    const repsPayload: SessionRepCreate[] = liveReps.map((rep, idx) => ({
      exercise_id: rep.exerciseId,
      rep_index: rep.repIndex ?? idx + 1,
      rom_max: rep.romMax ?? null,
      rom_target: rep.romTarget ?? null,
      accuracy_score: rep.accuracyScore ?? null,
      tempo_score: rep.tempoScore ?? null,
      form_quality: formQualityToScore(rep.formQuality) ?? null,
      error_segment: rep.errorSegment ?? null,
      timestamp_ms: rep.timestampMs ?? null,
    }));

    const completionData: SessionComplete = {
      pain_score_pre: painLevelPre[0],
      pain_score_post: painLevelPost[0],
      notes: sessionNotes || null,
      reps: repsPayload,
    };

    completeSessionMutation.mutate(completionData);
    repDetectorRef.current?.reset();
  };

  // Loading state
  if (protocolLoading || startSessionMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!assignmentId || !protocolId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Missing Session Information</h2>
          <p className="text-muted-foreground">
            Unable to start session. Please select a protocol from your sessions page.
          </p>
          <Button onClick={() => navigate('/patient/sessions')}>
            Go to Sessions
          </Button>
        </div>
      </div>
    );
  }

  if (!protocol || exercises.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading protocol exercises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="h-12 md:h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-3 md:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <h1 className="text-sm md:text-lg font-semibold text-foreground truncate">{protocol.title}</h1>
          <span className="pill pill-primary text-[10px] md:text-xs flex-shrink-0">
            {sessionStarted ? 'In Progress' : 'Starting...'}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleEndSession} className="flex-shrink-0">
          <X className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-48px)] md:h-[calc(100vh-56px)]">
        {/* Left side - Video/Pose Area */}
        <div className="flex-1 p-3 md:p-6 flex flex-col min-h-[40vh] lg:min-h-0">
          <div className="relative flex-1 bg-card rounded-xl md:rounded-2xl border border-border overflow-hidden">
            <div className="absolute inset-0 bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover opacity-80"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm text-center px-4">
                  <div className="text-sm text-muted-foreground">{cameraError}</div>
                </div>
              )}

              {!cameraError && !poseReady && (
                <div className="absolute inset-0 flex items-center justify-center text-center px-4">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm">Initializing camera...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Top-left exercise name */}
            {currentExercise && (
              <div className="absolute top-2 md:top-4 left-2 md:left-4">
                <span className="pill bg-card/90 text-foreground backdrop-blur-sm border border-border text-[10px] md:text-xs">
                  Exercise {currentExerciseIndex + 1}: Exercise {currentExercise.order_index}
                </span>
              </div>
            )}

            {/* Top-right exercise counter */}
            <div className="absolute top-2 md:top-4 right-2 md:right-4">
              <span className="text-[10px] md:text-sm text-muted-foreground bg-card/90 backdrop-blur-sm px-2 md:px-3 py-1 rounded-full border border-border">
                {currentExerciseIndex + 1} of {totalExercises}
              </span>
            </div>

            {/* Bottom overlay bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent p-3 md:p-6 pt-8 md:pt-12">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 md:gap-6">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    <span className="text-xs md:text-sm text-foreground font-medium">
                      {currentReps}/{targetReps}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-accent" />
                    <span className="text-xs md:text-sm text-foreground font-medium">
                      {Math.floor((Date.now() - (sessionStarted ? Date.now() : Date.now())) / 1000 / 60)}:{
                        String(Math.floor(((Date.now() - (sessionStarted ? Date.now() : Date.now())) / 1000) % 60)).padStart(2, '0')
                      }
                    </span>
                  </div>
                </div>
                <span className="pill pill-success flex items-center gap-1 text-[10px] md:text-xs">
                  <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                  Ready
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar - Mobile only shows here */}
          <div className="mt-3 md:mt-4 lg:hidden">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] md:text-xs text-muted-foreground">Progress</span>
              <span className="text-[10px] md:text-xs text-foreground font-medium">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <Progress value={overallProgress} className="h-1.5 md:h-2" />
          </div>
        </div>

        {/* Right side - Session details */}
        <div className="w-full lg:w-[35%] lg:max-w-md border-t lg:border-t-0 lg:border-l border-border p-3 md:p-6 overflow-y-auto scrollbar-thin flex-shrink-0">
          {/* Current Exercise Card */}
          {currentExercise && (
            <div className="stat-card mb-3 md:mb-4">
              <h3 className="text-xs md:text-sm font-medium text-muted-foreground mb-1 md:mb-2">
                Current Exercise
              </h3>
              <h4 className="text-base md:text-lg font-semibold text-foreground mb-1 md:mb-2">
                Exercise {currentExercise.order_index}
              </h4>
              <p className="text-xs md:text-sm text-primary mb-2 md:mb-3">
                {currentExercise.sets ? `${currentExercise.sets} sets × ` : ''}
                {currentExercise.reps ? `${currentExercise.reps} reps` : ''}
                {currentExercise.duration_seconds ? `${currentExercise.duration_seconds}s hold` : ''}
                {currentExercise.side && ` (${currentExercise.side})`}
              </p>
              {currentExercise.notes && (
                <p className="text-xs md:text-sm text-muted-foreground">{currentExercise.notes}</p>
              )}
              <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-border">
                <Button
                  onClick={handleCompleteRep}
                  className="w-full"
                  disabled
                >
                  Auto-detected via camera
                </Button>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-2 text-center">
                  Reps are counted automatically from the pose stream.
                </p>
              </div>
            </div>
          )}

          {/* Real-time Metrics Card */}
          <div className="stat-card mb-3 md:mb-4">
            <h3 className="text-xs md:text-sm font-medium text-muted-foreground mb-2 md:mb-3">
              Real-time Metrics
            </h3>
            <div className="space-y-3 md:space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs md:text-sm text-foreground">Reps Completed</span>
                  <span className="text-xs md:text-sm text-foreground font-medium">
                    {currentReps} / {targetReps}
                  </span>
                </div>
                <Progress value={(currentReps / targetReps) * 100} className="h-1.5 md:h-2" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Total reps (session)</span>
                  <span className="font-semibold text-foreground">{liveReps.length}</span>
                  {accuracyAvg !== null && (
                    <span className="text-muted-foreground text-[11px]">Avg accuracy: {accuracyAvg}%</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Last rep</span>
                  {lastRep ? (
                    <>
                      <span className="font-semibold text-foreground">
                        ROM {Math.round(lastRep.romMax ?? 0)}° • Acc {lastRep.accuracyScore ?? '-'}%
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {lastRep.formQuality === 'good'
                          ? 'Good rep'
                          : lastRep.formQuality === 'too_shallow'
                            ? 'Go deeper'
                            : lastRep.formQuality === 'too_fast'
                              ? 'Slow down'
                              : lastRep.errorSegment === 'trunk_lean'
                                ? 'Watch your trunk'
                                : 'Keep form steady'}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Waiting for first rep</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Progress */}
          <div className="hidden lg:block mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Overall Progress</span>
              <span className="text-xs text-foreground font-medium">{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Control Buttons */}
          <div className="space-y-2 md:space-y-3">
            <div className="flex gap-2 md:gap-3">
              <Button
                variant="outline"
                className="flex-1 text-xs md:text-sm h-9 md:h-10"
                onClick={handlePrevExercise}
                disabled={currentExerciseIndex === 0}
              >
                <SkipBack className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Prev
              </Button>
              <Button
                className="flex-1 text-xs md:text-sm h-9 md:h-10"
                onClick={handleNextExercise}
                disabled={currentExerciseIndex === totalExercises - 1}
              >
                Next
                <SkipForward className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2" />
              </Button>
            </div>
            <div className="flex gap-2 md:gap-3">
              <Button
                variant="secondary"
                className="flex-1 text-xs md:text-sm h-9 md:h-10"
                onClick={() => setIsPaused(!isPaused)}
                disabled={!sessionStarted}
              >
                {isPaused ? (
                  <Play className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                ) : (
                  <Pause className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                )}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 text-xs md:text-sm h-9 md:h-10"
                onClick={handleEndSession}
                disabled={!sessionStarted}
              >
                End
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* End Session Modal */}
      <Dialog open={showEndModal} onOpenChange={setShowEndModal}>
        <DialogContent className="max-w-[95vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Session Summary</DialogTitle>
            <DialogDescription>Great work completing your session!</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 md:space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="bg-secondary/50 rounded-lg p-2 md:p-3 text-center">
                <p className="text-lg md:text-xl font-bold text-foreground">
                  {Object.values(exerciseRepsCompleted).reduce((a, b) => a + b, 0)}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground">Total Reps</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 md:p-3 text-center">
                <p className="text-lg md:text-xl font-bold text-foreground">
                  {Math.round(
                    (Object.values(exerciseRepsCompleted).reduce((a, b) => a + b, 0) /
                      exercises.reduce((sum, ex) => sum + (ex.reps || 0), 0)) *
                    100
                  ) || 0}
                  %
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground">Completion</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 md:p-3 text-center">
                <p className="text-lg md:text-xl font-bold text-primary">
                  {exercises.length}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground">Exercises</p>
              </div>
            </div>

            {/* Pain Slider */}
            <div>
              <label className="text-xs md:text-sm font-medium text-foreground mb-2 md:mb-3 block">
                Pain Level (after session): {painLevelPost[0]} / 10
              </label>
              <Slider
                value={painLevelPost}
                onValueChange={setPainLevelPost}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground mt-1">
                <span>No pain</span>
                <span>Severe</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs md:text-sm font-medium text-foreground mb-2 block">
                How did this session feel?
              </label>
              <Textarea
                placeholder="Add any notes..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSaveAndFinish}
              disabled={completeSessionMutation.isPending}
            >
              {completeSessionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Finish'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
