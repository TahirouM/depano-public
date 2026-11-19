import { Button, Text, TextField, useTheme, useToast } from '@depano/ui';
import { Lock, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { useArtisanNote } from '../queries';

/**
 * Note personnelle sur une intervention (« prévoir un robinet ») : privée, jamais montrée au client.
 * Même note dans le détail, le compte rendu et le planning.
 */
export function ArtisanNoteField({
  bookingId,
  note,
  label = 'Note personnelle',
}: {
  bookingId: string;
  note: string | null;
  label?: string;
}) {
  const t = useTheme();
  const toast = useToast();
  const save = useArtisanNote(bookingId);
  const [text, setText] = useState(note ?? '');
  // Note modifiée ailleurs (autre appareil, planning) : on reprend la valeur serveur si rien n'est en cours.
  useEffect(() => {
    if (!save.isPending) setText(note ?? '');
  }, [note]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = text.trim() !== (note ?? '').trim();
  return (
    <View style={{ gap: t.spacing.sm }} testID="artisan-note">
      <TextField
        label={label}
        value={text}
        onChangeText={setText}
        placeholder="Ex. prévoir un robinet, code portail 1234B"
        multiline
        maxLength={2000}
        helper="Visible par vous seul, jamais par le client."
        testID="artisan-note-input"
      />
      {dirty ? (
        <Button
          label="Enregistrer la note"
          icon={Save}
          variant="secondary"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          loading={save.isPending}
          onPress={() =>
            save.mutate(text.trim() || null, {
              onSuccess: () => toast.success('Note enregistrée.'),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
          testID="artisan-note-save"
        />
      ) : note ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <Lock size={14} color={t.colors.text.secondary} />
          <Text variant="caption" tone="secondary">
            Note enregistrée
          </Text>
        </View>
      ) : null}
    </View>
  );
}
