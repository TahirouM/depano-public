'use client';

import { DISPUTE_RESOLUTIONS, ResolveDisputeBody, type DisputeResolution } from '@depano/schemas';
import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { eurosInputToCents, formatEuros } from '@/lib/format';
import { RESOLUTION_LABELS } from '@/lib/labels';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';

const HELP: Record<DisputeResolution, string> = {
  full_capture: 'Le montant autorisé est capturé, l’artisan est payé (moins la commission).',
  partial_capture: 'Seul le montant indiqué est capturé, le reste de l’empreinte est libéré.',
  travel_fee_only: 'Seuls les frais de déplacement sont capturés, sans commission DEPANO.',
  full_refund: 'Rien n’est capturé : l’empreinte est annulée ou le client remboursé.',
};

/** Arbitrage d'un litige (plan §4 : le support tranche en moins de 72 h). */
export function ResolveDisputeDialog({
  disputeId,
  reference,
  amountCents,
  trigger,
  bookingId,
}: {
  disputeId: string;
  reference: string;
  amountCents: number;
  trigger: React.ReactNode;
  bookingId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<DisputeResolution | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ resolution?: string; amount?: string; note?: string }>({});
  const uid = useId();

  const resolve = useAction({
    fn: (body: ResolveDisputeBody) => api.admin.resolveDispute(disputeId, body),
    success: `Litige ${reference} tranché`,
    invalidate: [['disputes'], ['booking', bookingId], ['bookings'], ['metrics']],
  });

  function reset() {
    setResolution(null);
    setAmount('');
    setNote('');
    setErrors({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!resolution) errs.resolution = 'Choisissez une décision.';
    let captureCents: number | undefined;
    if (resolution === 'partial_capture') {
      const c = eurosInputToCents(amount);
      if (c === null || c <= 0) errs.amount = 'Indiquez un montant valide.';
      else if (c > amountCents) errs.amount = `Le montant ne peut pas dépasser ${formatEuros(amountCents)}.`;
      else captureCents = c;
    }
    const parsed = ResolveDisputeBody.safeParse({ resolution, captureCents, note: note.trim() });
    if (note.trim().length < 3) errs.note = 'La note doit contenir au moins 3 caractères.';
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;
    try {
      await resolve.mutateAsync(parsed.data);
      setOpen(false);
      reset();
    } catch {
      /* toast déjà affiché */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (resolve.isPending) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Trancher le litige {reference}</DialogTitle>
            <DialogDescription>Montant autorisé : {formatEuros(amountCents)}. La décision est notifiée au client et à l’artisan.</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2" aria-describedby={errors.resolution ? `${uid}-res-err` : undefined}>
            <legend className="mb-1 text-sm font-medium">Décision</legend>
            {DISPUTE_RESOLUTIONS.map((r) => (
              <label
                key={r}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                  resolution === r ? 'border-primary bg-secondary/60' : 'hover:bg-muted/60',
                )}
              >
                <input
                  type="radio"
                  name={`${uid}-resolution`}
                  value={r}
                  checked={resolution === r}
                  onChange={() => setResolution(r)}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium">{RESOLUTION_LABELS[r]}</span>
                  <span className="text-muted-foreground">{HELP[r]}</span>
                </span>
              </label>
            ))}
            {errors.resolution && (
              <p id={`${uid}-res-err`} className="text-sm text-urgent">
                {errors.resolution}
              </p>
            )}
          </fieldset>

          {resolution === 'partial_capture' && (
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-amount`}>Montant à capturer (€)</Label>
              <Input
                id={`${uid}-amount`}
                inputMode="decimal"
                placeholder="Ex. 85,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!errors.amount || undefined}
                aria-describedby={errors.amount ? `${uid}-amount-err` : undefined}
              />
              {errors.amount && (
                <p id={`${uid}-amount-err`} className="text-sm text-urgent">
                  {errors.amount}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${uid}-note`}>Note de décision (obligatoire)</Label>
            <Textarea
              id={`${uid}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Éléments retenus : timeline, positions GPS, chat, photos…"
              aria-invalid={!!errors.note || undefined}
              aria-describedby={errors.note ? `${uid}-note-err` : undefined}
            />
            {errors.note && (
              <p id={`${uid}-note-err`} className="text-sm text-urgent">
                {errors.note}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={resolve.isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={resolve.isPending}>
              {resolve.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Valider la décision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
