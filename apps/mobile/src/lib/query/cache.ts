import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { MessageDto, NotificationDto, Paginated } from '@depano/schemas';
import { qk } from './keys';

/** Insère (ou remplace par clientId/id) un message dans le cache paginé d'une conversation. */
export function upsertMessageInCache(qc: QueryClient, msg: MessageDto) {
  qc.setQueryData<InfiniteData<Paginated<MessageDto>, string | undefined>>(qk.chat.messages(msg.conversationId), (old) => {
    if (!old) return old;
    const exists = old.pages.some((p) => p.items.some((m) => m.id === msg.id || (!!msg.clientId && m.clientId === msg.clientId)));
    if (exists) {
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.map((m) => (m.id === msg.id || (!!msg.clientId && m.clientId === msg.clientId) ? msg : m)),
        })),
      };
    }
    const [first, ...rest] = old.pages;
    if (!first) return old;
    return { ...old, pages: [{ ...first, items: [msg, ...first.items] }, ...rest] };
  });
}

export function prependNotificationInCache(qc: QueryClient, n: NotificationDto) {
  qc.setQueryData<InfiniteData<Paginated<NotificationDto>, string | undefined>>(qk.notifications.list, (old) => {
    if (!old) return old;
    if (old.pages.some((p) => p.items.some((x) => x.id === n.id))) return old;
    const [first, ...rest] = old.pages;
    if (!first) return old;
    return { ...old, pages: [{ ...first, items: [n, ...first.items] }, ...rest] };
  });
}
