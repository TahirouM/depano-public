import { Tabs } from 'expo-router/js-tabs';
import { ClipboardList, House, MessageCircle, Search, User } from 'lucide-react-native';
import { AppTabBar } from '@/components/AppTabBar';
import { useBadges } from '@/lib/query/hooks';

/** Web : onglets client en tab bar JS (pas de tab bar système sur web). Natif : `_layout.tsx`. */
export default function ClientTabsLayout() {
  const badges = useBadges();
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} as="client" />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="accueil" options={{ title: 'Accueil', tabBarIcon: ({ color }) => <House color={color} size={24} />, tabBarButtonTestID: 'tab-accueil' }} />
      <Tabs.Screen name="recherche" options={{ title: 'Recherche', tabBarIcon: ({ color }) => <Search color={color} size={24} />, tabBarButtonTestID: 'tab-recherche' }} />
      <Tabs.Screen
        name="activite"
        options={{ title: 'Activité', tabBarIcon: ({ color }) => <ClipboardList color={color} size={24} />, tabBarBadge: badges.data?.activity || undefined, tabBarButtonTestID: 'tab-activite' }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} />, tabBarBadge: badges.data?.messages || undefined, tabBarButtonTestID: 'tab-messages' }}
      />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: ({ color }) => <User color={color} size={24} />, tabBarButtonTestID: 'tab-profil' }} />
    </Tabs>
  );
}
