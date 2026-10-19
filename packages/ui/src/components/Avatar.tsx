import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { initials } from '../utils/format';
import { Text } from './Text';

export interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: 32 | 40 | 48 | 64 | 96;
  /** Masqué aux lecteurs d'écran par défaut (le nom est lu à côté). */
  decorative?: boolean;
}

export function Avatar({ name, uri, size = 48, decorative = true }: AvatarProps) {
  const t = useTheme();
  const style = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : `Photo de ${name ?? 'profil'}`}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[styles.base, style, { backgroundColor: t.colors.background.brand }]}
    >
      {uri ? (
        <Image source={{ uri }} style={style} />
      ) : (
        <Text variant={size >= 64 ? 'title2' : size >= 48 ? 'bodyStrong' : 'label'} tone="brand" accessibilityRole="none">
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
