// Patient-specific mock data

export interface PatientProtocol {
  id: string;
  name: string;
  condition: string;
  physioName: string;
  physioAvatar: string;
  frequency: string;
  sessionsCompleted: number;
  sessionsTotal: number;
  startDate: string;
}

export interface PatientSession {
  id: string;
  date: string;
  time: string;
  protocolName: string;
  status: 'Upcoming' | 'Completed' | 'Missed';
  accuracy?: number;
  pain?: number;
  physioName: string;
}

export interface PhysioMessage {
  id: string;
  sender: 'patient' | 'physio';
  content: string;
  time: string;
  date?: string;
}

export interface SessionExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  holdTime?: number;
  instructions: string[];
}

export interface FeedbackItem {
  id: string;
  time: string;
  message: string;
  type: 'positive' | 'correction' | 'neutral';
}

export const patientInfo = {
  id: 'PT-00254',
  name: 'Arthur Morgan',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  assignedPhysio: {
    name: 'Dr. Evelyn Reed',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=face',
  },
  adherence: 65,
  streak: 3,
  sessionsThisWeek: { completed: 4, total: 6 },
};

export const todaySession = {
  date: 'Today, Dec 10',
  time: '2:00 PM',
  protocolName: 'Knee Rehab – Week 2',
  status: 'Due' as const,
  estimatedTime: 18,
};

export const patientProtocols: PatientProtocol[] = [
  {
    id: '1',
    name: 'Knee Rehab – Week 2',
    condition: 'Post Knee Replacement',
    physioName: 'Dr. Evelyn Reed',
    physioAvatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=face',
    frequency: '3× per week',
    sessionsCompleted: 5,
    sessionsTotal: 12,
    startDate: '2024-11-15',
  },
  {
    id: '2',
    name: 'Mobility Maintenance',
    condition: 'General Flexibility',
    physioName: 'Dr. Evelyn Reed',
    physioAvatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=face',
    frequency: '2× per week',
    sessionsCompleted: 3,
    sessionsTotal: 8,
    startDate: '2024-11-20',
  },
];

export const upcomingSessions: PatientSession[] = [
  { id: '1', date: 'Today', time: '2:00 PM', protocolName: 'Knee Rehab – Week 2', status: 'Upcoming', physioName: 'Dr. Evelyn Reed' },
  { id: '2', date: 'Tomorrow', time: '10:00 AM', protocolName: 'Mobility Maintenance', status: 'Upcoming', physioName: 'Dr. Evelyn Reed' },
  { id: '3', date: 'Dec 12', time: '2:00 PM', protocolName: 'Knee Rehab – Week 2', status: 'Upcoming', physioName: 'Dr. Evelyn Reed' },
  { id: '4', date: 'Dec 14', time: '10:00 AM', protocolName: 'Mobility Maintenance', status: 'Upcoming', physioName: 'Dr. Evelyn Reed' },
];

export const allPatientSessions: PatientSession[] = [
  { id: '1', date: '2024-12-10', time: '2:00 PM', protocolName: 'Knee Rehab – Week 2', status: 'Upcoming', physioName: 'Dr. Evelyn Reed' },
  { id: '2', date: '2024-12-09', time: '10:00 AM', protocolName: 'Mobility Maintenance', status: 'Completed', accuracy: 85, pain: 3, physioName: 'Dr. Evelyn Reed' },
  { id: '3', date: '2024-12-08', time: '2:00 PM', protocolName: 'Knee Rehab – Week 2', status: 'Completed', accuracy: 82, pain: 4, physioName: 'Dr. Evelyn Reed' },
  { id: '4', date: '2024-12-07', time: '10:00 AM', protocolName: 'Mobility Maintenance', status: 'Completed', accuracy: 78, pain: 4, physioName: 'Dr. Evelyn Reed' },
  { id: '5', date: '2024-12-06', time: '2:00 PM', protocolName: 'Knee Rehab – Week 2', status: 'Missed', physioName: 'Dr. Evelyn Reed' },
  { id: '6', date: '2024-12-05', time: '2:00 PM', protocolName: 'Knee Rehab – Week 2', status: 'Completed', accuracy: 90, pain: 3, physioName: 'Dr. Evelyn Reed' },
  { id: '7', date: '2024-12-04', time: '10:00 AM', protocolName: 'Mobility Maintenance', status: 'Completed', accuracy: 88, pain: 3, physioName: 'Dr. Evelyn Reed' },
  { id: '8', date: '2024-12-03', time: '2:00 PM', protocolName: 'Knee Rehab – Week 2', status: 'Completed', accuracy: 75, pain: 5, physioName: 'Dr. Evelyn Reed' },
];

export const physioMessages: PhysioMessage[] = [
  { id: '1', sender: 'physio', content: 'Great work on yesterday\'s session! Your ROM is improving nicely. Keep focusing on controlled movements.', time: '9:30 AM', date: 'Today' },
  { id: '2', sender: 'patient', content: 'Thank you! I felt a bit of discomfort in the last exercise though.', time: '10:15 AM' },
  { id: '3', sender: 'physio', content: 'That\'s good feedback. Let\'s modify the squat depth for today\'s session. Take it at 70% range until we meet next.', time: '10:20 AM' },
  { id: '4', sender: 'patient', content: 'Sounds good, I\'ll do that. Should I still aim for the same number of reps?', time: '10:25 AM' },
  { id: '5', sender: 'physio', content: 'Yes, same reps are fine. Quality over quantity - listen to your body!', time: '10:28 AM' },
];

export const recentPhysioFeedback: PhysioMessage[] = [
  { id: '1', sender: 'physio', content: 'Great progress this week! Your knee flexion has improved by 8° since last Monday.', time: 'Today, 9:30 AM' },
  { id: '2', sender: 'physio', content: 'Remember to keep your back straight during the squats - I noticed some forward lean in the last session.', time: 'Yesterday, 3:15 PM' },
  { id: '3', sender: 'physio', content: 'You\'re doing great with consistency! 4 sessions completed this week - keep up the momentum.', time: '2 days ago' },
];

export const currentSessionExercises: SessionExercise[] = [
  {
    id: '1',
    name: 'Supported Squat',
    sets: 3,
    reps: 10,
    instructions: [
      'Hold onto a stable surface for balance',
      'Keep knees aligned with toes',
      'Lower to comfortable depth',
    ],
  },
  {
    id: '2',
    name: 'Straight Leg Raise',
    sets: 3,
    reps: 12,
    instructions: [
      'Lie flat on your back',
      'Keep leg straight throughout',
      'Lift to 45° and lower slowly',
    ],
  },
  {
    id: '3',
    name: 'Heel Slides',
    sets: 2,
    reps: 15,
    instructions: [
      'Lie on back with legs extended',
      'Slide heel toward buttocks',
      'Control the movement both ways',
    ],
  },
];

export const liveFeedback: FeedbackItem[] = [
  { id: '1', time: '00:38', message: 'Great depth on that rep!', type: 'positive' },
  { id: '2', time: '00:32', message: 'Keep your chest up', type: 'correction' },
  { id: '3', time: '00:25', message: 'Good pace, maintain rhythm', type: 'neutral' },
  { id: '4', time: '00:18', message: 'Excellent knee alignment', type: 'positive' },
];

export const patientProgressData = {
  overallAdherence: 78,
  romImprovement: 18,
  romComparedToStart: 'up',
  averagePain: 3.2,
  painTrend: 'down',
  painReduction: 2.1,
};

export const romOverTimeData = [
  { date: 'Week 1', rom: 52 },
  { date: 'Week 2', rom: 58 },
  { date: 'Week 3', rom: 62 },
  { date: 'Week 4', rom: 68 },
  { date: 'Week 5', rom: 70 },
];

export const accuracyOverTimeData = [
  { date: 'Week 1', accuracy: 68 },
  { date: 'Week 2', accuracy: 72 },
  { date: 'Week 3', accuracy: 78 },
  { date: 'Week 4', accuracy: 82 },
  { date: 'Week 5', accuracy: 85 },
];

export const sessionCalendarData = [
  { date: '2024-12-01', status: 'completed' },
  { date: '2024-12-02', status: 'rest' },
  { date: '2024-12-03', status: 'completed' },
  { date: '2024-12-04', status: 'completed' },
  { date: '2024-12-05', status: 'completed' },
  { date: '2024-12-06', status: 'missed' },
  { date: '2024-12-07', status: 'completed' },
  { date: '2024-12-08', status: 'completed' },
  { date: '2024-12-09', status: 'completed' },
  { date: '2024-12-10', status: 'upcoming' },
];

export const progressHighlights = [
  "You've improved your knee flexion by 18° since starting.",
  "You completed 78% of your planned sessions this month.",
  "Your average pain level decreased from 5.3 to 3.2.",
  "Great 3-day streak! Keep it going!",
];
