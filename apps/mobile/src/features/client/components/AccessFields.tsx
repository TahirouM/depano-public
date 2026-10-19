import { TextField, useTheme } from '@depano/ui';
import { View } from 'react-native';

export interface AccessValue {
  floor?: string | null;
  doorCode?: string | null;
  accessNotes?: string | null;
}

/** Étage, digicode, consignes d'accès : visibles par l'artisan après acceptation seulement. */
export function AccessFields({ value, onChange }: { value: AccessValue; onChange: (v: AccessValue) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.md }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="Étage" value={value.floor ?? ''} onChangeText={(v) => onChange({ floor: v || null })} maxLength={20} placeholder="3e" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Digicode"
            value={value.doorCode ?? ''}
            onChangeText={(v) => onChange({ doorCode: v || null })}
            maxLength={20}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="A1234"
          />
        </View>
      </View>
      <TextField
        label="Accès (facultatif)"
        value={value.accessNotes ?? ''}
        onChangeText={(v) => onChange({ accessNotes: v || null })}
        maxLength={500}
        multiline
        placeholder="Bâtiment B, interphone « Durand »…"
        helper="Communiqué à l'artisan uniquement une fois la demande acceptée."
      />
    </View>
  );
}
