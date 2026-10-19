import type { ArtisanDocumentDto, DocumentType } from '@depano/schemas';
import { Badge, BottomSheet, Button, Card, Text, TextField, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Camera, FileText, ImagePlus, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { pickImage, uploadFile, type LocalFile } from '@/lib/upload';
import { parseFrDate } from '../format';

export { parseFrDate };

const DOC_STATUS: Record<
  ArtisanDocumentDto['status'],
  { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }
> = {
  pending: { label: 'En vérification', tone: 'warning' },
  approved: { label: 'Validé', tone: 'success' },
  rejected: { label: 'Refusé', tone: 'danger' },
  expired: { label: 'Expiré', tone: 'danger' },
};

const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
};

const isoToFr = (iso: string) => iso.split('-').reverse().join('/');

async function pickPdfOrImage(): Promise<LocalFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  const type =
    a.mimeType && /^(application\/pdf|image\/(jpeg|png|webp|heic))$/.test(a.mimeType)
      ? a.mimeType
      : a.name?.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'image/jpeg';
  return { uri: a.uri, contentType: type, sizeBytes: a.size ?? undefined };
}

export interface DocumentUploadProps {
  type: DocumentType;
  title: string;
  description: string;
  current: ArtisanDocumentDto | undefined;
  /** Assurance : date d'expiration obligatoire. */
  needsExpiry?: boolean;
  /** Libellé du document (ex. badge de qualification). */
  label?: string;
  optional?: boolean;
  disabled?: boolean;
}

/** Carte d'un justificatif : statut, motif de refus, ajout par appareil photo / galerie / fichier. */
export function DocumentUpload({
  type,
  title,
  description,
  current,
  needsExpiry,
  label,
  optional,
  disabled,
}: DocumentUploadProps) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState(false);
  const [expiry, setExpiry] = useState(current?.expiresAt ? isoToFr(current.expiresAt) : '');
  const [expiryErr, setExpiryErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: LocalFile) => {
      const up = await uploadFile(file, 'document');
      return api.artisan.addDocument({
        type,
        fileId: up.fileId,
        expiresAt: needsExpiry ? parseFrDate(expiry)! : undefined,
        label,
      });
    },
    onSuccess: () => {
      toast.success('Document envoyé.');
      void qc.invalidateQueries({ queryKey: qk.artisan.profile });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const start = async (source: 'camera' | 'library' | 'file') => {
    setSheet(false);
    const file =
      source === 'file'
        ? await pickPdfOrImage().catch(() => null)
        : await pickImage(source).catch(() => null);
    if (file) upload.mutate(file);
  };

  const onAdd = () => {
    if (needsExpiry) {
      const iso = parseFrDate(expiry);
      if (!iso) return setExpiryErr('Indiquez la date de fin de validité (JJ/MM/AAAA).');
      if (iso <= new Date().toISOString().slice(0, 10))
        return setExpiryErr(
          'Cette attestation est expirée : ajoutez une attestation en cours de validité.',
        );
      setExpiryErr(null);
    }
    setSheet(true);
  };

  const st = current ? DOC_STATUS[current.status] : null;
  const ok = current && (current.status === 'pending' || current.status === 'approved');
  return (
    <Card style={{ gap: t.spacing.md }} testID={`doc-${type}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <FileText size={22} color={t.colors.text.brand} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {title}
          {optional ? (
            <Text variant="callout" tone="secondary">
              {' '}
              (facultatif)
            </Text>
          ) : null}
        </Text>
        {st ? <Badge label={st.label} tone={st.tone} /> : null}
      </View>
      <Text variant="callout" tone="secondary">
        {description}
      </Text>
      {current?.expiresAt ? (
        <Text variant="caption" tone="secondary">
          Valable jusqu'au {isoToFr(current.expiresAt)}
        </Text>
      ) : null}
      {current?.status === 'rejected' && current.rejectionReason ? (
        <Text variant="callout" tone="danger">
          Motif : {current.rejectionReason}
        </Text>
      ) : null}
      {needsExpiry && !ok ? (
        <TextField
          label="Date de fin de validité"
          placeholder="JJ/MM/AAAA"
          value={expiry}
          onChangeText={(v) => {
            setExpiry(maskDate(v));
            setExpiryErr(null);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          error={expiryErr}
          helper="Nous vous rappellerons 30 jours avant l'échéance."
          testID={`doc-${type}-expiry`}
        />
      ) : null}
      <Button
        label={ok ? 'Remplacer le document' : 'Ajouter le document'}
        icon={Upload}
        variant={ok ? 'ghost' : 'secondary'}
        loading={upload.isPending}
        disabled={disabled}
        onPress={onAdd}
        testID={`doc-${type}-add`}
      />
      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={title}
        description="Photo nette, document entier et lisible."
      >
        <View style={{ gap: t.spacing.sm }}>
          {Platform.OS !== 'web' ? (
            <Button
              label="Prendre une photo"
              icon={Camera}
              size="lg"
              fullWidth
              onPress={() => void start('camera')}
            />
          ) : null}
          <Button
            label="Choisir une photo"
            icon={ImagePlus}
            size="lg"
            variant="secondary"
            fullWidth
            onPress={() => void start('library')}
            testID={`doc-${type}-library`}
          />
          <Button
            label="Choisir un fichier (PDF)"
            icon={FileText}
            size="lg"
            variant="secondary"
            fullWidth
            onPress={() => void start('file')}
            testID={`doc-${type}-file`}
          />
        </View>
      </BottomSheet>
    </Card>
  );
}
