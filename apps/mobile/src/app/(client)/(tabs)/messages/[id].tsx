import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '@/features/chat/ChatScreen';

export default function ClientChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen conversationId={id} as="client" />;
}
