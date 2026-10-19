import type { FilePurpose } from '@depano/schemas';
import { Button, IconButton, Text, useTheme, useToast } from '@depano/ui';
import { Image } from 'expo-image';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { errorMessage, isNetworkError } from '@/lib/api';
import { pickImage, uploadFile } from '@/lib/upload';
import type { ReportPhoto } from '../mutations';

export interface PhotoGridProps {
  label: string;
  photos: ReportPhoto[];
  onChange: (photos: ReportPhoto[]) => void;
  purpose: FilePurpose;
  max?: number;
  testID?: string;
}

/**
 * Photos d'un formulaire : appareil photo ou galerie, téléversement immédiat ;
 * hors ligne, la photo reste locale et part avec la mutation (file d'attente).
 */
export function PhotoGrid({ label, photos, onChange, purpose, max = 6, testID }: PhotoGridProps) {
  const t = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const add = async (source: 'camera' | 'library') => {
    const file = await pickImage(source).catch(() => null);
    if (!file) return;
    const local: ReportPhoto = { uri: file.uri, contentType: file.contentType };
    const next = [...photos, local];
    onChange(next);
    setBusy(true);
    try {
      const up = await uploadFile(file, purpose);
      onChange(next.map((p) => (p.uri === local.uri ? { ...p, fileId: up.fileId } : p)));
    } catch (e) {
      if (!isNetworkError(e)) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const full = photos.length >= max;
  return (
    <View style={{ gap: t.spacing.sm }} testID={testID}>
      <Text variant="label">{label}</Text>
      {photos.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {photos.map((p, i) => (
            <View
              key={p.uri}
              style={{
                width: 96,
                height: 96,
                borderRadius: t.radius.md,
                overflow: 'hidden',
                backgroundColor: t.colors.background.subtle,
              }}
            >
              <Image
                source={{ uri: p.uri }}
                style={{ width: 96, height: 96 }}
                contentFit="cover"
                accessibilityLabel={`${label}, photo ${i + 1}`}
              />
              {!p.fileId && busy ? (
                <View
                  style={{
                    ...StyleSheet.absoluteFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: t.colors.background.scrim,
                  }}
                >
                  <ActivityIndicator color={t.colors.text.inverse} />
                </View>
              ) : null}
              <IconButton
                icon={X}
                variant="filled"
                accessibilityLabel={`Retirer la photo ${i + 1}`}
                onPress={() => onChange(photos.filter((x) => x.uri !== p.uri))}
                style={{ position: 'absolute', top: 0, right: 0 }}
              />
            </View>
          ))}
        </View>
      ) : null}
      {!full ? (
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {Platform.OS !== 'web' ? (
            <Button
              label="Prendre une photo"
              icon={Camera}
              variant="secondary"
              onPress={() => void add('camera')}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            label={Platform.OS === 'web' ? 'Ajouter une photo' : 'Galerie'}
            icon={ImagePlus}
            variant="secondary"
            onPress={() => void add('library')}
            style={{ flex: 1 }}
            testID={testID ? `${testID}-add` : undefined}
          />
        </View>
      ) : (
        <Text variant="caption" tone="secondary">
          {max} photos maximum.
        </Text>
      )}
    </View>
  );
}
