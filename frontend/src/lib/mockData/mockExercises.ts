/**
 * Mock exercise library data
 */

export interface MockExercise {
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    joint: string;
    position: string;
    equipment: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    normal_range_min: number;
    normal_range_max: number;
    created_at: string;
}

export const MOCK_EXERCISES: MockExercise[] = [
    // Exercises with AI-powered pose detection (matches repDetectors.ts)
    {
        id: 'ex-squat',
        name: 'Bodyweight Squat',
        description: 'Stand with feet shoulder-width apart, bend knees and lower hips as if sitting back. AI tracks your knee angle for proper depth.',
        image_url: null,
        joint: 'knee',
        position: 'standing',
        equipment: 'none',
        difficulty: 'beginner',
        normal_range_min: 90,
        normal_range_max: 180,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-slr',
        name: 'Straight Leg Raise',
        description: 'Lie on your back with legs straight. Lift one leg toward ceiling keeping knee locked. AI tracks your hip flexion angle.',
        image_url: null,
        joint: 'hip',
        position: 'supine',
        equipment: 'none',
        difficulty: 'beginner',
        normal_range_min: 60,
        normal_range_max: 180,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-bicep-curl',
        name: 'Bicep Curl',
        description: 'Stand with arm at side, curl forearm up toward shoulder. AI tracks your elbow flexion for complete range of motion.',
        image_url: null,
        joint: 'elbow',
        position: 'standing',
        equipment: 'dumbbell',
        difficulty: 'beginner',
        normal_range_min: 30,
        normal_range_max: 180,
        created_at: '2025-01-01T00:00:00Z',
    },
    // Standard exercises
    {
        id: 'ex-1',
        name: 'Quad Sets',
        description: 'Tighten thigh muscles while keeping leg straight',
        image_url: null,
        joint: 'knee',
        position: 'supine',
        equipment: 'resistance band',
        difficulty: 'beginner',
        normal_range_min: 0,
        normal_range_max: 135,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-2',
        name: 'Hamstring Curls',
        description: 'Bend knee while lying face down',
        image_url: null,
        joint: 'knee',
        position: 'prone',
        equipment: 'none',
        difficulty: 'beginner',
        normal_range_min: 0,
        normal_range_max: 130,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-3',
        name: 'Planks',
        description: 'Hold body in straight line on forearms and toes',
        image_url: null,
        joint: 'spine',
        position: 'prone',
        equipment: 'none',
        difficulty: 'intermediate',
        normal_range_min: 0,
        normal_range_max: 0,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-4',
        name: 'Bird Dogs',
        description: 'Extend opposite arm and leg while on hands and knees',
        image_url: null,
        joint: 'spine',
        position: 'quadruped',
        equipment: 'none',
        difficulty: 'intermediate',
        normal_range_min: 0,
        normal_range_max: 0,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-5',
        name: 'Shoulder External Rotation',
        description: 'Rotate arm outward with resistance band',
        image_url: null,
        joint: 'shoulder',
        position: 'standing',
        equipment: 'resistance band',
        difficulty: 'beginner',
        normal_range_min: 0,
        normal_range_max: 90,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-6',
        name: 'Shoulder Internal Rotation',
        description: 'Rotate arm inward with resistance band',
        image_url: null,
        joint: 'shoulder',
        position: 'standing',
        equipment: 'resistance band',
        difficulty: 'beginner',
        normal_range_min: 0,
        normal_range_max: 70,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-7',
        name: 'Glute Bridges',
        description: 'Lift hips while lying on back with knees bent',
        image_url: null,
        joint: 'hip',
        position: 'supine',
        equipment: 'none',
        difficulty: 'beginner',
        normal_range_min: 0,
        normal_range_max: 0,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'ex-8',
        name: 'Leg Press',
        description: 'Push weight away using legs',
        image_url: null,
        joint: 'knee',
        position: 'seated',
        equipment: 'machine',
        difficulty: 'intermediate',
        normal_range_min: 0,
        normal_range_max: 135,
        created_at: '2025-01-01T00:00:00Z',
    },
];

export function getMockExercises(): MockExercise[] {
    return MOCK_EXERCISES;
}

export function getMockExercise(id: string): MockExercise | undefined {
    return MOCK_EXERCISES.find((ex) => ex.id === id);
}

export function searchMockExercises(query: string): MockExercise[] {
    const lowerQuery = query.toLowerCase();
    return MOCK_EXERCISES.filter(
        (ex) =>
            ex.name.toLowerCase().includes(lowerQuery) ||
            ex.description.toLowerCase().includes(lowerQuery) ||
            ex.joint.toLowerCase().includes(lowerQuery)
    );
}
