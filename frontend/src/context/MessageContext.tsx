import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { getDemoUser } from '@/lib/demoAuth';
import type { Message } from '@/types/api';

interface MessageContextType {
    messages: Message[];
    loading: boolean;
    sendMessage: (toUserId: string, text: string) => Promise<void>;
    markAsRead: (fromUserId: string) => Promise<void>;
    getConversation: (withUserId: string) => Message[];
    getUnreadCount: (userId: string) => number;
    refreshMessages: () => Promise<void>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { toast } = useToast();

    // Fetch messages from Supabase
    const fetchMessages = useCallback(async () => {
        const demoUser = getDemoUser();
        if (!demoUser) {
            setMessages([]);
            setLoading(false);
            return;
        }

        try {
            // Get all messages where user is sender or receiver
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`from_user.eq.${demoUser.id},to_user.eq.${demoUser.id}`)
                .order('created_at', { ascending: false })
                .limit(500);

            if (error) {
                console.error('[MessageContext] Fetch error:', error);
                // Fall back to empty array if table doesn't exist yet
                setMessages([]);
            } else {
                // Map to Message type
                const mapped: Message[] = (data || []).map((m: any) => ({
                    id: m.id,
                    from_user: m.from_user,
                    to_user: m.to_user,
                    text: m.text,
                    created_at: m.created_at,
                    read_at: m.read_at,
                }));
                setMessages(mapped);
            }
        } catch (e) {
            console.error('[MessageContext] Exception:', e);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchMessages();
    }, [fetchMessages, user]);

    // Set up real-time subscription for new messages
    useEffect(() => {
        const demoUser = getDemoUser();
        if (!demoUser) return;

        const channel = supabase
            .channel('messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    // No filter: listen to all and filter client-side for "OR" logic
                },
                (payload) => {
                    const newMsg = payload.new as any;
                    // Only add if relevant to current user (sender OR receiver)
                    if (newMsg.from_user === demoUser.id || newMsg.to_user === demoUser.id) {
                        const message: Message = {
                            id: newMsg.id,
                            from_user: newMsg.from_user,
                            to_user: newMsg.to_user,
                            text: newMsg.text,
                            created_at: newMsg.created_at,
                            read_at: newMsg.read_at,
                        };

                        setMessages(prev => {
                            // Avoid duplicates (if we sent it, we might have added it locally already)
                            if (prev.some(m => m.id === message.id)) return prev;
                            return [message, ...prev];
                        });

                        // Show toast if message is to current user
                        if (newMsg.to_user === demoUser.id) {
                            toast({
                                title: 'New Message',
                                description: newMsg.text.substring(0, 50) + (newMsg.text.length > 50 ? '...' : ''),
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [toast]);

    // Send message to Supabase
    const sendMessage = async (toUserId: string, text: string) => {
        const demoUser = getDemoUser();
        if (!demoUser || !text.trim()) return;

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    from_user: demoUser.id,
                    to_user: toUserId,
                    text: text.trim(),
                } as any)
                .select()
                .single();

            if (error) {
                console.error('[MessageContext] Send error:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to send message',
                    variant: 'destructive',
                });
                return;
            }

            // Add to local state immediately (real-time might also add it)
            if (data) {
                const newMessage: Message = {
                    id: data.id,
                    from_user: data.from_user,
                    to_user: data.to_user,
                    text: data.text,
                    created_at: data.created_at,
                    read_at: data.read_at,
                };

                // Avoid duplicates from real-time subscription
                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [newMessage, ...prev];
                });
            }
        } catch (e) {
            console.error('[MessageContext] Send exception:', e);
            toast({
                title: 'Error',
                description: 'Failed to send message',
                variant: 'destructive',
            });
        }
    };

    // Mark messages as read
    const markAsRead = async (fromUserId: string) => {
        const demoUser = getDemoUser();
        if (!demoUser) return;

        try {
            // Update in Supabase
            const { error } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() } as any)
                .eq('from_user', fromUserId)
                .eq('to_user', demoUser.id)
                .is('read_at', null);

            if (error) {
                console.error('[MessageContext] Mark read error:', error);
                return;
            }

            // Update local state
            setMessages(prev =>
                prev.map(msg => {
                    if (msg.from_user === fromUserId && msg.to_user === demoUser.id && !msg.read_at) {
                        return { ...msg, read_at: new Date().toISOString() };
                    }
                    return msg;
                })
            );
        } catch (e) {
            console.error('[MessageContext] Mark read exception:', e);
        }
    };

    // Get conversation with a specific user
    const getConversation = useCallback((withUserId: string): Message[] => {
        const demoUser = getDemoUser();
        if (!demoUser) return [];

        return messages
            .filter(
                msg =>
                    (msg.from_user === demoUser.id && msg.to_user === withUserId) ||
                    (msg.from_user === withUserId && msg.to_user === demoUser.id)
            )
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [messages]);

    // Get unread count from a specific user
    const getUnreadCount = useCallback((userId: string): number => {
        const demoUser = getDemoUser();
        if (!demoUser) return 0;

        return messages.filter(
            msg => msg.from_user === userId && msg.to_user === demoUser.id && !msg.read_at
        ).length;
    }, [messages]);

    const refreshMessages = async () => {
        setLoading(true);
        await fetchMessages();
    };

    return (
        <MessageContext.Provider
            value={{
                messages,
                loading,
                sendMessage,
                markAsRead,
                getConversation,
                getUnreadCount,
                refreshMessages,
            }}
        >
            {children}
        </MessageContext.Provider>
    );
}

export function useMessages() {
    const context = useContext(MessageContext);
    if (context === undefined) {
        throw new Error('useMessages must be used within a MessageProvider');
    }
    return context;
}
