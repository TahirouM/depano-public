import { Button, IconButton, Text, TextField, useTheme, useToast } from '@depano/ui';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Camera, Image as ImageIcon, Mic, Square, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { pickImage } from '@/lib/upload';

export const MAX_PROBLEM_PHOTOS = 4;

export interface ProblemDetailsValue {
  description?: string;
  photoUris?: string[];
  photoTypes?: string[];
  voiceUri?: string | null;
}

export interface ProblemDetailsProps {
  value: ProblemDetailsValue;
  onChange: (patch: ProblemDetailsValue) => void;
}

/**
 * Description libre + photos + message vocal (natif). Les fichiers restent locaux et sont
 * téléversés au moment de valider la demande (le compte n'est exigé qu'au paiement).
 */
export function ProblemDetails({ value, onChange }: ProblemDetailsProps) {
  const t = useTheme();
  const toast = useToast();
  const photos = value.photoUris ?? [];
  const types = value.photoTypes ?? [];
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);

  const addPhoto = async (source: 'camera' | 'library') => {
    if (photos.length >= MAX_PROBLEM_PHOTOS) return;
    const f = await pickImage(source);
    if (f) onChange({ photoUris: [...photos, f.uri], photoTypes: [...types, f.contentType] });
  };

  const removePhoto = (i: number) =>
    onChange({ photoUris: photos.filter((_, j) => j !== i), photoTypes: types.filter((_, j) => j !== i) });

  const startRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        toast.show("Micro non autorisé : décrivez le problème par écrit.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch {
      toast.error("L'enregistrement n'a pas pu démarrer.");
    }
  };
  const stopRecording = async () => {
    try {
      await recorder.stop();
    } finally {
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
    if (recorder.uri) onChange({ voiceUri: recorder.uri });
  };

  const seconds = Math.round((rec.durationMillis ?? 0) / 1000);
  return (
    <View style={{ gap: t.spacing.lg }}>
      <TextField
        label="Décrivez le problème (facultatif)"
        value={value.description ?? ''}
        onChangeText={(v) => onChange({ description: v })}
        multiline
        maxLength={2000}
        placeholder="Ex. : l'eau coule sous l'évier depuis ce matin"
        helper="Plus vous êtes précis, mieux l'artisan se prépare."
      />

      <View style={{ gap: t.spacing.sm }}>
        <Text variant="label">Photos ({photos.length}/{MAX_PROBLEM_PHOTOS})</Text>
        {photos.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {photos.map((uri, i) => (
              <View key={uri} style={{ width: 80, height: 80 }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: t.radius.sm }} accessibilityLabel={`Photo ${i + 1}`} />
                <View style={{ position: 'absolute', top: -12, right: -12 }}>
                  <IconButton icon={X} variant="filled" accessibilityLabel={`Retirer la photo ${i + 1}`} onPress={() => removePhoto(i)} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {photos.length < MAX_PROBLEM_PHOTOS ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {Platform.OS !== 'web' ? (
              <Button variant="secondary" size="md" icon={Camera} label="Prendre une photo" onPress={() => void addPhoto('camera')} style={{ flex: 1 }} />
            ) : null}
            <Button variant="secondary" size="md" icon={ImageIcon} label="Galerie" onPress={() => void addPhoto('library')} style={{ flex: 1 }} />
          </View>
        ) : null}
      </View>

      {Platform.OS !== 'web' ? (
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Message vocal</Text>
          {recording ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Text tone="urgent" variant="bodyStrong" accessibilityLiveRegion="polite">
                ● Enregistrement… {seconds} s
              </Text>
              <Button variant="secondary" icon={Square} label="Arrêter" onPress={() => void stopRecording()} />
            </View>
          ) : value.voiceUri ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Text style={{ flex: 1 }}>Message vocal enregistré</Text>
              <IconButton icon={Trash2} accessibilityLabel="Supprimer le message vocal" onPress={() => onChange({ voiceUri: null })} />
            </View>
          ) : (
            <Button variant="secondary" icon={Mic} label="Expliquer à l'oral" onPress={() => void startRecording()} />
          )}
        </View>
      ) : null}
    </View>
  );
}
