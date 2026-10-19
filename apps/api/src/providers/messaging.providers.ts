import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/config.service';

export interface SmsProvider {
  send(phone: string, body: string): Promise<void>;
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
export interface PushProvider {
  /** Renvoie les jetons invalides (à désactiver). */
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}

export interface CallRelayProvider {
  createRelay(input: { bookingId: string; callerPhone: string; calleePhone: string; ttlSeconds: number }): Promise<{ phoneNumber: string }>;
}

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');
  async send(phone: string, body: string) {
    this.logger.log(`→ ${phone} : ${body}`);
  }
}

@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}
  async send(phone: string, body: string) {
    const e = this.config.env;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: e.TWILIO_FROM_NUMBER, Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Twilio SMS ${res.status} : ${await res.text()}`);
  }
}

@Injectable()
export class ConsolePushProvider implements PushProvider {
  private readonly logger = new Logger('Push');
  async send(messages: PushMessage[]) {
    for (const m of messages) this.logger.log(`→ ${m.token.slice(0, 18)}… « ${m.title} » ${m.body}`);
    return { invalidTokens: [] };
  }
}

/** Expo Push API (relaie vers APNs / FCM). */
@Injectable()
export class ExpoPushProvider implements PushProvider {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}
  async send(messages: PushMessage[]) {
    if (!messages.length) return { invalidTokens: [] };
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.config.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${this.config.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages.map((m) => ({ to: m.token, title: m.title, body: m.body, data: m.data, sound: 'default', priority: 'high' }))),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Expo push ${res.status} : ${await res.text()}`);
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const invalidTokens = (json.data ?? [])
      .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? messages[i]!.token : null))
      .filter((t): t is string => !!t);
    return { invalidTokens };
  }
}

/** Relais d'appel factice (dev) : numéro masqué déterministe. */
@Injectable()
export class FakeCallRelayProvider implements CallRelayProvider {
  async createRelay(input: { bookingId: string }) {
    const digits = input.bookingId.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
    return { phoneNumber: `+339${digits}` };
  }
}

/** Twilio Proxy : session à deux participants, chacun appelle un numéro relais. */
@Injectable()
export class TwilioProxyCallRelayProvider implements CallRelayProvider {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  private async call(path: string, params: Record<string, string>) {
    const e = this.config.env;
    const res = await fetch(`https://proxy.twilio.com/v1/Services/${e.TWILIO_PROXY_SERVICE_SID}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Twilio Proxy ${res.status} : ${await res.text()}`);
    return (await res.json()) as Record<string, any>;
  }

  async createRelay(input: { bookingId: string; callerPhone: string; calleePhone: string; ttlSeconds: number }) {
    const session = await this.call('/Sessions', { UniqueName: `${input.bookingId}-${Date.now()}`, Ttl: String(input.ttlSeconds), Mode: 'voice-only' });
    const caller = await this.call(`/Sessions/${session.sid}/Participants`, { Identifier: input.callerPhone });
    await this.call(`/Sessions/${session.sid}/Participants`, { Identifier: input.calleePhone });
    return { phoneNumber: caller.proxy_identifier as string };
  }
}
