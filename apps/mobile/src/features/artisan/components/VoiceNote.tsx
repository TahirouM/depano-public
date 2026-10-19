import { Button, Card, haptic, Text, useTheme, useToast } from '@depano/ui';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import type { ReportPhoto } from '../mutations';

export interface VoiceNoteProps {
  value: (ReportPhoto & { durationMs?: number }) | null | undefined;
  onChange: (v: (ReportPhoto & { durationMs?: number }) | null) => void;
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Note vocale du compte rendu (artisan les mains occupées) : un gros bouton pour
 * enregistrer, réécoute, suppression. Le fichier part avec le compte rendu.
 */
export function VoiceNote({ value, onChange }: VoiceNoteProps) {
  if (Platform.OS === 'web') {
    return (
      <Card variant="flat" style={{ gap: 4 }}>
        <Text variant="label">Note vocale</Text>
        <Text variant="callout" tone="secondary">
          Disponible dans l'application mobile. Ici, utilisez la dictée du clavier dans le champ «
          Note ».
        </Text>
      </Card>
    );
  }
  return <NativeVoiceNote value={value} onChange={onChange} />;
}

function NativeVoiceNote({ value, onChange }: VoiceNoteProps) {
  const t = useTheme();
  const toast = useToast();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false);
  const player = useAudioPlayer(value?.uri ? { uri: value.uri } : null);
  const status = useAudioPlayerStatus(player);

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        toast.show({
          message: 'Autorisez le micro dans les réglages pour enregistrer une note vocale.',
          type: 'info',
        });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      haptic('medium');
    } catch {
      toast.error("Impossible de démarrer l'enregistrement.");
    }
  };

  const stop = async () => {
    const durationMs = rec.durationMillis;
    try {
      await recorder.stop();
    } finally {
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
        () => undefined,
      );
    }
    if (recorder.uri) {
      haptic('success');
      onChange({ uri: recorder.uri, contentType: 'audio/m4a', durationMs });
    }
  };

  return (
    <Card variant="flat" style={{ gap: t.spacing.md }}>
      <Text variant="label">Note vocale</Text>
      {recording ? (
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title2" tone="urgent" accessibilityLiveRegion="polite">
            ● Enregistrement… {fmt(rec.durationMillis)}
          </Text>
          <Button
            label="Arrêter l'enregistrement"
            icon={Square}
            size="lg"
            variant="danger"
            fullWidth
            onPress={() => void stop()}
          />
        </View>
      ) : value ? (
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="callout" tone="secondary">
            Note enregistrée{value.durationMs ? ` · ${fmt(value.durationMs)}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button
              label={status.playing ? 'Pause' : 'Réécouter'}
              icon={status.playing ? Pause : Play}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                if (status.playing) player.pause();
                else {
                  if (
                    status.didJustFinish ||
                    (status.duration && status.currentTime >= status.duration)
                  )
                    void player.seekTo(0);
                  player.play();
                }
              }}
            />
            <Button
              label="Supprimer"
              icon={Trash2}
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => onChange(null)}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Enregistrer une note vocale"
          icon={Mic}
          size="lg"
          variant="secondary"
          fullWidth
          onPress={() => void start()}
        />
      )}
    </Card>
  );
}
