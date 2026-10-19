'use client';

import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useAction } from '@/lib/use-action';

export default function ExportsPage() {
  const current = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => current - i);
  const [year, setYear] = useState(String(current - 1));
  const [result, setResult] = useState<{ url: string; rows: number; year: string } | null>(null);

  const exp = useAction({
    fn: (y: number) => api.admin.dac7Export(y),
    success: (r) => `Export DAC7 prêt (${formatNumber(r.rows, 0)} vendeurs)`,
  });

  async function run() {
    // Fenêtre ouverte dans le geste utilisateur pour éviter le blocage des pop-ups.
    const win = window.open('', '_blank');
    try {
      const r = await exp.mutateAsync(Number(year));
      setResult({ ...r, year });
      if (win) win.location.href = r.url;
    } catch {
      win?.close();
    }
  }

  return (
    <>
      <PageHeader title="Exports" description="Obligations déclaratives de la plateforme (plan, section 10)." />
      <Section title="Déclaration DAC7" id="dac7" className="max-w-2xl">
        <p className="mb-4 text-sm text-muted-foreground">
          Déclaration annuelle des revenus perçus par les artisans via la plateforme, à transmettre à l’administration fiscale avant le 31 janvier.
          Le fichier CSV est servi par une URL signée de courte durée.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="dac7-year">Année</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="dac7-year" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={exp.isPending}>
            {exp.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            Générer l’export {year}
          </Button>
        </div>
        {result && (
          <p role="status" className="mt-4 text-sm">
            Export {result.year} : {formatNumber(result.rows, 0)} ligne(s).{' '}
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Télécharger le CSV <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
        )}
      </Section>
    </>
  );
}
