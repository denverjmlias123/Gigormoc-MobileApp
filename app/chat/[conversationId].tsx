import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { chatService, MessageItem, ConversationItem } from '../../services/chat';
import { applicationsService } from '../../services/applications';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';
import { strings } from '../../constants/strings';

export default function ChatScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { conversationId, partnerName } = useLocalSearchParams<{
    conversationId: string;
    partnerName: string;
  }>();
  const { user } = useAuth();

  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [linkedAgreementId, setLinkedAgreementId] = useState<string | null>(null);
  const [linkedGigId, setLinkedGigId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!conversationId) return;

    let unsubscribe: (() => void) | undefined;

    const loadChat = async () => {
      setLoading(true);
      setError(null);
      try {
        const [convData, msgList, convSummaries, myAgreements] = await Promise.all([
          chatService.getConversation(conversationId),
          chatService.getMessages(conversationId),
          chatService.getUserConversations().catch(() => []),
          applicationsService.getMyAgreements().catch(() => []),
        ]);
        setConversation(convData);
        setMessages(msgList);

        const matchingSummary = convSummaries.find((s) => s.id === conversationId);
        const gigId = matchingSummary?.gig_id || null;
        setLinkedGigId(gigId);

        if (gigId) {
          const matchingAgr = myAgreements.find((a) => a.gig_id === gigId);
          setLinkedAgreementId(matchingAgr?.id || null);
        }

        // Mark conversation read
        chatService.markConversationRead(conversationId).catch(() => {});

        // Subscribe to real-time incoming messages
        unsubscribe = chatService.subscribeToMessages(conversationId, (newMsg: MessageItem) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          chatService.markConversationRead(conversationId).catch(() => {});
        });
      } catch (err: any) {
        setError(err?.message || 'Could not load conversation.');
      } finally {
        setLoading(false);
      }
    };

    loadChat();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [conversationId]);

  const handleGoToStage = () => {
    if (linkedAgreementId) {
      router.push({ pathname: '/agreements/[id]', params: { id: linkedAgreementId } });
      return;
    }
    if (linkedGigId) {
      if (user?.id === conversation?.client_id) {
        router.push({ pathname: '/gigs/[id]/applicants', params: { id: linkedGigId } });
      } else {
        router.push({ pathname: '/gigs/[id]', params: { id: linkedGigId } });
      }
      return;
    }
    router.push('/(tabs)/activity');
  };

  const sendingRef = useRef(false);

  const handleSend = async () => {
    if (sendingRef.current || sending || !inputText.trim() || !conversationId) return;

    sendingRef.current = true;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await chatService.sendMessage(conversationId, textToSend);
      showToast(strings.toasts.messageSent);
    } catch (err: any) {
      showToast(err?.message || 'Failed to send message.', 'error');
      setInputText(textToSend); // restore on error
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const partnerTitle =
    partnerName ||
    (user?.id === conversation?.client_id
      ? conversation?.freelancer?.display_name
      : conversation?.client?.display_name) ||
    'Chat';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/messages');
            }
          }}
          style={styles.backButton}
        >
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          {partnerTitle}
        </Text>
        <TouchableOpacity
          onPress={handleGoToStage}
          style={[styles.backButton, { backgroundColor: theme.colors.primarySoft, borderRadius: 8 }]}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' }}>
            {strings.loop.viewStageBtn}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          <Button
            title="Go Back"
            variant="secondary"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/messages');
              }
            }}
          />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.sender_id === user?.id;
            return (
              <View
                style={[
                  styles.messageBubbleWrapper,
                  isMe ? styles.myMessageWrapper : styles.theirMessageWrapper,
                ]}
              >
                {!isMe && item.sender?.display_name && (
                  <Text style={[styles.senderLabel, { color: theme.colors.muted }]}>
                    {item.sender.display_name}
                  </Text>
                )}
                <View
                  style={[
                    styles.bubble,
                    isMe
                      ? [styles.myBubble, { backgroundColor: theme.colors.primary }]
                      : [
                          styles.theirBubble,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                          },
                        ],
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      { color: isMe ? '#ffffff' : theme.colors.text },
                    ]}
                  >
                    {item.content}
                  </Text>
                  <Text
                    style={[
                      styles.timestamp,
                      { color: isMe ? '#e0e7ff' : theme.colors.muted },
                    ]}
                  >
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                No messages yet. Send a message to start communicating.
              </Text>
            </View>
          }
        />
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <TextInput
          style={[
            styles.inputField,
            { borderColor: theme.colors.border, color: theme.colors.text },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                !inputText.trim() || sending ? theme.colors.muted : theme.colors.primary,
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.sendBtnText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  messageBubbleWrapper: {
    maxWidth: '80%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
  },
  theirMessageWrapper: {
    alignSelf: 'flex-start',
  },
  senderLabel: {
    fontSize: 11,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  inputField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
