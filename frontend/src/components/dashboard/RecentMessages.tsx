import { useQuery } from '@tanstack/react-query';
import { messageService } from '@/lib/services/messageService';
import { patientService } from '@/lib/services/patientService';
import { useAuth } from '@/context/AuthContext';
import { Loader2, User } from 'lucide-react';
import { useMemo } from 'react';
import type { Message, Patient } from '@/types/api';

export function RecentMessages() {
  const { user } = useAuth();

  // Fetch recent messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', 'recent'],
    queryFn: () => messageService.getAll({ limit: 10 }),
  });

  // Fetch patients to match with messages
  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'for-messages'],
    queryFn: () => patientService.getAll({ limit: 100 }),
  });

  const messages: Message[] = messagesData?.data || [];
  const patients: Patient[] = patientsData?.data || [];

  // Get recent messages with patient info
  const recentMessagesWithPatient = useMemo(() => {
    if (!user?.id) return [];

    return messages
      .slice(0, 3)
      .map((msg) => {
        // Get the other user (patient) from the message
        const patientId = msg.from_user === user.id ? msg.to_user : msg.from_user;
        const patient = patients.find((p) => p.id === patientId);

        return {
          message: msg,
          patient,
          isFromCurrentUser: msg.from_user === user.id,
        };
      })
      .filter((item) => item.patient); // Only show messages with known patients
  }, [messages, patients, user?.id]);

  if (messagesLoading) {
    return (
      <div className="stat-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Messages</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (recentMessagesWithPatient.length === 0) {
    return (
      <div className="stat-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Messages</h3>
        <p className="text-sm text-muted-foreground">No recent messages</p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent Messages</h3>

      <div className="space-y-4">
        {recentMessagesWithPatient.map(({ message, patient, isFromCurrentUser }) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${isFromCurrentUser ? 'flex-row-reverse' : ''}`}
          >
            {!isFromCurrentUser && patient && (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className={`flex-1 ${isFromCurrentUser ? 'text-right' : ''}`}>
              {!isFromCurrentUser && patient && (
                <p className="font-medium text-foreground text-sm mb-1">{patient.full_name}</p>
              )}
              {isFromCurrentUser && (
                <p className="font-medium text-foreground text-sm mb-1">You</p>
              )}
              <div
                className={`message-bubble text-sm ${
                  isFromCurrentUser
                    ? 'message-bubble-outgoing'
                    : 'message-bubble-incoming'
                }`}
              >
                {message.text}
              </div>
            </div>
            {isFromCurrentUser && (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
