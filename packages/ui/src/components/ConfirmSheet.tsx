import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

export interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger pour les actions irréversibles (suppression de compte, annulation). */
  tone?: 'primary' | 'danger' | 'urgent';
  loading?: boolean;
}

/** Confirmation en bottom sheet (2e tap des actions sensibles). */
export function ConfirmSheet({ visible, onClose, onConfirm, title, message, confirmLabel, cancelLabel = 'Annuler', tone = 'primary', loading }: ConfirmSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      description={message}
      scrollable={false}
      footer={
        <>
          <Button label={confirmLabel} variant={tone} onPress={onConfirm} loading={loading} fullWidth haptic={tone === 'primary' ? 'success' : 'warning'} />
          <Button label={cancelLabel} variant="ghost" onPress={onClose} fullWidth disabled={loading} />
        </>
      }
    />
  );
}
