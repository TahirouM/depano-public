'use client';

import { RULES, ZoneBody, type ZoneDto } from '@depano/schemas';
import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { FormField, zodErrors } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { useAction } from '@/lib/use-action';

const num = (v: string) => Number(v.replace(',', '.'));

export function ZoneDialog({ zone, trigger }: { zone?: ZoneDto; trigger: React.ReactNode }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const init = () => ({
    name: zone?.name ?? '',
    centerLat: String(zone?.centerLat ?? 43.2965),
    centerLng: String(zone?.centerLng ?? 5.3698),
    radiusKm: String(zone?.radiusKm ?? 20),
    commission: String(Math.round((zone?.commissionRate ?? RULES.defaultCommissionRate) * 1000) / 10).replace('.', ','),
    active: zone?.active ?? true,
  });
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = useAction({
    fn: (body: ZoneBody) => (zone ? api.admin.updateZone(zone.id, body) : api.admin.createZone(body)),
    success: zone ? 'Zone mise à jour' : 'Zone créée',
    invalidate: [['zones']],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pct = num(f.commission);
    const parsed = ZoneBody.safeParse({
      name: f.name.trim(),
      centerLat: num(f.centerLat),
      centerLng: num(f.centerLng),
      radiusKm: num(f.radiusKm),
      commissionRate: Number.isFinite(pct) ? Math.round(pct * 10) / 1000 : NaN,
      active: f.active,
    });
    if (!parsed.success) {
      const errs = zodErrors(parsed.error.issues);
      if (errs.commissionRate) errs.commissionRate = 'Entre 0 et 50 %.';
      if (errs.centerLat) errs.centerLat = 'Latitude invalide.';
      if (errs.centerLng) errs.centerLng = 'Longitude invalide.';
      if (errs.radiusKm) errs.radiusKm = 'Entre 1 et 100 km.';
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync(parsed.data);
      setOpen(false);
    } catch {
      /* toast */
    }
  }
  const err = (k: string) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `${uid}-${k}-err` } : {});

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (save.isPending) return;
        setOpen(o);
        if (o) {
          setF(init());
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{zone ? `Modifier « ${zone.name} »` : 'Nouvelle zone'}</DialogTitle>
            <DialogDescription>
              La commission s’applique à la capture, jamais sur les frais de déplacement seuls. Fourchette conseillée : 12 à 20 %.
            </DialogDescription>
          </DialogHeader>
          <FormField id={`${uid}-name`} label="Nom" error={errors.name}>
            <Input id={`${uid}-name`} value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} {...err('name')} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id={`${uid}-centerLat`} label="Latitude du centre" error={errors.centerLat}>
              <Input id={`${uid}-centerLat`} inputMode="decimal" value={f.centerLat} onChange={(e) => set('centerLat', e.target.value)} {...err('centerLat')} />
            </FormField>
            <FormField id={`${uid}-centerLng`} label="Longitude du centre" error={errors.centerLng}>
              <Input id={`${uid}-centerLng`} inputMode="decimal" value={f.centerLng} onChange={(e) => set('centerLng', e.target.value)} {...err('centerLng')} />
            </FormField>
            <FormField id={`${uid}-radiusKm`} label="Rayon (km)" error={errors.radiusKm}>
              <Input id={`${uid}-radiusKm`} inputMode="decimal" value={f.radiusKm} onChange={(e) => set('radiusKm', e.target.value)} {...err('radiusKm')} />
            </FormField>
            <FormField id={`${uid}-commissionRate`} label="Commission (%)" error={errors.commissionRate}>
              <Input
                id={`${uid}-commissionRate`}
                inputMode="decimal"
                value={f.commission}
                onChange={(e) => set('commission', e.target.value)}
                {...err('commissionRate')}
              />
            </FormField>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor={`${uid}-active`}>Zone active</Label>
            <Switch id={`${uid}-active`} checked={f.active} onCheckedChange={(v) => set('active', v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {zone ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
