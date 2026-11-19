import { RULES } from '@depano/schemas';
import { Card, ListItem, Screen, SectionHeader, Text, useTheme } from '@depano/ui';
import { router, Stack } from 'expo-router';
import { ChevronDown, ChevronUp, FileText, Mail, Phone, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { features } from '@/lib/env';

/** Taux affiché aux artisans : seul endroit de l'espace pro où il apparaît (offre commerciale susceptible d'évoluer). */
const COMMISSION_PCT = Math.round(RULES.defaultCommissionRate * 100);

const FAQ: { q: string; a: string }[] = [
  features.urgent
    ? {
        q: 'Comment recevoir des urgences ?',
        a: `Activez « Disponible pour urgences » sur l'accueil. Chaque demande proche s'ouvre en plein écran : vous avez ${RULES.dispatch.offerTimeoutSeconds} secondes pour accepter. Le premier artisan qui accepte obtient l'intervention.`,
      }
    : {
        q: 'Comment recevoir des demandes ?',
        a: "Publiez vos horaires types (Profil > Disponibilités) et vos tarifs : les clients de votre zone réservent vos créneaux libres. Chaque demande arrive sur l'accueil, à accepter ou refuser.",
      },
  {
    q: 'Le devis est-il obligatoire ?',
    a: "Oui, dès le premier euro (arrêté du 24 janvier 2017). Faites-le dans l'app une fois sur place : le client le valide sur son téléphone avant que vous commenciez. Au-delà de +20 % du montant autorisé, le client valide un complément de paiement.",
  },
  {
    q: 'Quand suis-je payé ?',
    a: `Le paiement est capturé quand vous saisissez le code de fin à 4 chiffres donné par le client (${RULES.completionCode.maxAttempts} essais). Sans code, la capture est automatique après ${RULES.completionCode.autoCaptureAfterHours} h, sauf contestation. Le virement arrive sous 2 à 3 jours ouvrés.`,
  },
  {
    q: 'Quelle commission prend DEPANO ?',
    a: `${COMMISSION_PCT} % du montant encaissé, prélevés automatiquement au moment du paiement. Jamais de commission sur les frais de déplacement seuls. Ce taux correspond à l'offre en vigueur : vous êtes prévenu avant tout changement.`,
  },
  {
    q: 'Le client est absent ou refuse le devis',
    a: "Dans l'intervention, choisissez « Déplacement seulement » : seuls vos frais de déplacement sont facturés. Le support peut être saisi en cas de litige.",
  },
  {
    q: 'Puis-je annuler une intervention ?',
    a: `Oui, mais le client est alors reprogrammé en priorité et votre fiabilité baisse : ${RULES.artisanReliability.maxCancellationsIn30Days} annulations en 30 jours suspendent la réception ${features.urgent ? 'des urgences' : 'de nouvelles demandes'}.`,
  },
  {
    q: 'Mon assurance arrive à échéance',
    a: `Nous vous prévenons ${RULES.documentExpiryReminderDays} jours avant. Ajoutez la nouvelle attestation depuis l'inscription (étape justificatifs) pour rester visible.`,
  },
];

/** Aide artisan : FAQ métier, contact du support, médiation. */
export function HelpScreen() {
  const t = useTheme();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen inTabs>
      <Stack.Screen options={{ title: 'Aide' }} />
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Questions fréquentes" />
          {FAQ.map((f, i) => {
            const expanded = open === i;
            return (
              <Card key={f.q} padding="none">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpen(expanded ? null : i)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.md,
                    padding: t.spacing.lg,
                    minHeight: 56,
                  }}
                >
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {f.q}
                  </Text>
                  {expanded ? (
                    <ChevronUp size={20} color={t.colors.text.secondary} />
                  ) : (
                    <ChevronDown size={20} color={t.colors.text.secondary} />
                  )}
                </Pressable>
                {expanded ? (
                  <Text
                    tone="secondary"
                    style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg }}
                  >
                    {f.a}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </View>
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Nous contacter" />
          <Card padding="none">
            <ListItem
              title="Ligne artisans"
              subtitle="Du lundi au samedi, 8 h – 20 h"
              icon={Phone}
              onPress={() => void Linking.openURL('tel:+33491000000')}
            />
            <ListItem
              title="Écrire au support pro"
              subtitle="pro@depano.fr · réponse sous 24 h"
              icon={Mail}
              onPress={() => void Linking.openURL('mailto:pro@depano.fr')}
            />
            <ListItem
              title="Mentions légales et CGU"
              icon={FileText}
              onPress={() => router.push('/parametres/legal')}
            />
            <ListItem
              title="Médiation et litiges"
              subtitle="Le support tranche sous 72 h"
              icon={Scale}
              onPress={() => router.push('/parametres/legal')}
            />
          </Card>
        </View>
      </View>
    </Screen>
  );
}
