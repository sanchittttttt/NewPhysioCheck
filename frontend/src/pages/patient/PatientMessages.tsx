import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMessages } from '@/context/MessageContext';
import { Search, Send, ArrowLeft, Loader2, User, MessageSquare } from 'lucide-react';
import { PatientLayout } from '@/components/layout/PatientLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getPatientDoctor, DemoUser } from '@/lib/demoAuth';

export default function PatientMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { messages, sendMessage, getConversation, markAsRead } = useMessages();
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [doctor, setDoctor] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!user) return;
      try {
        const doc = await getPatientDoctor(user.id);
        setDoctor(doc);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctor();
  }, [user]);

  const doctorId = doctor?.id;

  const conversationView = useMemo(() => {
    return getConversation(doctorId);
  }, [doctorId, messages, getConversation]);

  // Mark as read when messages change
  useEffect(() => {
    markAsRead(doctorId);
  }, [messages, markAsRead, doctorId]);

  // Auto-scroll to bottom only when a new message is added
  const prevMessageCount = useRef(conversationView.length);
  useEffect(() => {
    if (conversationView.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = conversationView.length;
  }, [conversationView]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !doctorId) return;
    sendMessage(doctorId, newMessage.trim());
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const formatMessageTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatMessageDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <PatientLayout title="Messages" subtitle="Chat with your physiotherapist">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  if (!doctorId) {
    return (
      <PatientLayout title="Messages" subtitle="Chat with your physiotherapist">
        <div className="text-center py-12 space-y-4">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No doctor assigned yet.</p>
          <p className="text-sm text-muted-foreground">
            Once a protocol is assigned to you, you'll be able to message your doctor.
          </p>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout title="Messages" subtitle="Chat with your physiotherapist">
      <div className="flex h-[calc(100vh-180px)] md:h-[calc(100vh-180px)] gap-4 md:gap-6">
        {/* Left column - Conversation list */}
        <div
          className={`${showChat ? 'hidden md:flex' : 'flex'} w-full md:w-72 lg:w-80 flex-shrink-0 stat-card flex-col`}
        >
          <div className="relative mb-3 md:mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search..." className="pl-10 text-sm" disabled />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Single conversation - assigned doctor */}
            <button
              onClick={() => setShowChat(true)}
              className="w-full p-3 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer text-left hover:bg-primary/15 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-foreground text-sm md:text-base truncate">Your Doctor</h4>
                    {conversationView.length > 0 && (
                      <span className="text-[10px] md:text-xs text-muted-foreground flex-shrink-0">
                        {formatMessageTime(conversationView[0].created_at)}
                      </span>
                    )}
                  </div>
                  {conversationView.length > 0 && (
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {conversationView[0].from_user === user?.id ? 'You: ' : ''}
                      {conversationView[0].text}
                    </p>
                  )}
                  <span className="text-[10px] md:text-xs text-primary">Your Physiotherapist</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Right column - Active chat */}
        <div className={`${showChat ? 'flex' : 'hidden md:flex'} flex-1 stat-card flex-col`}>
          {/* Chat header */}
          <div className="flex items-center gap-3 pb-3 md:pb-4 border-b border-border">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden flex-shrink-0"
              onClick={() => setShowChat(false)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-foreground text-sm md:text-base truncate">Your Doctor</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">Physiotherapist</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin py-3 md:py-4 space-y-3 md:space-y-4 pb-8 md:pb-12">
            {conversationView.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              conversationView
                .slice()
                .reverse()
                .map((message, idx, arr) => {
                  const prevMsg = idx > 0 ? arr[idx - 1] : null;
                  const showDate =
                    !prevMsg || formatMessageDate(message.created_at) !== formatMessageDate(prevMsg.created_at);

                  const isFromCurrentUser = message.from_user === user?.id;

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex items-center gap-2 md:gap-4 my-3 md:my-4">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] md:text-xs text-muted-foreground">
                            {formatMessageDate(message.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}

                      <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`flex gap-2 max-w-[85%] md:max-w-[70%] ${isFromCurrentUser ? 'flex-row-reverse' : ''}`}
                        >
                          {!isFromCurrentUser && (
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <User className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                            </div>
                          )}
                          <div className={`min-w-0 flex flex-col ${isFromCurrentUser ? 'items-end' : 'items-start'}`}>
                            <div
                              className={`message-bubble ${isFromCurrentUser ? 'message-bubble-outgoing' : 'message-bubble-incoming'} w-fit max-w-full`}
                            >
                              <p className="text-xs md:text-sm break-words whitespace-pre-wrap">{message.text}</p>
                            </div>
                            <p
                              className={`text-[10px] md:text-xs text-muted-foreground mt-1 ${isFromCurrentUser ? 'text-right' : 'text-left'}`}
                            >
                              {formatMessageTime(message.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="pt-3 md:pt-4 border-t border-border">
            <form onSubmit={handleSendMessage} className="flex items-center gap-1 md:gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim()}
                className="flex-shrink-0 h-8 w-8 md:h-10 md:w-10"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}
