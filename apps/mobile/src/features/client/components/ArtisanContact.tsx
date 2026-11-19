import type { BookingDetailDto } from '@depano/schemas';
import { Avatar, Button, Card, StarRating, Text, useTheme, useToast } from '@depano/ui';
import { router } from 'expo-router';
import { MessageCircle, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';

const CALLABLE = ['accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'disputed'];
/** Statuts où la messagerie n'est pas encore ouverte (l'artisan n'a pas accepté la demande). */
const CHAT_PENDING = ['requested', 'pending_payment', 'searching'];

/**
 * Artisan assigné : photo, nom, note, appel via numéro relais (masqué) et chat. Tant que l'artisan n'a pas
 * accepté, le bouton Message est désactivé avec son explication (la messagerie s'ouvre à l'acceptation).
 */
export function ArtisanContact({ booking: b, subtitle }: { booking: BookingDetailDto; subtitle?: string | null }) {
  const t = useTheme();
  const toast = useToast();
  const [calling, setCalling] = useState(false);
  const a = b.artisan;
  if (!a) return null;

  const call = async () => {
    setCalling(true);
    try {
      const r = await api.bookings.callRelay(b.id);
      const url = `tel:${r.phoneNumber}`;
      // Web : ouvrir « tel: » quitte la page (et fige les gestes) ; on affiche le numéro relais.
      if (Platform.OS !== 'web' && (await Linking.canOpenURL(url).catch(() => false))) await Linking.openURL(url);
      else toast.show({ message: `Appelez le ${r.phoneNumber} (numéro relais, valable 2 h).`, duration: 8000 });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCalling(false);
    }
  };

  const canCall = CALLABLE.includes(b.status);
  const chatPending = !b.conversationId && CHAT_PENDING.includes(b.status);
  return (
    <Card style={{ gap: t.spacing.md }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Avatar name={a.displayName} uri={a.avatarUrl} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title2">{a.displayName}</Text>
          {a.ratingAvg != null ? <StarRating value={a.ratingAvg} /> : null}
          {subtitle ? (
            <Text variant="callout" tone="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {chatPending ? (
        <View style={{ gap: t.spacing.xs }}>
          <Button
            variant="secondary"
            icon={MessageCircle}
            label="Message"
            disabled
            accessibilityHint="Disponible dès que l'artisan accepte votre demande"
            testID="chat-artisan-disabled"
          />
          <Text variant="caption" tone="secondary">
            La messagerie s'ouvre dès que l'artisan accepte votre demande.
          </Text>
        </View>
      ) : null}
      {canCall || b.conversationId ? (
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {canCall ? (
            <Button
              variant="secondary"
              icon={Phone}
              label="Appeler"
              loading={calling}
              onPress={() => void call()}
              style={{ flex: 1 }}
              accessibilityHint="Numéro relais : votre numéro reste masqué"
              testID="call-artisan"
            />
          ) : null}
          {b.conversationId ? (
            <Button
              variant="secondary"
              icon={MessageCircle}
              label={b.unreadMessages ? `Écrire (${b.unreadMessages})` : 'Écrire'}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: b.conversationId! } })}
              style={{ flex: 1 }}
              testID="chat-artisan"
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
