/**
 * Mock message data for patient-doctor communication
 */

export interface MockMessage {
  id: string;
  from_user: string;
  to_user: string;
  text: string;
  created_at: string;
  read_at: string | null;
}

export const MOCK_MESSAGES: MockMessage[] = [
  {
    id: 'msg-1',
    from_user: 'patient-1',
    to_user: 'doctor-1',
    text: 'Hi Doctor, I completed today\'s exercises. My knee feels much better!',
    created_at: '2025-12-09T15:30:00Z',
    read_at: '2025-12-09T16:00:00Z',
  },
  {
    id: 'msg-2',
    from_user: 'doctor-1',
    to_user: 'patient-1',
    text: 'That\'s great to hear! Keep up the good work. Let me know if you experience any pain.',
    created_at: '2025-12-09T16:05:00Z',
    read_at: '2025-12-09T16:30:00Z',
  },
  {
    id: 'msg-3',
    from_user: 'patient-2',
    to_user: 'doctor-1',
    text: 'Should I continue with the plank exercises if my back hurts a bit?',
    created_at: '2025-12-10T09:00:00Z',
    read_at: null,
  },
  {
    id: 'msg-4',
    from_user: 'patient-3',
    to_user: 'doctor-1',
    text: 'My shoulder ROM has improved to 165 degrees. Thank you!',
    created_at: '2025-12-08T14:20:00Z',
    read_at: '2025-12-08T15:00:00Z',
  },
  {
    id: 'msg-5',
    from_user: 'doctor-1',
    to_user: 'patient-3',
    text: 'Excellent progress! We\'ll continue with the current protocol.',
    created_at: '2025-12-08T15:10:00Z',
    read_at: '2025-12-08T16:00:00Z',
  },
];

export function getMockMessages(userId: string, conversationWith?: string): MockMessage[] {
  if (conversationWith) {
    return MOCK_MESSAGES.filter(
      (m) =>
        (m.from_user === userId && m.to_user === conversationWith) ||
        (m.from_user === conversationWith && m.to_user === userId)
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return MOCK_MESSAGES.filter((m) => m.from_user === userId || m.to_user === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getMockUnreadCount(userId: string): number {
  return MOCK_MESSAGES.filter((m) => m.to_user === userId && !m.read_at).length;
}
