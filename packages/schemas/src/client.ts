import type * as D from './dto';
import type { z } from 'zod';

/**
 * Client HTTP typé de l'API DEPANO (/v1), partagé par l'app mobile et le back-office.
 * Les corps de requête sont typés par les schémas Zod (entrée), les réponses par les DTO.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() {
    return this.status === 0;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  /** Appelé sur 401 : doit rafraîchir les jetons et renvoyer true si on peut réessayer. */
  onUnauthorized?: () => Promise<boolean>;
  fetch?: typeof fetch;
}

type In<T extends z.ZodTypeAny> = z.input<T>;
type Query = Record<string, string | number | boolean | undefined | null>;

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown, query?: Query, retry = true): Promise<T> {
    const url = new URL(`/v1${path}`, opts.baseUrl);
    if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const token = await opts.getAccessToken();
    let res: Response;
    try {
      res = await doFetch(url.toString(), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError(0, 'network_error', 'Connexion impossible. Vérifiez votre réseau.', e);
    }
    if (res.status === 401 && retry && opts.onUnauthorized && (await opts.onUnauthorized())) {
      return request<T>(method, path, body, query, false);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = (json ?? {}) as Partial<D.ApiErrorBody>;
      throw new ApiError(res.status, err.code ?? 'error', err.message ?? 'Une erreur est survenue', err.details);
    }
    return json as T;
  }

  const get = <T>(p: string, q?: Query) => request<T>('GET', p, undefined, q);
  const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {});
  const patch = <T>(p: string, b: unknown) => request<T>('PATCH', p, b);
  const put = <T>(p: string, b: unknown) => request<T>('PUT', p, b);
  const del = <T = void>(p: string) => request<T>('DELETE', p);

  return {
    request,
    auth: {
      requestOtp: (b: In<typeof D.OtpRequestBody>) => post<{ sent: true; retryAfterSeconds: number }>('/auth/otp/request', b),
      verifyOtp: (b: In<typeof D.OtpVerifyBody>) => post<D.AuthResult>('/auth/otp/verify', b),
      apple: (b: In<typeof D.AppleSignInBody>) => post<D.AuthResult>('/auth/apple', b),
      google: (b: In<typeof D.GoogleSignInBody>) => post<D.AuthResult>('/auth/google', b),
      refresh: (b: D.RefreshBody) => post<D.AuthTokens>('/auth/refresh', b),
      logout: (b: D.RefreshBody) => post<void>('/auth/logout', b),
      sessions: () => get<D.SessionDto[]>('/auth/sessions'),
      revokeSession: (id: string) => del(`/auth/sessions/${id}`),
      passkeyRegisterOptions: () => post<Record<string, unknown>>('/auth/passkeys/register/options'),
      passkeyRegisterVerify: (b: In<typeof D.PasskeyRegisterVerifyBody>) => post<{ ok: true }>('/auth/passkeys/register/verify', b),
      passkeyLoginOptions: (b: In<typeof D.PasskeyLoginOptionsBody>) =>
        post<{ challengeId: string; options: Record<string, unknown> }>('/auth/passkeys/login/options', b),
      passkeyLoginVerify: (b: In<typeof D.PasskeyLoginVerifyBody>) => post<D.AuthResult>('/auth/passkeys/login/verify', b),
    },
    me: {
      get: () => get<D.Me>('/me'),
      update: (b: In<typeof D.UpdateMeBody>) => patch<D.Me>('/me', b),
      setActiveRole: (b: D.SetActiveRoleBody) => put<D.Me>('/me/active-role', b),
      delete: () => del('/me'),
      exportData: () => get<Record<string, unknown>>('/me/export'),
      badges: () => get<D.BadgesDto>('/me/badges'),
      registerPushToken: (b: D.PushTokenBody) => post<void>('/me/push-tokens', b),
      addresses: () => get<D.AddressDto[]>('/me/addresses'),
      createAddress: (b: In<typeof D.AddressBody>) => post<D.AddressDto>('/me/addresses', b),
      updateAddress: (id: string, b: Partial<In<typeof D.AddressBody>>) => patch<D.AddressDto>(`/me/addresses/${id}`, b),
      deleteAddress: (id: string) => del(`/me/addresses/${id}`),
      favorites: () => get<D.ArtisanCardDto[]>('/me/favorites'),
      addFavorite: (artisanId: string) => put<void>(`/me/favorites/${artisanId}`, {}),
      removeFavorite: (artisanId: string) => del(`/me/favorites/${artisanId}`),
      paymentMethods: () => get<D.PaymentMethodDto[]>('/me/payment-methods'),
      setupIntent: () => post<D.SetupIntentDto>('/me/payment-methods/setup-intent'),
      deletePaymentMethod: (id: string) => del(`/me/payment-methods/${id}`),
      invoices: () => get<D.InvoiceDto[]>('/me/invoices'),
    },
    catalog: {
      domains: () => get<D.DomainDto[]>('/domains'),
      searchArtisans: (q: In<typeof D.ArtisanSearchQuery>) => get<D.Paginated<D.ArtisanCardDto>>('/artisans', q as Query),
      artisan: (id: string, q?: { lat?: number; lng?: number }) => get<D.ArtisanPublicDto>(`/artisans/${id}`, q),
      slots: (id: string, q: In<typeof D.SlotsQuery>) => get<D.SlotDay[]>(`/artisans/${id}/slots`, q as Query),
      reviews: (id: string, cursor?: string) => get<D.Paginated<D.ReviewDto>>(`/artisans/${id}/reviews`, { cursor }),
      estimate: (b: In<typeof D.EstimateBody>) => post<D.EstimateDto>('/estimate', b),
      searchAddress: (q: string, near?: { lat: number; lng: number }) =>
        get<D.AddressSuggestion[]>('/geo/address-search', { q, lat: near?.lat, lng: near?.lng }),
      reverseGeocode: (lat: number, lng: number) => get<D.AddressSuggestion | null>('/geo/reverse', { lat, lng }),
    },
    bookings: {
      create: (b: In<typeof D.CreateBookingBody>) => post<D.CreateBookingResult>('/bookings', b),
      confirmPayment: (id: string) => post<D.BookingDetailDto>(`/bookings/${id}/confirm-payment`),
      list: (q: In<typeof D.BookingListQuery>) => get<D.Paginated<D.BookingSummaryDto>>('/bookings', q as Query),
      get: (id: string) => get<D.BookingDetailDto>(`/bookings/${id}`),
      transition: (id: string, b: In<typeof D.TransitionBody>) => post<D.BookingDetailDto>(`/bookings/${id}/transition`, b),
      cancel: (id: string, b: In<typeof D.CancelBookingBody> = {}) => post<D.BookingDetailDto>(`/bookings/${id}/cancel`, b),
      sendQuote: (id: string, b: In<typeof D.CreateQuoteBody>) => post<D.BookingDetailDto>(`/bookings/${id}/quote`, b),
      answerQuote: (id: string, b: D.AnswerQuoteBody) =>
        post<{ booking: D.BookingDetailDto; payment: D.PaymentSessionDto | null }>(`/bookings/${id}/quote/answer`, b),
      submitReport: (id: string, b: In<typeof D.ReportBody>) => post<D.BookingDetailDto>(`/bookings/${id}/report`, b),
      complete: (id: string, b: D.CompleteBody) => post<D.BookingDetailDto>(`/bookings/${id}/complete`, b),
      updateLocation: (id: string, b: In<typeof D.LocationBody>) => post<void>(`/bookings/${id}/location`, b),
      review: (id: string, b: In<typeof D.ReviewBody>) => post<D.ReviewDto>(`/bookings/${id}/review`, b),
      dispute: (id: string, b: In<typeof D.DisputeBody>) => post<D.BookingDetailDto>(`/bookings/${id}/dispute`, b),
      callRelay: (id: string) => post<D.CallRelayDto>(`/bookings/${id}/call`),
    },
    reviews: {
      reply: (id: string, b: In<typeof D.ReviewReplyBody>) => post<D.ReviewDto>(`/reviews/${id}/reply`, b),
    },
    artisan: {
      lookupSiret: (b: In<typeof D.SiretLookupBody>) => post<D.CompanyInfoDto>('/artisan/onboarding/siret', b),
      profile: () => get<D.ArtisanPrivateProfileDto>('/artisan/profile'),
      updateProfile: (b: In<typeof D.ArtisanProfileBody>) => patch<D.ArtisanPrivateProfileDto>('/artisan/profile', b),
      setServices: (b: In<typeof D.ArtisanServicesBody>) => put<D.ArtisanPrivateProfileDto>('/artisan/services', b),
      setAvailabilityRules: (b: In<typeof D.AvailabilityRulesBody>) => put<D.ArtisanPrivateProfileDto>('/artisan/availability/rules', b),
      exceptions: () => get<D.AvailabilityExceptionDto[]>('/artisan/availability/exceptions'),
      addException: (b: In<typeof D.AvailabilityExceptionBody>) => post<D.AvailabilityExceptionDto>('/artisan/availability/exceptions', b),
      deleteException: (id: string) => del(`/artisan/availability/exceptions/${id}`),
      addDocument: (b: In<typeof D.ArtisanDocumentBody>) => post<D.ArtisanDocumentDto>('/artisan/documents', b),
      payoutOnboardingLink: () => post<{ url: string }>('/artisan/payouts/onboarding-link'),
      submit: () => post<D.ArtisanPrivateProfileDto>('/artisan/submit'),
      setUrgentAvailability: (b: In<typeof D.UrgentAvailabilityBody>) => put<D.ArtisanPrivateProfileDto>('/artisan/urgent-availability', b),
      dashboard: () => get<D.ArtisanDashboardDto>('/artisan/dashboard'),
      planning: (q: { from: string; to: string }) => get<D.PlanningDto>('/artisan/planning', q),
      offers: () => get<D.UrgentOfferDto[]>('/artisan/offers'),
      acceptOffer: (id: string) => post<D.BookingDetailDto>(`/artisan/offers/${id}/accept`),
      declineOffer: (id: string) => post<void>(`/artisan/offers/${id}/decline`),
      earnings: () => get<D.EarningsDto>('/artisan/earnings'),
      stats: () => get<D.ArtisanStatsDto>('/artisan/stats'),
      reviews: (cursor?: string) => get<D.Paginated<D.ReviewDto>>('/artisan/reviews', { cursor }),
    },
    files: {
      uploadUrl: (b: In<typeof D.UploadUrlBody>) => post<D.UploadUrlDto>('/files/upload-url', b),
      complete: (id: string) => post<{ id: string; url: string }>(`/files/${id}/complete`),
      url: (id: string) => get<{ url: string; expiresAt: string }>(`/files/${id}/url`),
    },
    chat: {
      conversations: () => get<D.ConversationDto[]>('/conversations'),
      messages: (id: string, before?: string) => get<D.Paginated<D.MessageDto>>(`/conversations/${id}/messages`, { before }),
      send: (id: string, b: In<typeof D.SendMessageBody>) => post<D.MessageDto>(`/conversations/${id}/messages`, b),
      markRead: (id: string) => post<void>(`/conversations/${id}/read`),
    },
    notifications: {
      list: (cursor?: string) => get<D.Paginated<D.NotificationDto>>('/notifications', { cursor }),
      markRead: (id: string) => post<void>(`/notifications/${id}/read`),
      markAllRead: () => post<void>('/notifications/read-all'),
    },
    admin: {
      metrics: (q?: { from?: string; to?: string }) => get<D.AdminMetricsDto>('/admin/metrics', q),
      artisans: (q: In<typeof D.AdminArtisanListQuery>) => get<D.Paginated<D.AdminArtisanRowDto>>('/admin/artisans', q as Query),
      artisan: (id: string) => get<D.AdminArtisanDetailDto>(`/admin/artisans/${id}`),
      approveArtisan: (id: string) => post<D.AdminArtisanDetailDto>(`/admin/artisans/${id}/approve`),
      rejectArtisan: (id: string, b: D.AdminDecisionBody) => post<D.AdminArtisanDetailDto>(`/admin/artisans/${id}/reject`, b),
      suspendArtisan: (id: string, b: D.AdminDecisionBody) => post<D.AdminArtisanDetailDto>(`/admin/artisans/${id}/suspend`, b),
      reinstateArtisan: (id: string) => post<D.AdminArtisanDetailDto>(`/admin/artisans/${id}/reinstate`),
      approveDocument: (id: string) => post<D.ArtisanDocumentDto>(`/admin/documents/${id}/approve`),
      rejectDocument: (id: string, b: D.AdminDecisionBody) => post<D.ArtisanDocumentDto>(`/admin/documents/${id}/reject`, b),
      bookings: (q: In<typeof D.AdminBookingListQuery>) => get<D.Paginated<D.BookingSummaryDto>>('/admin/bookings', q as Query),
      booking: (id: string) => get<D.AdminBookingDetailDto>(`/admin/bookings/${id}`),
      disputes: (q?: { status?: 'open' | 'resolved' }) => get<D.AdminDisputeRowDto[]>('/admin/disputes', q),
      resolveDispute: (id: string, b: In<typeof D.ResolveDisputeBody>) => post<D.DisputeDto>(`/admin/disputes/${id}/resolve`, b),
      services: () => get<(D.ServiceDto & { active: boolean })[]>('/admin/services'),
      createService: (b: In<typeof D.AdminServiceBody>) => post<D.ServiceDto>('/admin/services', b),
      updateService: (id: string, b: Partial<In<typeof D.AdminServiceBody>>) => patch<D.ServiceDto>(`/admin/services/${id}`, b),
      zones: () => get<D.ZoneDto[]>('/admin/zones'),
      createZone: (b: In<typeof D.ZoneBody>) => post<D.ZoneDto>('/admin/zones', b),
      updateZone: (id: string, b: Partial<In<typeof D.ZoneBody>>) => patch<D.ZoneDto>(`/admin/zones/${id}`, b),
      users: (q: { q?: string; cursor?: string }) => get<D.Paginated<D.AdminUserRowDto>>('/admin/users', q),
      /** Export DAC7 (CSV) : renvoie une URL signée. */
      dac7Export: (year: number) => get<{ url: string; rows: number }>('/admin/exports/dac7', { year }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
