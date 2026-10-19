import { Button, Icon, Screen, Text, useReduceMotion, useTheme, type LucideIcon, type Tone } from '@depano/ui';
import { router } from 'expo-router';
import { KeyRound, ReceiptEuro, Siren } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/stores/app';

interface Slide {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'urgence',
    icon: Siren,
    tone: 'urgent',
    title: 'Un artisan chez vous, vite',
    body: 'Fuite, panne de courant, chaudière à l’arrêt : un artisan vérifié accepte votre demande en quelques minutes.',
  },
  {
    key: 'prix',
    icon: ReceiptEuro,
    tone: 'brand',
    title: 'Le prix avant de vous engager',
    body: 'Vous voyez le total TTC avant de valider. Un devis détaillé vous est soumis avant tout travail.',
  },
  {
    key: 'paiement',
    icon: KeyRound,
    tone: 'success',
    title: 'Vous payez à la fin',
    body: 'Votre carte n’est débitée que lorsque vous donnez le code de fin à l’artisan. Jamais avant.',
  },
];

/** 3 slides skippables, au premier lancement uniquement. */
export default function Onboarding() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const list = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const setSeen = useAppStore((s) => s.setOnboardingSeen);

  const finish = () => {
    setSeen();
    router.replace('/accueil');
  };
  const next = () => {
    if (index >= SLIDES.length - 1) return finish();
    list.current?.scrollToIndex({ index: index + 1, animated: !reduce });
    setIndex(index + 1);
  };
  const last = index === SLIDES.length - 1;

  return (
    <Screen scroll={false} padded={false} edges={['left', 'right']} background="brand">
      <View style={[styles.top, { paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.sm }]}>
        <Text variant="title2" tone="brand" style={{ paddingHorizontal: t.spacing.sm }} accessibilityRole="header">
          DEPANO
        </Text>
        {!last ? <Button label="Passer" variant="ghost" size="sm" onPress={finish} accessibilityHint="Ignorer la présentation" /> : null}
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => {
          const tone = t.colors.tone[item.tone];
          return (
            <View
              style={[styles.slide, { width, padding: t.spacing.xl, gap: t.spacing.lg }]}
              accessible
              accessibilityLabel={`Diapositive ${i + 1} sur ${SLIDES.length}. ${item.title}. ${item.body}`}
            >
              <View style={[styles.illu, { backgroundColor: tone.soft }]}>
                <Icon icon={item.icon} size={64} color={tone.text} strokeWidth={1.5} />
              </View>
              <Text variant="display" align="center">
                {item.title}
              </Text>
              <Text variant="body" tone="secondary" align="center">
                {item.body}
              </Text>
            </View>
          );
        }}
      />
      <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + t.spacing.lg, gap: t.spacing.lg }}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {SLIDES.map((s, i) => (
            <Pressable key={s.key} onPress={() => list.current?.scrollToIndex({ index: i, animated: !reduce })} hitSlop={8}>
              <View
                style={{
                  width: i === index ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === index ? t.colors.brand.primary : t.colors.border.input,
                }}
              />
            </Pressable>
          ))}
        </View>
        <Button label={last ? 'Commencer' : 'Suivant'} onPress={next} size="lg" fullWidth haptic={last ? 'success' : undefined} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  illu: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
});
