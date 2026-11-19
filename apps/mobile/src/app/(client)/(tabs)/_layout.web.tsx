import { Tabs } from 'expo-router/js-tabs';
import { CalendarDays, House, MessageCircle, User, Wrench, type LucideIcon } from 'lucide-react-native';
import { AppTabBar } from '@/components/AppTabBar';
import { CLIENT_TABS, type ClientTab } from '@/lib/clientTabs';
import { useBadges } from '@/lib/query/hooks';

const ICONS: Record<ClientTab['name'], LucideIcon> = {
  accueil: House,
  activite: CalendarDays,
  interventions: Wrench,
  messages: MessageCircle,
  profil: User,
};

/** Web : onglets client en tab bar JS (pas de tab bar système sur web). Natif : `_layout.tsx`. */
export default function ClientTabsLayout() {
  const badges = useBadges();
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} as="client" />} screenOptions={{ headerShown: false }}>
      {CLIENT_TABS.map((tab) => {
        const TabIcon = ICONS[tab.name];
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarIcon: ({ color }) => <TabIcon color={color} size={24} />,
              tabBarBadge: (tab.badge ? badges.data?.[tab.badge] : 0) || undefined,
              tabBarButtonTestID: tab.testID,
            }}
          />
        );
      })}
    </Tabs>
  );
}
