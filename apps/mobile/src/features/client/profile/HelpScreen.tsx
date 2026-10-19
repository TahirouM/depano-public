import { Card, Divider, ListItem, Screen, SectionHeader, Text, useTheme } from '@depano/ui';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronDown, ChevronUp, FileText, Gavel, ListOrdered, Mail, MessageCircleQuestion } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

const FAQ = [
  { q: 'Quand suis-je débité ?', a: "Uniquement à la fin, quand vous donnez le code à 4 chiffres à l'artisan. Avant, c'est une simple empreinte bancaire : rien n'est prélevé." },
  { q: 'Le prix peut-il changer ?', a: "L'artisan établit un devis détaillé sur place, que vous validez dans l'app avant tout travail. Au-delà de 20 % du montant annoncé, une nouvelle validation est obligatoire." },
  { q: 'Puis-je annuler ?', a: "Oui, gratuitement jusqu'à 2 h avant un rendez-vous et pendant la recherche d'un artisan. Ensuite, seuls les frais de déplacement sont dus, sauf garantie annulation (10 €) ou retard de l'artisan de plus de 30 min." },
  { q: "L'artisan n'est jamais venu", a: "Ouvrez l'intervention puis « Que s'est-il passé ? ». Le paiement est gelé et notre équipe tranche sous 72 h." },
  { q: 'Les artisans sont-ils vérifiés ?', a: 'Oui : SIRET actif, pièce d’identité et assurance contrôlés par notre équipe avant toute mise en ligne, puis suivi de la fiabilité.' },
  { q: 'Droit de rétractation', a: "Pour une urgence demandée expressément, il ne s'applique pas (réparation urgente à domicile). Pour un rendez-vous planifié, vous disposez de 14 jours." },
];

/** Aide client : FAQ, contact, médiateur de la consommation, classement des artisans. */
export function HelpScreen() {
  const t = useTheme();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen inTabs>
      <Stack.Screen options={{ title: 'Aide' }} />
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Questions fréquentes" />
          <Card padding="none">
            {FAQ.map((f, i) => {
              const expanded = open === i;
              return (
                <View key={f.q}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <Pressable
                    onPress={() => setOpen(expanded ? null : i)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={{ padding: t.spacing.lg, minHeight: 56, gap: t.spacing.sm }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {f.q}
                      </Text>
                      {expanded ? <ChevronUp size={20} color={t.colors.text.secondary} /> : <ChevronDown size={20} color={t.colors.text.secondary} />}
                    </View>
                    {expanded ? <Text tone="secondary">{f.a}</Text> : null}
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </View>
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Nous contacter" />
          <Card padding="none">
            <ListItem title="Écrire au support" subtitle="support@depano.fr · réponse sous 24 h" icon={Mail} onPress={() => void Linking.openURL('mailto:support@depano.fr')} />
            <Divider inset={56} />
            <ListItem title="Un problème sur une intervention ?" subtitle="Ouvrez-la puis « Que s'est-il passé ? »" icon={MessageCircleQuestion} onPress={() => router.push('/activite')} />
          </Card>
        </View>
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Transparence" />
          <Card padding="none">
            <ListItem title="Comment sont classés les artisans" icon={ListOrdered} onPress={() => router.push('/profil/classement')} testID="open-ranking" />
            <Divider inset={56} />
            <ListItem
              title="Médiateur de la consommation"
              subtitle="Recours gratuit en cas de litige non résolu"
              icon={Gavel}
              onPress={() => void WebBrowser.openBrowserAsync('https://depano.fr/legal/mediation')}
              testID="open-mediator"
            />
            <Divider inset={56} />
            <ListItem title="Conditions générales de vente" icon={FileText} onPress={() => void WebBrowser.openBrowserAsync('https://depano.fr/legal/cgv')} />
          </Card>
          <Text variant="caption" tone="secondary">
            En cas de litige non résolu avec notre service client, vous pouvez saisir gratuitement le médiateur de la consommation dont les coordonnées figurent dans nos CGV, ou la plateforme européenne de règlement en ligne des litiges.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
