export interface Patient {
  id: string;
  name: string;
  avatar: string;
  condition: string;
  status: 'Active' | 'At Risk' | 'Discharged';
  adherence: 'Good' | 'Low' | 'Poor' | 'N/A';
  lastSession: string;
}

export interface Message {
  id: string;
  patientId: string;
  patientName: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'patient' | 'doctor';
  content: string;
  time: string;
  date?: string;
}

export interface Session {
  id: string;
  patientName: string;
  time: string;
  status: 'Completed' | 'Upcoming' | 'Missed';
  date: string;
}

export interface Exercise {
  id: string;
  name: string;
  image: string;
  tags: string[];
  joint?: string;
  position?: string;
  equipment?: string;
  difficulty?: string;
}

export const patients: Patient[] = [
  { id: 'PT-00254', name: 'Arthur Morgan', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', condition: 'Knee Replacement', status: 'Active', adherence: 'Low', lastSession: '2024-07-21' },
  { id: 'PT-00198', name: 'Sadie Adler', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', condition: 'Shoulder Injury', status: 'Active', adherence: 'Good', lastSession: '2024-07-22' },
  { id: 'PT-00213', name: 'John Marston', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', condition: 'Hip Surgery Rehab', status: 'At Risk', adherence: 'Poor', lastSession: '2024-07-18' },
  { id: 'PT-00301', name: 'Abigail Roberts', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face', condition: 'Lower Back Pain', status: 'Active', adherence: 'Good', lastSession: '2024-07-22' },
  { id: 'PT-00287', name: 'Javier Escuella', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face', condition: 'ACL Tear Recovery', status: 'Discharged', adherence: 'N/A', lastSession: '2024-06-15' },
];

export const messages: Message[] = [
  { id: '1', patientId: 'PT-00254', patientName: 'Arthur Morgan', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', lastMessage: 'Of course, let\'s discuss it in our session...', time: '10:42 AM', unread: true },
  { id: '2', patientId: 'PT-00198', patientName: 'Sadie Adler', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', lastMessage: 'Feeling much better today, thank you!', time: 'Yesterday', unread: false },
  { id: '3', patientId: 'PT-00213', patientName: 'John Marston', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', lastMessage: 'I have a question about the new exercise...', time: '2 days ago', unread: false },
  { id: '4', patientId: 'PT-00301', patientName: 'Abigail Roberts', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face', lastMessage: 'The session was great!', time: '3 days ago', unread: false },
];

export const chatHistory: ChatMessage[] = [
  { id: '1', sender: 'patient', content: 'The last exercise felt a bit too strenuous. Can we adjust it?', time: '10:40 AM' },
  { id: '2', sender: 'doctor', content: 'Of course, Arthur. Patient comfort and safety are top priorities. Let\'s discuss it in our session tomorrow and find a better alternative.', time: '10:42 AM' },
  { id: '3', sender: 'patient', content: 'Okay, that sounds good. Thanks, doc.', time: '3:15 PM', date: 'Yesterday' },
];

export const sessions: Session[] = [
  { id: '1', patientName: 'John M.', time: '09:00', status: 'Completed', date: '2024-09-04' },
  { id: '2', patientName: 'Sadie A.', time: '11:00', status: 'Completed', date: '2024-09-09' },
  { id: '3', patientName: 'Arthur M.', time: '14:00', status: 'Upcoming', date: '2024-09-10' },
  { id: '4', patientName: 'Abigail R.', time: '16:30', status: 'Upcoming', date: '2024-09-10' },
  { id: '5', patientName: 'Charles S.', time: '10:00', status: 'Upcoming', date: '2024-09-12' },
  { id: '6', patientName: 'Bill W.', time: '13:00', status: 'Missed', date: '2024-09-17' },
];

export const exercises: Exercise[] = [
  { id: '1', name: 'Standing Quad Stretch', image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=300&h=200&fit=crop', tags: ['Knee', 'Standing', 'No Equipment'], joint: 'Knee', position: 'Standing', equipment: 'No Equipment', difficulty: 'Beginner' },
  { id: '2', name: 'Glute Bridge', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&h=200&fit=crop', tags: ['Hip', 'Supine', 'No Equipment'], joint: 'Hip', position: 'Supine', equipment: 'No Equipment', difficulty: 'Beginner' },
  { id: '3', name: 'Bird Dog', image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=300&h=200&fit=crop', tags: ['Spine', 'Quadruped', 'Beginner'], joint: 'Spine', position: 'Quadruped', equipment: 'No Equipment', difficulty: 'Beginner' },
  { id: '4', name: 'Banded External Rotation', image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=300&h=200&fit=crop', tags: ['Shoulder', 'Standing', 'Band'], joint: 'Shoulder', position: 'Standing', equipment: 'Band', difficulty: 'Intermediate' },
  { id: '5', name: 'Bodyweight Squat', image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=300&h=200&fit=crop', tags: ['Knee', 'Hip', 'Standing'], joint: 'Knee', position: 'Standing', equipment: 'No Equipment', difficulty: 'Beginner' },
  { id: '6', name: 'Calf Raises', image: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=300&h=200&fit=crop', tags: ['Ankle', 'Standing', 'Beginner'], joint: 'Ankle', position: 'Standing', equipment: 'No Equipment', difficulty: 'Beginner' },
];

export const dashboardStats = {
  activePatients: 84,
  activePatientsTrend: 2.5,
  todaySessions: 6,
  todaySessionsTrend: -1.2,
  urgentAlerts: 3,
  alertTags: ['Low Adherence', 'Pain Spike'],
};

export const adherenceData = [
  { week: 'Week 1', completed: 65, total: 80 },
  { week: 'Week 2', completed: 72, total: 85 },
  { week: 'Week 3', completed: 58, total: 75 },
  { week: 'Week 4', completed: 80, total: 90 },
];

export const romPainData = [
  { day: 1, rom: 45, pain: 6 },
  { day: 5, rom: 52, pain: 5 },
  { day: 10, rom: 48, pain: 5.5 },
  { day: 15, rom: 60, pain: 4 },
  { day: 20, rom: 55, pain: 4.5 },
  { day: 25, rom: 68, pain: 3 },
  { day: 30, rom: 72, pain: 2.5 },
];

export const treatmentOutcomes = [
  { protocol: 'Knee Rehab', romGain: 'High', painReduction: 'Medium' },
  { protocol: 'Shoulder Flex', romGain: 'High', painReduction: 'High' },
  { protocol: 'Hip Strength', romGain: 'Medium', painReduction: 'Medium' },
];
