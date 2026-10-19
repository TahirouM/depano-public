import { zodResolver } from '@hookform/resolvers/zod';
import type { Me } from '@depano/schemas';
import { Button, Screen, Text, TextField, useTheme } from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { finishAuthFlow } from '@/lib/session';

const Form = z.object({
  firstName: z.string().trim().min(1, 'Indiquez votre prénom').max(80),
  lastName: z.string().trim().min(1, 'Indiquez votre nom').max(80),
});
type Form = z.infer<typeof Form>;

/** Prénom et nom : la seule information demandée à l'inscription. */
export default function Identite() {
  const t = useTheme();
  const qc = useQueryClient();
  const { nouveau } = useLocalSearchParams<{ nouveau?: string }>();
  const me = qc.getQueryData<Me>(qk.me);
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(Form),
    defaultValues: { firstName: me?.firstName ?? '', lastName: me?.lastName ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const updated = await api.me.update(values);
      qc.setQueryData(qk.me, updated);
      if (nouveau) router.replace('/role');
      else finishAuthFlow();
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <Screen footer={<Button label="Continuer" onPress={onSubmit} loading={formState.isSubmitting} size="lg" fullWidth />}>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title1">Comment vous appelez-vous ?</Text>
          <Text tone="secondary">L'artisan saura qui l'accueille. Rien d'autre ne vous sera demandé.</Text>
        </View>
        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <TextField
              label="Prénom"
              autoFocus
              autoComplete="given-name"
              textContentType="givenName"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              returnKeyType="next"
            />
          )}
        />
        <Controller
          control={control}
          name="lastName"
          render={({ field, fieldState }) => (
            <TextField
              label="Nom"
              autoComplete="family-name"
              textContentType="familyName"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              onSubmitEditing={() => void onSubmit()}
              returnKeyType="done"
            />
          )}
        />
        {serverError ? <Text tone="danger">{serverError}</Text> : null}
      </View>
    </Screen>
  );
}
