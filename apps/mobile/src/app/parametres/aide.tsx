import { Card, ListItem, Screen, Text, useTheme } from '@depano/ui';
import { Mail, MessageCircleQuestion } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { SettingsSection } from '@/features/settings/SettingsSection';

const FAQ = [
  { q: 'Quand suis-je débité ?', a: "Uniquement à la fin, quand vous donnez le code à 4 chiffres à l'artisan. Avant, c'est une simple empreinte bancaire." },
  { q: 'Puis-je annuler ?', a: "Oui, gratuitement jusqu'à 2 h avant un rendez-vous. Au-delà, des frais de déplacement peuvent s'appliquer, sauf garantie annulation." },
  { q: "L'artisan n'est jamais venu", a: "Ouvrez l'intervention, puis « Que s'est-il passé ? ». Le paiement est gelé et notre équipe tranche sous 72 h." },
];

/** Aide : questions fréquentes et contact du support. */
export default function Help() {
  const t = useTheme();
  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.md }}>
          {FAQ.map((f) => (
            <Card key={f.q} style={{ gap: t.spacing.xs }}>
              <Text variant="bodyStrong">{f.q}</Text>
              <Text tone="secondary">{f.a}</Text>
            </Card>
          ))}
        </View>
        <SettingsSection title="Nous contacter">
          <ListItem title="Écrire au support" subtitle="support@depano.fr · réponse sous 24 h" icon={Mail} onPress={() => void Linking.openURL('mailto:support@depano.fr')} />
          <ListItem title="Signaler un problème sur une intervention" subtitle="Depuis le détail de l'intervention" icon={MessageCircleQuestion} />
        </SettingsSection>
      </View>
    </Screen>
  );
}
