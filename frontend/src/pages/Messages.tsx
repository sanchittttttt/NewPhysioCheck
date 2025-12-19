import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { messageService } from '@/lib/services/messageService';
import { patientService } from '@/lib/services/patientService';
import { useAuth } from '@/context/AuthContext';
import { Search, Send, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Message, Patient } from '@/types/api';

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const formatMessageDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString();
};


const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get all messages to build conversation list
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', 'all'],
    queryFn: () => messageService.getAll({ limit: 200 }),
  });

  // Get patients for conversation list
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'for-messages'],
    queryFn: () => patientService.getAll({ limit: 100 }),
  });

  // Get conversation with selected patient
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['messages', 'conversation', selectedPatientId],
    queryFn: () =>
      selectedPatientId
        ? messageService.getAll({ conversation_with: selectedPatientId, limit: 100 })
        : Promise.resolve({ data: [], total: 0 }),
    enabled: !!selectedPatientId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (text: string) => {
      if (!selectedPatientId) throw new Error('No patient selected');
      return messageService.send({ to_user: selectedPatientId, text });
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast({
        title: 'Message sent',
        description: 'Your message has been sent successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  // Build conversation list from messages and patients
  const conversations = React.useMemo(() => {
    if (!patientsData?.data || patientsLoading) return [];

    const patients = patientsData.data || [];
    const messages = messagesData?.data || [];

    // Group messages by other user (patient)
    const conversationMap = new Map<string, { lastMessage: Message; unread: boolean }>();

    messages.forEach((msg) => {
      // For doctor, get messages where doctor is sender or receiver
      const otherUserId = msg.from_user === user?.id ? msg.to_user : msg.from_user;
      const existing = conversationMap.get(otherUserId);

      if (!existing || new Date(msg.created_at) > new Date(existing.lastMessage.created_at)) {
        conversationMap.set(otherUserId, {
          lastMessage: msg,
          unread: msg.from_user !== user?.id && !msg.read_at,
        });
      }
    });

    // Create conversation entries for all patients (with messages if they exist)
    const conversationList = patients.map((patient) => {
      const conversationData = conversationMap.get(patient.id);

      if (conversationData) {
        // Patient has messages
        return {
          patientId: patient.id,
          patient,
          lastMessage: conversationData.lastMessage,
          unread: conversationData.unread,
          lastMessageTime: formatMessageTime(conversationData.lastMessage.created_at),
        };
      } else {
        // Patient has no messages yet
        return {
          patientId: patient.id,
          patient,
          lastMessage: null,
          unread: false,
          lastMessageTime: '',
        };
      }
    });

    // Sort: conversations with messages first (by most recent), then patients without messages
    return conversationList.sort((a, b) => {
      if (a.lastMessage && b.lastMessage) {
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      }
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return a.patient.full_name.localeCompare(b.patient.full_name);
    });
  }, [messagesData, patientsData, user?.id]);

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv) =>
    conv.patient.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected conversation data
  const selectedConversation = conversationData?.data || [];
  const selectedPatient = filteredConversations.find((c) => c.patientId === selectedPatientId)?.patient;

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedPatientId && filteredConversations.length > 0) {
      setSelectedPatientId(filteredConversations[0].patientId);
    }
  }, [filteredConversations, selectedPatientId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedPatientId) return;
    sendMessageMutation.mutate(newMessage.trim());
  };



  return (
    <MainLayout title="Messages">
      <div className="flex gap-0 animate-fade-in h-[calc(100vh-10rem)]">
        {/* Conversations List */}
        <div className="w-96 border-r border-border flex flex-col">
          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {messagesLoading || patientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !patientsData?.data || patientsData.data.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>No patients found.</p>
                <p className="text-xs mt-2">Create a patient to start messaging.</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? 'No conversations found' : 'No conversations yet'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.patientId}
                  onClick={() => setSelectedPatientId(conv.patientId)}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${selectedPatientId === conv.patientId ? 'bg-secondary' : 'hover:bg-secondary/50'
                    }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    {conv.unread && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-foreground truncate">{conv.patient.full_name}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {conv.lastMessageTime}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage ? (
                        <>
                          {conv.lastMessage.from_user === user?.id ? 'You: ' : ''}
                          {conv.lastMessage.text}
                        </>
                      ) : (
                        'No messages yet'
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedPatientId && selectedPatient ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{selectedPatient.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedPatient.condition || 'Patient'}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
                {conversationLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : selectedConversation.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  <>
                    {selectedConversation
                      .slice()
                      .reverse()
                      .map((msg, index, arr) => {
                        const prevMsg = index > 0 ? arr[index - 1] : null;
                        const showDate =
                          !prevMsg ||
                          formatMessageDate(msg.created_at) !== formatMessageDate(prevMsg.created_at);

                        const isFromCurrentUser = msg.from_user === user?.id;

                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground">
                                  {formatMessageDate(msg.created_at)}
                                </span>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                            )}

                            <div
                              className={`flex items-end gap-3 ${isFromCurrentUser ? 'flex-row-reverse' : ''}`}
                            >
                              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div className={isFromCurrentUser ? 'text-right' : ''}>
                                <div
                                  className={`message-bubble ${isFromCurrentUser
                                      ? 'message-bubble-outgoing'
                                      : 'message-bubble-incoming'
                                    }`}
                                >
                                  {msg.text}
                                </div>
                                <span className="text-xs text-muted-foreground mt-1 block">
                                  {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border">
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Type your message here..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="w-12 h-12 p-0"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Messages;
