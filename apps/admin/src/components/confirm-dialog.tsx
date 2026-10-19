'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Dialogue de confirmation, avec motif obligatoire si `reason` est demandé
 * (refus, suspension…). Le motif est transmis à l'artisan et journalisé.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  reason,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  reason?: { label: string; placeholder?: string };
  onConfirm: (reason?: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [touched, setTouched] = useState(false);
  const id = useId();
  const invalid = !!reason && value.trim().length < 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setPending(true);
    try {
      await onConfirm(reason ? value.trim() : undefined);
      setOpen(false);
      setValue('');
      setTouched(false);
    } catch {
      // Le toast d'erreur est géré par l'appelant (mutation).
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {reason && (
            <div className="grid gap-2">
              <Label htmlFor={id}>{reason.label} (obligatoire)</Label>
              <Textarea
                id={id}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={reason.placeholder}
                maxLength={1000}
                aria-invalid={touched && invalid}
                aria-describedby={touched && invalid ? `${id}-err` : undefined}
                required
                autoFocus
              />
              {touched && invalid && (
                <p id={`${id}-err`} className="text-sm text-urgent">
                  Indiquez un motif d’au moins 3 caractères.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
