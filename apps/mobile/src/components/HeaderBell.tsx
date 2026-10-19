import { IconButton } from '@depano/ui';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useBadges } from '@/lib/query/hooks';

/** Cloche des notifications (dans l'en-tête, pas dans la tab bar), avec badge. */
export function HeaderBell() {
  const badges = useBadges();
  return (
    <IconButton
      icon={Bell}
      accessibilityLabel="Notifications"
      badge={badges.data?.notifications}
      onPress={() => router.push('/notifications')}
      testID="header-bell"
    />
  );
}
