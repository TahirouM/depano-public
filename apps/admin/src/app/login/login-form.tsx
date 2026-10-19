'use client';

import { OtpRequestBody } from '@depano/schemas';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/otp-input';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Connexion impossible. Vérifiez votre réseau.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof json?.message === 'string' ? json.message : Array.isArray(json?.message) ? json.message.join(', ') : null;
    throw new Error(msg ?? 'Une erreur est survenue');
  }
  return json as T;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get('expired') ? 'Votre session a expiré, reconnectez-vous.' : null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const parsed = OtpRequestBody.safeParse({ phone });
    if (!parsed.success) {
      setError('Numéro de téléphone invalide (ex. 06 12 34 56 78 ou +33 6…).');
      return;
    }
    setPending(true);
    try {
      const r = await postJson<{ retryAfterSeconds: number; devCode?: string }>('/api/auth/otp/request', parsed.data);
      setNormalized(parsed.data.phone);
      setDevCode(r.devCode ?? null);
      setCooldown(r.retryAfterSeconds ?? 30);
      setCode('');
      setStep('code');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function verify(value = code) {
    if (value.length !== 6 || pending) return;
    setError(null);
    setPending(true);
    try {
      await postJson('/api/auth/otp/verify', { phone: normalized, code: value });
      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setCode('');
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div aria-hidden className="mb-2 grid size-10 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          D
        </div>
        <CardTitle className="text-xl">Back-office DEPANO</CardTitle>
        <CardDescription>
          {step === 'phone' ? 'Connectez-vous avec votre numéro de mobile.' : `Saisissez le code envoyé au ${normalized}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'phone' ? (
          <form onSubmit={requestCode} className="grid grid-cols-1 gap-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="phone">Numéro de mobile</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="06 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? 'login-error' : undefined}
                autoFocus
                required
              />
            </div>
            {error && (
              <p id="login-error" role="alert" className="text-sm text-urgent">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending || !phone.trim()}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Recevoir un code
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="grid grid-cols-1 gap-4"
          >
            <div className="grid gap-2">
              <span id="otp-label" className="text-sm font-medium">
                Code à 6 chiffres
              </span>
              <OtpInput value={code} onChange={setCode} labelId="otp-label" disabled={pending} invalid={!!error} onComplete={(v) => void verify(v)} />
            </div>
            {devCode && (
              <p className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                <span>
                  Code de développement : <strong className="font-mono tracking-widest">{devCode}</strong>
                </span>
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-urgent">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Se connecter
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
              >
                <ArrowLeft aria-hidden /> Changer de numéro
              </Button>
              <Button type="button" variant="link" className="h-auto p-0" disabled={cooldown > 0 || pending} onClick={() => void requestCode()}>
                {cooldown > 0 ? `Renvoyer (${cooldown} s)` : 'Renvoyer le code'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
