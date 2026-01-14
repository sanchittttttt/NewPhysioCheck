/**
 * Audio Feedback Module using Web Speech API
 * Provides spoken feedback for rep counts and form corrections
 */

type FeedbackType = 'rep_count' | 'form_good' | 'form_correction' | 'instruction';

interface AudioFeedbackOptions {
    enabled: boolean;
    volume: number; // 0-1
    rate: number; // 0.5-2 (speech rate)
    pitch: number; // 0-2 (speech pitch)
}

const DEFAULT_OPTIONS: AudioFeedbackOptions = {
    enabled: true,
    volume: 1,
    rate: 1.1, // Slightly faster for responsiveness
    pitch: 1,
};

// Throttle to prevent overlapping speech
let lastSpokenTime = 0;
const MIN_SPEECH_GAP_MS = 1200;

// Track last spoken messages to avoid repetition
let lastSpokenMessage = '';
let lastSpokenRepCount = 0;

// Check if Web Speech API is available
function isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Speak a message using Web Speech API
function speak(
    message: string,
    options: AudioFeedbackOptions = DEFAULT_OPTIONS,
    priority: boolean = false
): void {
    if (!options.enabled || !isSpeechSupported()) return;

    const now = Date.now();

    // Skip if too soon (unless priority)
    if (!priority && now - lastSpokenTime < MIN_SPEECH_GAP_MS) return;

    // Skip if same message repeated
    if (message === lastSpokenMessage && !priority) return;

    // Cancel any ongoing speech for priority messages
    if (priority) {
        window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.volume = options.volume;
    utterance.rate = options.rate;
    utterance.pitch = options.pitch;

    // Try to use a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
        v.name.includes('Google') ||
        v.name.includes('Natural') ||
        v.lang.startsWith('en')
    );
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    lastSpokenTime = now;
    lastSpokenMessage = message;
}

// Rep count announcement
export function announceRepCount(count: number, options?: Partial<AudioFeedbackOptions>): void {
    if (count === lastSpokenRepCount) return;
    lastSpokenRepCount = count;

    const opts = { ...DEFAULT_OPTIONS, ...options };
    speak(count.toString(), opts, true);
}

// Good form praise
export function announceGoodForm(options?: Partial<AudioFeedbackOptions>): void {
    const phrases = ['Nice!', 'Great form!', 'Perfect!', 'Excellent!', 'Good job!'];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    speak(phrase, { ...DEFAULT_OPTIONS, ...options });
}

// Form correction cue
export function announceCorrection(
    message: string,
    options?: Partial<AudioFeedbackOptions>
): void {
    speak(message, { ...DEFAULT_OPTIONS, ...options });
}

// Exercise instruction
export function announceInstruction(
    instruction: string,
    options?: Partial<AudioFeedbackOptions>
): void {
    speak(instruction, { ...DEFAULT_OPTIONS, ...options, rate: 1 });
}

// Announce rep completion with optional form feedback
export function announceRepComplete(
    repCount: number,
    formScore: number,
    options?: Partial<AudioFeedbackOptions>
): void {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Always announce the rep count
    announceRepCount(repCount, opts);

    // If good form, sometimes add praise
    if (formScore >= 85 && Math.random() > 0.6) {
        setTimeout(() => announceGoodForm(opts), 600);
    }
}

// Reset state (call when switching exercises)
export function resetAudioState(): void {
    lastSpokenTime = 0;
    lastSpokenMessage = '';
    lastSpokenRepCount = 0;
    if (isSpeechSupported()) {
        window.speechSynthesis.cancel();
    }
}

// Create audio feedback controller
export interface AudioFeedbackController {
    enabled: boolean;
    setEnabled(enabled: boolean): void;
    announceRep(count: number, formScore: number): void;
    announceCorrection(message: string): void;
    announceInstruction(instruction: string): void;
    reset(): void;
}

export function createAudioFeedback(
    initialOptions: Partial<AudioFeedbackOptions> = {}
): AudioFeedbackController {
    let options: AudioFeedbackOptions = { ...DEFAULT_OPTIONS, ...initialOptions };

    return {
        get enabled() {
            return options.enabled;
        },

        setEnabled(enabled: boolean) {
            options.enabled = enabled;
            if (!enabled && isSpeechSupported()) {
                window.speechSynthesis.cancel();
            }
        },

        announceRep(count: number, formScore: number) {
            announceRepComplete(count, formScore, options);
        },

        announceCorrection(message: string) {
            announceCorrection(message, options);
        },

        announceInstruction(instruction: string) {
            announceInstruction(instruction, options);
        },

        reset() {
            resetAudioState();
        },
    };
}
