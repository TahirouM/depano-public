import type { DomainCode } from '@depano/schemas';
import { useTheme } from '../theme/ThemeProvider';
import { Chip } from './Chip';
import { DOMAIN_ICONS, DOMAIN_LABELS } from './meta';

export interface DomainChipProps {
  domain: DomainCode;
  size?: 'sm' | 'md';
  selected?: boolean;
  onPress?: () => void;
}

/** Pastille métier (plomberie bleu, électricité jaune, énergétique orange). */
export function DomainChip({ domain, size = 'md', selected, onPress }: DomainChipProps) {
  const t = useTheme();
  const c = t.colors.domain[domain];
  return (
    <Chip
      label={DOMAIN_LABELS[domain]}
      icon={DOMAIN_ICONS[domain]}
      size={size}
      selected={selected}
      onPress={onPress}
      colors={{ bg: c.soft, fg: c.text, border: c.soft }}
    />
  );
}
