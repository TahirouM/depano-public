'use client';

import { AdminServiceBody, DOMAIN_CODES, DOMAIN_LABELS, type DomainCode, type ServiceDto } from '@depano/schemas';
import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { FormField, zodErrors } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { centsToEurosInput, eurosInputToCents } from '@/lib/format';
import { SERVICE_KIND_LABELS } from '@/lib/labels';
import { useAction } from '@/lib/use-action';

type Service = ServiceDto & { active: boolean };
type Kind = ServiceDto['kind'];

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function ServiceDialog({ service, trigger }: { service?: Service; trigger: React.ReactNode }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const init = () => ({
    domain: (service?.domain ?? 'plomberie') as DomainCode,
    name: service?.name ?? '',
    slug: service?.slug ?? '',
    slugTouched: !!service,
    description: service?.description ?? '',
    kind: (service?.kind ?? 'repair') as Kind,
    urgentEligible: service?.urgentEligible ?? true,
    price: service ? centsToEurosInput(service.referencePriceCents) : '',
    duration: String(service?.defaultDurationMinutes ?? 60),
    active: service?.active ?? true,
  });
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = useAction({
    fn: (body: AdminServiceBody) => (service ? api.admin.updateService(service.id, body) : api.admin.createService(body)),
    success: service ? 'Prestation mise à jour' : 'Prestation créée',
    invalidate: [['services']],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = eurosInputToCents(f.price);
    const parsed = AdminServiceBody.safeParse({
      domain: f.domain,
      slug: f.slug,
      name: f.name.trim(),
      description: f.description.trim() || null,
      kind: f.kind,
      urgentEligible: f.urgentEligible,
      referencePriceCents: cents ?? -1,
      defaultDurationMinutes: Number(f.duration),
      active: f.active,
    });
    if (!parsed.success) {
      const errs = zodErrors(parsed.error.issues);
      if (errs.referencePriceCents) errs.referencePriceCents = 'Indiquez un prix en euros (ex. 89,00).';
      if (errs.defaultDurationMinutes) errs.defaultDurationMinutes = 'Entre 15 et 600 minutes.';
      if (errs.slug) errs.slug = 'Minuscules, chiffres et tirets uniquement.';
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{service ? `Modifier « ${service.name} »` : 'Nouvelle prestation'}</DialogTitle>
            <DialogDescription>Le prix de référence est proposé par défaut aux artisans.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id={`${uid}-domain`} label="Domaine" error={errors.domain}>
              <Select value={f.domain} onValueChange={(v) => set('domain', v as DomainCode)}>
                <SelectTrigger id={`${uid}-domain`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_CODES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DOMAIN_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id={`${uid}-kind`} label="Type" error={errors.kind}>
              <Select value={f.kind} onValueChange={(v) => set('kind', v as Kind)}>
                <SelectTrigger id={`${uid}-kind`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SERVICE_KIND_LABELS) as Kind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SERVICE_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField id={`${uid}-name`} label="Nom" error={errors.name}>
            <Input
              id={`${uid}-name`}
              value={f.name}
              onChange={(e) => {
                const name = e.target.value;
                setF((s) => ({ ...s, name, slug: s.slugTouched ? s.slug : slugify(name) }));
              }}
              maxLength={120}
              required
              {...err('name')}
            />
          </FormField>
          <FormField id={`${uid}-slug`} label="Identifiant (slug)" error={errors.slug} hint="Utilisé dans les URL et l'API.">
            <Input
              id={`${uid}-slug`}
              value={f.slug}
              onChange={(e) => setF((s) => ({ ...s, slug: e.target.value, slugTouched: true }))}
              className="font-mono"
              {...err('slug')}
            />
          </FormField>
          <FormField id={`${uid}-desc`} label="Description (facultatif)" error={errors.description}>
            <Textarea id={`${uid}-desc`} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id={`${uid}-price`} label="Prix de référence (€ TTC)" error={errors.referencePriceCents}>
              <Input
                id={`${uid}-price`}
                inputMode="decimal"
                placeholder="89,00"
                value={f.price}
                onChange={(e) => set('price', e.target.value)}
                {...err('referencePriceCents')}
              />
            </FormField>
            <FormField id={`${uid}-duration`} label="Durée par défaut (min)" error={errors.defaultDurationMinutes}>
              <Input
                id={`${uid}-duration`}
                type="number"
                min={15}
                max={600}
                step={15}
                value={f.duration}
                onChange={(e) => set('duration', e.target.value)}
                {...err('defaultDurationMinutes')}
              />
            </FormField>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor={`${uid}-urgent`} className="grid gap-0.5">
              <span>Éligible à l’urgence</span>
              <span className="text-xs font-normal text-muted-foreground">Proposée dans le parcours urgence (+ frais d’urgence).</span>
            </Label>
            <Switch id={`${uid}-urgent`} checked={f.urgentEligible} onCheckedChange={(v) => set('urgentEligible', v)} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor={`${uid}-active`} className="grid gap-0.5">
              <span>Active</span>
              <span className="text-xs font-normal text-muted-foreground">Une prestation inactive n’est plus proposée.</span>
            </Label>
            <Switch id={`${uid}-active`} checked={f.active} onCheckedChange={(v) => set('active', v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {service ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
