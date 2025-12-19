/**
 * Message service - Mock data implementation
 * No backend required - uses mock data
 */
import type {
  Message,
  MessageListResponse,
  MessageCreate,
  MessageListParams,
} from '@/types/api';

// Mock message data
const MOCK_MESSAGES: Message[] = [
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

const delay = (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms));

export const messageService = {
  /**
   * Get messages with optional filters
   */
  async getAll(params?: MessageListParams): Promise<MessageListResponse> {
    await delay();

    let filtered = [...MOCK_MESSAGES];

    if (params?.conversation_with) {
      // Get current user from localStorage
      const currentUser = localStorage.getItem('currentUser');
      const userId = currentUser ? JSON.parse(currentUser).id : 'doctor-1';

      filtered = filtered.filter(
        (m) =>
          (m.from_user === userId && m.to_user === params.conversation_with) ||
          (m.from_user === params.conversation_with && m.to_user === userId)
      );
    }

    if (params?.before) {
      filtered = filtered.filter(m => m.created_at < params.before!);
    }

    const limit = params?.limit || 200;
    const data = filtered.slice(0, limit);

    return {
      data,
      total: filtered.length,
    };
  },

  /**
   * Send a message
   */
  async send(data: MessageCreate): Promise<Message> {
    await delay();

    // Get current user from localStorage
    const currentUser = localStorage.getItem('currentUser');
    const fromUser = currentUser ? JSON.parse(currentUser).id : 'doctor-1';

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      from_user: fromUser,
      to_user: data.to_user,
      text: data.text,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    MOCK_MESSAGES.push(newMessage);
    return newMessage;
  },
};

