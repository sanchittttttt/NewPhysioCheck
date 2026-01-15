import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, X, Loader2, Volume2, VolumeX, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  type RepOutput,
  type DifficultyLevel,
  type ErrorSpotlight,
  type PersonalizedROM,
} from '@/lib/vision/repDetectors';
import { createAudioFeedback, type AudioFeedbackController } from '@/lib/vision/audioFeedback';

// --- DATA SHAPES FOR BACKEND INTEGRATION ---

interface SessionResult {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  exercises: ExerciseResult[];
}

interface ExerciseResult {
  exerciseKey: string;
  totalReps: number;
  avgMaxAngle: number;
  avgFormScore: number;
}

// MediaPipe connections for skeleton drawing
const BODY_CONNECTIONS: Array<[number, number]> = [
  // Torso
  [11, 12], // shoulders
  [11, 23], [12, 24], // shoulders to hips
  [23, 24], // hips
  // Arms
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  // Legs
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
  // Hands (optional)
  [15, 17], [15, 19], [15, 21], // left hand
  [16, 18], [16, 20], [16, 22], // right hand
  // Feet (optional)
  [27, 29], [27, 31], // left foot
  [28, 30], [28, 32], // right foot
];

// Face connections for drawing
// MediaPipe Pose landmarks: 0=nose, 1=left_eye_inner, 2=left_eye, 3=left_eye_outer,
// 4=right_eye_inner, 5=right_eye, 6=right_eye_outer, 7=left_ear, 8=right_ear,
// 9=mouth_left, 10=mouth_right
const FACE_CONNECTIONS: Array<[number, number]> = [
  // Eyes - connect eye corners
  [1, 2], [2, 3],  // Left eye inner -> center -> outer
  [4, 5], [5, 6],  // Right eye inner -> center -> outer
  // Nose to eyes
  [0, 2], [0, 5],  // Nose to eye centers
  // Ears to outer eyes
  [3, 7],  // Left outer eye to left ear
  [6, 8],  // Right outer eye to right ear
  // Mouth
  [9, 10], // Mouth corners
];

// Limb segment indices for error spotlight
const LIMB_SEGMENTS: Record<string, number[]> = {
  left_knee: [23, 25, 27],
  right_knee: [24, 26, 28],
  left_hip: [11, 23, 25],
  right_hip: [12, 24, 26],
  torso: [11, 12, 23, 24],
  left_elbow: [11, 13, 15],
  right_elbow: [12, 14, 16],
};

/**
 * PatientSessionActive Component
 */
export default function PatientSessionActive() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateSession, refreshSessions } = useSession();
  const { protocols, exercises: allExercises } = useProtocol();

  // Get session_id and protocol_id from URL params
  const sessionIdParam = searchParams.get('session_id');
  const protocolIdParam = searchParams.get('protocol_id');

  // Initialize state
  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam);
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
  const [errorSpotlight, setErrorSpotlight] = useState<ErrorSpotlight | undefined>();
  const [personalizedROM, setPersonalizedROM] = useState<PersonalizedROM | undefined>();

  // Tracking quality indicators
  const [trackingQuality, setTrackingQuality] = useState(0);
  const [fullBodyVisible, setFullBodyVisible] = useState(true);

  // Difficulty and Audio
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('easy');
  const [audioEnabled, setAudioEnabled] = useState(true);

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
  const audioFeedbackRef = useRef<AudioFeedbackController | null>(null);

  // To detect NEW reps in the loop
  const lastRepCountRef = useRef<number>(0);

  // Track reps completed per exercise
  const [exerciseRepsCompleted, setExerciseRepsCompleted] = useState<Record<string, number>>({});

  // Find protocol
  const [protocol, setProtocol] = useState<Protocol | null>(protocols.find(p => p.id === protocolIdParam) || null);
  const [protocolLoading, setProtocolLoading] = useState(false);

  // Initialize audio feedback
  useEffect(() => {
    audioFeedbackRef.current = createAudioFeedback({ enabled: audioEnabled });
  }, []);

  // Update audio enabled state
  useEffect(() => {
    if (audioFeedbackRef.current) {
      audioFeedbackRef.current.setEnabled(audioEnabled);
    }
  }, [audioEnabled]);

  // Fetch full protocol with steps if not found or steps missing
  useEffect(() => {
    const fetchProtocol = async () => {
      if (!protocolIdParam) return;
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
    if (protocol?.steps && protocol.steps.length > 0) {
      return protocol.steps;
    }

    // FALLBACK: For demo mode, create steps from AI-enabled exercises
    if (allExercises.length > 0) {
      console.log('[PatientSessionActive] Using fallback exercises for demo mode');
      // Prefer AI-enabled exercises (squat, slr, bicep curl)
      const aiExercises = allExercises.filter(ex =>
        ex.name.toLowerCase().includes('squat') ||
        ex.name.toLowerCase().includes('leg raise') ||
        ex.name.toLowerCase().includes('slr') ||
        ex.name.toLowerCase().includes('curl') ||
        ex.name.toLowerCase().includes('bicep')
      );
      const exercisesToUse = aiExercises.length > 0 ? aiExercises : allExercises.slice(0, 3);

      return exercisesToUse.map((ex, index) => ({
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
    if (name.includes('slr') || name.includes('leg raise') || name.includes('straight leg')) return 'slr';
    if (name.includes('squat')) return 'squat';

    const note = (step.notes || '').toLowerCase();
    if (note.includes('elbow')) return 'elbow_flexion';
    if (note.includes('leg raise')) return 'slr';

    return 'squat';
  };

  const createDetector = (type: ExerciseType, side: 'left' | 'right', difficulty: DifficultyLevel): RepDetector => {
    switch (type) {
      case 'elbow_flexion':
        return createElbowFlexionRepDetector(side, difficulty);
      case 'slr':
        return createSlrRepDetector(side, difficulty);
      case 'squat':
      default:
        return createSquatRepDetector(side, difficulty);
    }
  };

  // Recreate detector when exercise or difficulty changes
  useEffect(() => {
    if (!currentStep) return;
    const exerciseName = exerciseMap.get(currentStep.exercise_id)?.name;
    const type = resolveExerciseType(currentStep, exerciseName);
    const side = (currentStep.side as 'left' | 'right') || 'left';

    const detector = createDetector(type, side, difficulty);
    detector.reset();
    repDetectorRef.current = detector;
    lastRepCountRef.current = 0;

    setLastRep(null);
    setLiveFeedback('Get ready...');
    setErrorSpotlight(undefined);
    setPersonalizedROM(undefined);

    // Reset audio state for new exercise
    audioFeedbackRef.current?.reset();

    setExerciseRepsCompleted((prev) => ({
      ...prev,
      [currentStep.exercise_id]: prev[currentStep.exercise_id] || 0,
    }));
  }, [currentStep, currentExerciseIndex, exerciseMap, difficulty]);

  // Update detector difficulty when changed
  useEffect(() => {
    if (repDetectorRef.current) {
      repDetectorRef.current.setDifficulty(difficulty);
    }
  }, [difficulty]);

  /**
   * Draw skeleton with face, body, and error spotlight overlay
   */
  const drawSkeleton = useCallback((landmarks: PoseLandmark[], spotlight?: ErrorSpotlight) => {
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

    const toPx = (lm: PoseLandmark) => ({ x: lm.x * width, y: lm.y * height });
    // Body landmarks need higher visibility, face landmarks can have lower
    const isBodyVisible = (lm: PoseLandmark) => (lm.visibility ?? 1) > 0.5;
    const isFaceVisible = (lm: PoseLandmark) => (lm.visibility ?? 1) > 0.2; // Lower threshold for face

    // Get highlighted limb indices for error spotlight
    const highlightedIndices = new Set<number>();
    if (spotlight?.limbSegment && spotlight.errorMagnitude > 0.3) { // Increased from 0.2
      const indices = LIMB_SEGMENTS[spotlight.limbSegment] || [];
      indices.forEach(i => highlightedIndices.add(i));
    }

    // Draw body connections
    ctx.lineWidth = 3;
    BODY_CONNECTIONS.forEach(([aIdx, bIdx]) => {
      const a = landmarks[aIdx];
      const b = landmarks[bIdx];
      if (!a || !b || !isBodyVisible(a) || !isBodyVisible(b)) return;

      const pa = toPx(a);
      const pb = toPx(b);

      // Color based on error spotlight
      const isHighlighted = highlightedIndices.has(aIdx) || highlightedIndices.has(bIdx);
      if (isHighlighted && spotlight) {
        const intensity = Math.min(spotlight.errorMagnitude * 1.5, 1);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + intensity * 0.5})`; // Red with varying intensity
        ctx.lineWidth = 5;
      } else {
        ctx.strokeStyle = '#10b981'; // Green
        ctx.lineWidth = 3;
      }

      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });

    // Draw face connections (thinner, different color) - use lower visibility threshold
    ctx.strokeStyle = '#60a5fa'; // Blue for face
    ctx.lineWidth = 2;
    FACE_CONNECTIONS.forEach(([aIdx, bIdx]) => {
      const a = landmarks[aIdx];
      const b = landmarks[bIdx];
      if (!a || !b || !isFaceVisible(a) || !isFaceVisible(b)) return;

      const pa = toPx(a);
      const pb = toPx(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });

    // Draw landmarks
    landmarks.forEach((lm, idx) => {
      const isFace = idx <= 10;
      // Use different visibility thresholds for face vs body
      const visible = isFace ? isFaceVisible(lm) : isBodyVisible(lm);
      if (!lm || !visible) return;
      const p = toPx(lm);

      // Size and color based on type and highlight
      const isHighlighted = highlightedIndices.has(idx);

      if (isHighlighted && spotlight) {
        ctx.fillStyle = '#ef4444'; // Red for error
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Draw correction arrow
        if (spotlight.correctionDirection && idx === Math.min(...Array.from(highlightedIndices))) {
          ctx.strokeStyle = '#fbbf24'; // Yellow arrow
          ctx.lineWidth = 3;
          const arrowLen = 40;
          const dx = spotlight.correctionDirection.x * arrowLen;
          const dy = spotlight.correctionDirection.y * arrowLen;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx, p.y + dy);
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.moveTo(p.x + dx, p.y + dy);
          ctx.lineTo(p.x + dx - 8, p.y + dy - 8 * Math.sign(dy || 1));
          ctx.lineTo(p.x + dx + 8, p.y + dy - 8 * Math.sign(dy || 1));
          ctx.closePath();
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
        }
      } else {
        ctx.fillStyle = isFace ? '#60a5fa' : '#22d3ee';
        ctx.beginPath();
        ctx.arc(p.x, p.y, isFace ? 3 : 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }, []);

  /**
   * Start camera + pose client loop.
   */
  useEffect(() => {
    let isMounted = true;

    const startVision = async () => {
      try {
        // Request HD resolution for better pose tracking
        // Higher resolution = better landmark accuracy, especially for extremities
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 60 }
          },
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

          // Update tracking quality indicators
          setTrackingQuality(poseClientRef.current.getTrackingQuality());
          setFullBodyVisible(poseClientRef.current.isFullBodyVisible());

          if (result?.landmarks) {
            const detector = repDetectorRef.current;
            const step = currentStepRef.current;

            let currentSpotlight: ErrorSpotlight | undefined;

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
              if (output.errorSpotlight) {
                setErrorSpotlight(output.errorSpotlight);
                currentSpotlight = output.errorSpotlight;
              }
              if (output.personalizedROM) {
                setPersonalizedROM(output.personalizedROM);
              }

              // Check for NEW rep
              if (output.repCount > lastRepCountRef.current) {
                lastRepCountRef.current = output.repCount;

                // Audio feedback
                if (output.lastRep) {
                  audioFeedbackRef.current?.announceRep(output.repCount, output.lastRep.formScore);
                }

                // Rep completed!
                if (output.lastRep) {
                  const exerciseId = step.exercise_id || 'exercise-unknown';
                  const payload: SessionRepPayload = {
                    exerciseId,
                    repIndex: output.repCount,
                    romMax: output.lastRep.maxAngle - output.lastRep.minAngle,
                    romTarget: output.personalizedROM?.targetROM || 90,
                    accuracyScore: Math.round((output.lastRep.formScore / 100) * 100),
                    tempoScore: output.lastRep.tempoScore,
                    formQuality: output.lastRep.formScore > 80 ? 'good' : output.lastRep.formScore > 60 ? 'fair' : 'improve',
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

            drawSkeleton(result.landmarks, currentSpotlight);
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
  }, [drawSkeleton]);

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
      const metricsMap = new Map<string, {
        name: string;
        slug: string;
        reps: SessionRepPayload[]
      }>();

      for (const rep of liveReps) {
        const exId = rep.exerciseId;
        const exercise = exerciseMap.get(exId);
        const exerciseName = exercise?.name || 'Unknown';

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
        
        // Refresh sessions in context to show the new session immediately
        refreshSessions();
        
        toast({
          title: 'Session Completed! 🎉',
          description: `Great work! ${metrics.reduce((sum, m) => sum + m.total_reps, 0)} reps saved.`,
        });
      } else {
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
        <div className="flex items-center gap-2">
          {/* Difficulty Selector */}
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DifficultyLevel)}>
            <SelectTrigger className="w-24 h-8">
              <Zap className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>

          {/* Audio Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Mute audio' : 'Enable audio'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={handleEndSession}>
            <X className="w-5 h-5" />
          </Button>
        </div>
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
            {/* Error Spotlight Message */}
            {errorSpotlight?.message && errorSpotlight.errorMagnitude > 0.3 && (
              <div className="text-lg text-red-400 font-medium drop-shadow-md animate-pulse">
                ⚠️ {errorSpotlight.message}
              </div>
            )}
          </div>

          {/* Exercise Info Overlay */}
          <div className="absolute top-4 left-4 bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm z-20">
            <div className="text-sm opacity-80">Exercise {currentExerciseIndex + 1}/{totalExercises}</div>
            <div className="font-bold text-lg">{getCurrentExerciseName()}</div>
            {currentStep.side && <div className="text-sm text-emerald-400 uppercase tracking-wider">{currentStep.side} Side</div>}
            <div className="text-xs text-amber-400 mt-1 capitalize">
              {difficulty} Mode
            </div>
          </div>

          {/* Personalized ROM Display */}
          {personalizedROM && personalizedROM.repCount > 0 && (
            <div className="absolute top-4 right-4 bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm z-20">
              <div className="text-xs opacity-80 uppercase tracking-wider">Your Progress</div>
              <div className="text-lg font-bold text-emerald-400">{Math.round(personalizedROM.bestAchieved)}° best</div>
              <div className="text-sm text-blue-400">Target: {Math.round(personalizedROM.targetROM)}°</div>
            </div>
          )}

          {/* Tracking Quality Indicator */}
          <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded-lg backdrop-blur-sm z-20">
            <div className="text-xs opacity-80 uppercase tracking-wider mb-1">Tracking</div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${trackingQuality > 70 ? 'bg-emerald-500' :
                    trackingQuality > 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                  style={{ width: `${trackingQuality}%` }}
                />
              </div>
              <span className={`text-sm font-mono ${trackingQuality > 70 ? 'text-emerald-400' :
                trackingQuality > 40 ? 'text-amber-400' : 'text-red-400'
                }`}>
                {trackingQuality}%
              </span>
            </div>
          </div>

          {/* Full Body Visibility Warning */}
          {!fullBodyVisible && poseReady && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-amber-500/90 text-black px-4 py-2 rounded-lg backdrop-blur-sm z-30 animate-bounce">
              <div className="flex items-center gap-2 font-medium">
                <span>📐</span>
                <span>Step back - show full body (head to feet)</span>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background text-destructive z-30">
              {cameraError}
            </div>
          )}
          {!poseReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black text-white z-30 flex-col gap-2">
              <Loader2 className="w-10 h-10 animate-spin" />
              <div className="text-sm text-muted-foreground">Loading AI model (Heavy)...</div>
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{lastRep.accuracyScore}%</div>
                    <div className="text-xs text-muted-foreground">Form</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{Math.round(lastRep.romMax || 0)}°</div>
                    <div className="text-xs text-muted-foreground">ROM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{lastRep.tempoScore || 0}</div>
                    <div className="text-xs text-muted-foreground">Tempo</div>
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

            {/* Tips */}
            <div className="text-xs text-muted-foreground text-center pt-6 space-y-1">
              <p>🎯 AI-powered tracking active</p>
              <p>Ensure your full body is visible</p>
              {audioEnabled && <p>🔊 Audio feedback enabled</p>}
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
