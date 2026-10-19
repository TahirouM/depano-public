import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ErrorState, ListItem, Screen, SkeletonText, TextField, useTheme, useToast } from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Phone } from 'lucide-react-native';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Share, View } from 'react-native';
import { z } from 'zod';
import { formatPhone } from '@/features/auth/flow';
import { SettingsSection } from '@/features/settings/SettingsSection';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';

const Form = z.object({
  firstName: z.string().trim().min(1, 'Indiquez votre prénom').max(80),
  lastName: z.string().trim().min(1, 'Indiquez votre nom').max(80),
  email: z.union([z.literal(''), z.string().trim().email('Adresse e-mail invalide')]),
});
type Form = z.infer<typeof Form>;

/** Compte : prénom, nom, e-mail (factures), téléphone (lecture seule), export RGPD. */
export default function Account() {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const { control, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(Form), defaultValues: { firstName: '', lastName: '', email: '' } });

  useEffect(() => {
    if (me.data) reset({ firstName: me.data.firstName ?? '', lastName: me.data.lastName ?? '', email: me.data.email ?? '' });
  }, [me.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const updated = await api.me.update({ firstName: v.firstName, lastName: v.lastName, email: v.email || null });
      qc.setQueryData(qk.me, updated);
      toast.success('Modifications enregistrées');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const exportData = async () => {
    try {
      const data = await api.me.exportData();
      await Share.share({ title: 'Mes données DEPANO', message: JSON.stringify(data, null, 2) });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (me.isError && !me.data) return <ErrorState message={errorMessage(me.error)} onRetry={() => void me.refetch()} />;

  return (
    <Screen footer={<Button label="Enregistrer" onPress={onSubmit} loading={formState.isSubmitting} disabled={!formState.isDirty} fullWidth size="lg" />}>
      {!me.data ? (
        <SkeletonText lines={6} />
      ) : (
        <View style={{ gap: t.spacing.lg }}>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <TextField label="Prénom" autoComplete="given-name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <TextField label="Nom" autoComplete="family-name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField
                label="E-mail (facultatif)"
                helper="Pour recevoir vos factures."
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          <SettingsSection>
            <ListItem title="Numéro de mobile" subtitle={me.data.phone ? formatPhone(me.data.phone) : 'Non renseigné'} icon={Phone} />
            <ListItem title="Télécharger mes données" subtitle="Export RGPD" icon={Download} onPress={exportData} />
          </SettingsSection>
        </View>
      )}
    </Screen>
  );
}
