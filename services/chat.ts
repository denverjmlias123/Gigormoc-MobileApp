import { supabase } from '../lib/supabase';

let chatChannelSeq = 0;

export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  };
}

export interface ConversationSummary {
  id: string;
  application_id: string;
  gig_id: string;
  gig_title: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  last_message_content: string | null;
  last_message_created_at: string | null;
  last_message_sender_id: string | null;
  is_unread: boolean;
  updated_at: string;
}

export interface ConversationItem {
  id: string;
  application_id: string;
  client_id: string;
  freelancer_id: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  };
  freelancer?: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  };
}

export const chatService = {
  async getUserConversations(): Promise<ConversationSummary[]> {
    const { data, error } = await supabase.rpc('get_user_conversations');
    if (error) throw error;
    return (data || []) as ConversationSummary[];
  },

  async markConversationRead(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
    });
    if (error) throw error;
  },

  async getOrCreateConversation(params: {
    applicationId?: string;
    agreementId?: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_application_id: params.applicationId || null,
      p_agreement_id: params.agreementId || null,
    });

    if (error) throw error;
    return data as string;
  },

  async getConversation(conversationId: string): Promise<ConversationItem | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        application_id,
        client_id,
        freelancer_id,
        created_at,
        updated_at,
        client:profiles!conversations_client_id_fkey(id, display_name, avatar_path),
        freelancer:profiles!conversations_freelancer_id_fkey(id, display_name, avatar_path)
      `)
      .eq('id', conversationId)
      .maybeSingle();

    if (error || !data) return null;
    return data as any;
  },

  async getMessages(conversationId: string): Promise<MessageItem[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        sender:profiles(id, display_name, avatar_path)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as any[];
  },

  async sendMessage(conversationId: string, content: string): Promise<string> {
    const { data, error } = await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_content: content,
    });

    if (error) throw error;
    return data as string;
  },

  subscribeToMessages(
    conversationId: string,
    onMessage: (message: MessageItem) => void
  ) {
    chatChannelSeq += 1;
    const channelTopic = `conversation:${conversationId}-${Date.now()}-${chatChannelSeq}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_path')
            .eq('id', payload.new.sender_id)
            .maybeSingle();

          const newMsg: MessageItem = {
            id: payload.new.id,
            conversation_id: payload.new.conversation_id,
            sender_id: payload.new.sender_id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            sender: data || undefined,
          };
          onMessage(newMsg);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
