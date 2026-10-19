import { ListItem, Screen, Text, useTheme } from '@depano/ui';
import * as WebBrowser from 'expo-web-browser';
import { FileText, Gavel, ListOrdered, Lock, Scale } from 'lucide-react-native';
import { View } from 'react-native';
import { SettingsSection } from '@/features/settings/SettingsSection';

const LEGAL_BASE = 'https://depano.fr/legal';
const open = (path: string) => void WebBrowser.openBrowserAsync(`${LEGAL_BASE}/${path}`);

/** Documents légaux (CGU, CGV, confidentialité, médiation, classement des offres). */
export default function Legal() {
  const t = useTheme();
  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <SettingsSection>
          <ListItem title="Conditions générales d'utilisation" icon={FileText} onPress={() => open('cgu')} />
          <ListItem title="Conditions générales de vente" icon={FileText} onPress={() => open('cgv')} />
          <ListItem title="Politique de confidentialité" icon={Lock} onPress={() => open('confidentialite')} />
          <ListItem title="Comment sont classés les artisans" icon={ListOrdered} onPress={() => open('classement')} />
          <ListItem title="Médiateur de la consommation" icon={Gavel} onPress={() => open('mediation')} />
          <ListItem title="Mentions légales" icon={Scale} onPress={() => open('mentions')} />
        </SettingsSection>
        <Text variant="caption" tone="secondary">
          DEPANO met en relation particuliers et artisans vérifiés. Le paiement est sécurisé par notre prestataire agréé.
        </Text>
      </View>
    </Screen>
  );
}
