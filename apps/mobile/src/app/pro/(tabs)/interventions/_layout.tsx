import { TabStack } from '@/components/TabStack';

export const unstable_settings = { initialRouteName: 'index' };

export default function Layout() {
  return <TabStack rootTitle="Interventions" />;
}
