import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMessages } from '@/context/MessageContext';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getDemoUser, getDoctorPatients, getPatientDoctor, DemoUser } from '@/lib/demoAuth';
import { MainLayout } from '@/components/layout/MainLayout';
import type { Message } from '@/types/api';

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

interface ConversationContact {
  id: string;
  name: string;
  role: 'doctor' | 'patient';
}

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { messages, loading: messagesLoading, sendMessage, getConversation, markAsRead } = useMessages();
  const [searchParams] = useSearchParams();
  const initialContactId = searchParams.get('patientId') || searchParams.get('doctorId') || searchParams.get('userId') || searchParams.get('contactId');

  const [selectedContactId, setSelectedContactId] = useState<string | null>(initialContactId);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<ConversationContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch contacts based on user role
  useEffect(() => {
    const fetchContacts = async () => {
      const demoUser = getDemoUser();
      if (!demoUser) {
        setContacts([]);
        setContactsLoading(false);
        return;
      }

      try {
        if (demoUser.role === 'doctor') {
          // Doctor sees their patients
          const patients = await getDoctorPatients(demoUser.id);
          setContacts(
            patients.map(p => ({
              id: p.id,
              name: p.name,
              role: 'patient' as const,
            }))
          );
        } else {
          // Patient sees their doctor
          const doctor = await getPatientDoctor(demoUser.id);
          if (doctor) {
            setContacts([
              {
                id: doctor.id,
                name: doctor.name,
                role: 'doctor',
              },
            ]);
          } else {
            setContacts([]);
          }
        }
      } catch (e) {
        console.error('[Messages] Error fetching contacts:', e);
        setContacts([]);
      } finally {
        setContactsLoading(false);
      }
    };

    fetchContacts();
  }, []);

  // Get conversation with selected contact (Oldest to Newest for display)
  const selectedConversation = useMemo(() => {
    return selectedContactId ? getConversation(selectedContactId).slice().reverse() : [];
  }, [selectedContactId, messages, getConversation]);

  // Mark as read when contact selected
  useEffect(() => {
    if (selectedContactId) {
      markAsRead(selectedContactId);
    }
  }, [selectedContactId, messages, markAsRead]);

  // Build conversation list with last message info
  const conversationList = useMemo(() => {
    const demoUser = getDemoUser();
    if (!demoUser) return [];

    return contacts.map(contact => {
      // Find last message with this contact
      const contactMessages = messages.filter(
        msg =>
          (msg.from_user === demoUser.id && msg.to_user === contact.id) ||
          (msg.from_user === contact.id && msg.to_user === demoUser.id)
      );

      const sortedMsgs = contactMessages.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sortedMsgs[0] || null;
      const unreadCount = contactMessages.filter(
        m => m.from_user === contact.id && m.to_user === demoUser.id && !m.read_at
      ).length;

      return {
        contact,
        lastMessage,
        unread: unreadCount > 0,
        lastMessageTime: lastMessage ? formatMessageTime(lastMessage.created_at) : '',
      };
    }).sort((a, b) => {
      // Sort: conversations with messages first, then by most recent
      if (a.lastMessage && b.lastMessage) {
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      }
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return a.contact.name.localeCompare(b.contact.name);
    });
  }, [contacts, messages]);

  // Filter by search
  const filteredConversations = conversationList.filter(conv =>
    conv.contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected contact
  const selectedContact = contacts.find(c => c.id === selectedContactId);

  // Auto-select first conversation if no selection and no URL param
  useEffect(() => {
    if (!selectedContactId && !initialContactId && filteredConversations.length > 0) {
      setSelectedContactId(filteredConversations[0].contact.id);
    } else if (initialContactId && !selectedContactId && filteredConversations.some(c => c.contact.id === initialContactId)) {
      // Check if the contact is actually in the list, if so select it (redundant if initialized via state, but good for updates)
      setSelectedContactId(initialContactId);
    }
  }, [filteredConversations, selectedContactId, initialContactId]);

  // Auto-scroll to bottom when new messages
  const prevMessageCount = useRef(selectedConversation.length);
  useEffect(() => {
    if (selectedConversation.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = selectedConversation.length;
  }, [selectedConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContactId || sending) return;

    setSending(true);
    await sendMessage(selectedContactId, newMessage.trim());
    setNewMessage('');
    setSending(false);
  };

  const demoUser = getDemoUser();

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
                placeholder={`Search ${demoUser?.role === 'doctor' ? 'patients' : 'doctors'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {contactsLoading || messagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? 'No conversations found' : 'No contacts yet'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.contact.id}
                  onClick={() => setSelectedContactId(conv.contact.id)}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${selectedContactId === conv.contact.id ? 'bg-secondary' : 'hover:bg-secondary/50'
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
                      <p className="font-medium text-foreground truncate">{conv.contact.name}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {conv.lastMessageTime}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage ? (
                        <>
                          {conv.lastMessage.from_user === demoUser?.id ? 'You: ' : ''}
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
          {selectedContactId && selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{selectedContact.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{selectedContact.role}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-6 space-y-4 pb-12">
                {selectedConversation.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  <>
                    {selectedConversation.map((msg, index, arr) => {
                      const prevMsg = index > 0 ? arr[index - 1] : null;
                      const showDate =
                        !prevMsg ||
                        formatMessageDate(msg.created_at) !== formatMessageDate(prevMsg.created_at);

                      const isFromCurrentUser = msg.from_user === demoUser?.id;

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

                          <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex gap-2 max-w-[85%] ${isFromCurrentUser ? 'flex-row-reverse' : ''}`}>
                              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                              </div>
                              <div className={`min-w-0 flex flex-col ${isFromCurrentUser ? 'items-end' : 'items-start'}`}>
                                <div
                                  className={`message-bubble ${isFromCurrentUser ? 'message-bubble-outgoing' : 'message-bubble-incoming'
                                    } w-fit max-w-full`}
                                >
                                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                </div>
                                <span className={`text-xs text-muted-foreground mt-1 block ${isFromCurrentUser ? 'text-right' : 'text-left'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
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
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e as any);
                        }
                      }}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={sending}
                    />
                  </div>
                  <Button type="submit" disabled={!newMessage.trim() || sending} className="w-12 h-12 p-0">
                    {sending ? (
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
