# Vision Layer Documentation

This directory contains the core logic for the **MediaPipe-based Exercise Analysis** system.
It uses a "geometric" approach: measuring joint angles from 3D landmarks to track reps and assess form.

## Architecture

1.  **`poseClient.ts`**: Wraps `@mediapipe/tasks-vision`.
    *   Initializes the AI model (downloading the WASM/Task files).
    *   Takes a `<video>` element and outputs 33 3D landmarks (x, y, z).
    *   **Note**: We use the *Pose Landmarker* task, not raw OpenCV.

2.  **`angles.ts`**: Pure math layer.
    *   `computeAngle(a, b, c)`: Calculates the angle at 'b'.
    *   Helpers like `kneeFlexionAngle`, `hipFlexionAngle`, `torsoLeanAngle`.
    *   **Smoothing**: Uses Exponential Moving Average (EMA) to reduce jitter.

3.  **`repDetectors.ts`**: Exercise logic ("The Brain").
    *   Each exercise has a **State Machine** (Ready -> Down -> Bottom -> Up).
    *   Supports **Easy/Normal/Hard** difficulty levels.
    *   Tracks reps, range of motion (ROM), and form faults.
    *   **Personalized ROM**: Learns user's natural range and adapts targets.
    *   **Error Spotlight**: Identifies worst-performing limb segment with correction arrows.
    *   **Tempo Scoring**: Rewards controlled, steady movements.
    *   Returns a standardized `RepOutput` object.

4.  **`audioFeedback.ts`**: Web Speech API integration.
    *   Voice rep count announcements (1, 2, 3...).
    *   Form praise ("Great!", "Perfect!").
    *   Correction cues.

## Supported Exercises

### 1. Squat
*   **Metric**: Knee Flexion Angle (180° = Standing, <90° = Deep Squat).
*   **Thresholds by Difficulty**:
    | Difficulty | Down | Bottom | Up |
    |------------|------|--------|-----|
    | Easy       | 130° | 115°   | 150° |
    | Normal     | 110° | 95°    | 160° |
    | Hard       | 100° | 85°    | 165° |

### 2. Straight Leg Raise (SLR)
*   **Metric**: Hip Flexion Angle (180° = Flat, <90° = Vertical Leg).
*   **Thresholds by Difficulty**:
    | Difficulty | Up   | Top  | Down |
    |------------|------|------|------|
    | Easy       | 170° | 135° | 170° |
    | Normal     | 165° | 110° | 165° |
    | Hard       | 160° | 95°  | 160° |

### 3. Elbow Flexion (Bicep Curl)
*   **Metric**: Elbow Angle (180° = Straight, <45° = Curled).
*   **Thresholds by Difficulty**:
    | Difficulty | Flex | Top  | Ext  |
    |------------|------|------|------|
    | Easy       | 160° | 80°  | 155° |
    | Normal     | 150° | 60°  | 160° |
    | Hard       | 140° | 45°  | 165° |

## Key Features

### Difficulty Levels
```typescript
type DifficultyLevel = 'easy' | 'normal' | 'hard';
detector.setDifficulty('easy'); // Change dynamically
```

### Personalized ROM Learning
The system tracks each user's:
- **Best Achieved**: Peak ROM in session
- **Average Achieved**: Running average
- **Adaptive Target**: Set to 80% of best achieved

### Error Spotlight
Returns detailed error information for visual feedback:
```typescript
interface ErrorSpotlight {
  limbSegment: 'left_knee' | 'torso' | ...;
  errorMagnitude: number; // 0-1
  correctionDirection: { x: number; y: number }; // Arrow vector
  message: string;
}
```

### Tempo Scoring (0-100)
- <500ms: 20 (way too fast)
- 1-1.5s: 60-85 (acceptable)
- 2-3s: 100 (excellent - controlled)
- >4s: 60 (too slow)

### Visibility Checks
Landmarks must have visibility > 0.5 before angle calculation:
```typescript
const MIN_VISIBILITY = 0.5;
if ((landmark.visibility ?? 1) < MIN_VISIBILITY) {
  return { feedback: 'Move closer to camera' };
}
```

## Form Scoring

A `formScore` (0-100) is calculated for every rep based on:
1.  **ROM** (70%): Did you hit the target angle?
2.  **Tempo** (30%): Was the rep controlled?

## Audio Feedback

```typescript
import { createAudioFeedback } from './audioFeedback';

const audio = createAudioFeedback({ enabled: true });
audio.announceRep(count, formScore);
audio.announceCorrection('Go deeper');
audio.reset(); // On exercise change
```

## Integration

The UI (`PatientSessionActive.tsx`) renders:
- Face + body skeleton overlay
- Error spotlight with red highlights and correction arrows
- Real-time angle display
- Personalized ROM progress
- Difficulty selector
- Audio toggle

On session finish, metrics are saved to Supabase including per-rep tempo scores.
