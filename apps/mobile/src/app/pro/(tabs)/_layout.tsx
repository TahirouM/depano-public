import { Tabs } from 'expo-router/js-tabs';
import { CalendarDays, House, MessageCircle, User, Wrench } from 'lucide-react-native';
import { AppTabBar } from '@/components/AppTabBar';
import { useBadges } from '@/lib/query/hooks';

/** Onglets artisan : Accueil, Planning, Interventions, Messages, Profil. */
export default function ArtisanTabsLayout() {
  const badges = useBadges();
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} as="artisan" />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="accueil" options={{ title: 'Accueil', tabBarIcon: ({ color }) => <House color={color} size={24} />, tabBarButtonTestID: 'tab-pro-accueil' }} />
      <Tabs.Screen name="planning" options={{ title: 'Planning', tabBarIcon: ({ color }) => <CalendarDays color={color} size={24} />, tabBarButtonTestID: 'tab-pro-planning' }} />
      <Tabs.Screen
        name="interventions"
        options={{ title: 'Interventions', tabBarIcon: ({ color }) => <Wrench color={color} size={24} />, tabBarBadge: badges.data?.activity || undefined, tabBarButtonTestID: 'tab-pro-interventions' }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} />, tabBarBadge: badges.data?.messages || undefined, tabBarButtonTestID: 'tab-pro-messages' }}
      />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: ({ color }) => <User color={color} size={24} />, tabBarButtonTestID: 'tab-pro-profil' }} />
    </Tabs>
  );
}
