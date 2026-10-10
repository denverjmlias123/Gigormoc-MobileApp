import { supabase } from '../lib/supabase';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export const notificationsService = {
  async getNotifications(): Promise<NotificationItem[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data || []) as NotificationItem[];
  },

  async getUnreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) throw error;
    return count || 0;
  },

  async markAsRead(id: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('mark_notification_read', {
      p_id: id,
    });
    if (error) throw error;
    return Boolean(data);
  },

  async markAllAsRead(): Promise<number> {
    const { data, error } = await supabase.rpc('mark_all_notifications_read');
    if (error) throw error;
    return (data as number) || 0;
  },

  subscribeToNotifications(userId: string, onNotification: (item: NotificationItem) => void) {
    const channelTopic = `user-notifications:${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onNotification(payload.new as NotificationItem);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
