import {
  QUALIFICATION_BADGES,
  type ArtisanDocumentDto,
  type DocumentType,
  type QualificationBadge,
} from '@depano/schemas';
import {
  Button,
  Chip,
  ProgressHeader,
  Screen,
  SectionHeader,
  SkeletonList,
  Text,
  useTheme,
} from '@depano/ui';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { DocumentUpload } from '../components/DocumentUpload';
import { useArtisanProfile } from '../queries';
import { KYC_TOTAL, nextStepHref, stepIndex } from './kyc';

export function latestDocs(
  docs: ArtisanDocumentDto[],
): Partial<Record<DocumentType, ArtisanDocumentDto>> {
  const m: Partial<Record<DocumentType, ArtisanDocumentDto>> = {};
  for (const d of [...docs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    if (!m[d.type]) m[d.type] = d;
  return m;
}

/** Étape 4 : pièce d'identité, assurance décennale / RC pro (avec échéance), qualifications. */
export function DocumentsStep() {
  const t = useTheme();
  const profile = useArtisanProfile();
  const [badge, setBadge] = useState<QualificationBadge>('RGE');
  const c = profile.data?.checklist;
  const ready = !!c && c.identity && c.insurance;

  return (
    <Screen
      footer={
        <Button
          label="Continuer"
          size="lg"
          fullWidth
          disabled={!ready}
          onPress={() => router.push(nextStepHref(c, 'documents'))}
          testID="docs-continue"
        />
      }
    >
      <Stack.Screen options={{ title: 'Justificatifs' }} />
      <View style={{ gap: t.spacing.lg }}>
        <ProgressHeader
          step={stepIndex('documents')}
          total={KYC_TOTAL}
          title="Ajoutez vos justificatifs"
          subtitle="Photo ou PDF. Ils ne sont jamais montrés aux clients."
        />
        <QueryView query={profile} loading={<SkeletonList count={3} />}>
          {(p) => {
            const docs = latestDocs(p.documents);
            const locked = p.status === 'pending_review';
            return (
              <View style={{ gap: t.spacing.lg }}>
                <DocumentUpload
                  type="identity"
                  title="Pièce d'identité"
                  description="Carte d'identité ou passeport en cours de validité, recto et verso."
                  current={docs.identity}
                  disabled={locked}
                />
                <SectionHeader title="Assurance (au moins une)" />
                <DocumentUpload
                  type="insurance_decennale"
                  title="Assurance décennale"
                  description="Attestation de l'année en cours, au nom de votre entreprise."
                  current={docs.insurance_decennale}
                  needsExpiry
                  disabled={locked}
                />
                <DocumentUpload
                  type="insurance_rc_pro"
                  title="RC professionnelle"
                  description="Attestation de responsabilité civile professionnelle."
                  current={docs.insurance_rc_pro}
                  needsExpiry
                  disabled={locked}
                />
                <SectionHeader title="Qualifications" />
                <Text variant="callout" tone="secondary">
                  Affichées en badge sur votre profil après vérification.
                </Text>
                <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
                  {QUALIFICATION_BADGES.map((b) => (
                    <Chip key={b} label={b} selected={badge === b} onPress={() => setBadge(b)} />
                  ))}
                </View>
                <DocumentUpload
                  key={badge}
                  type="qualification"
                  title={`Certificat ${badge}`}
                  description="Certificat de qualification en cours de validité."
                  current={p.documents.find((d) => d.type === 'qualification' && d.label === badge)}
                  label={badge}
                  needsExpiry
                  optional
                  disabled={locked}
                />
              </View>
            );
          }}
        </QueryView>
      </View>
    </Screen>
  );
}
