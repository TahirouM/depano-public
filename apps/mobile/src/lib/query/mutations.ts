import type { MessageDto } from '@depano/schemas';
import type { QueryClient } from '@tanstack/react-query';
import { useOutboxStore, type OutboxMessage } from '@/stores/outbox';
import { api } from '../api';
import { uploadFile } from '../upload';
import { upsertMessageInCache } from './cache';
import { mk, qk } from './keys';

export type SendMessageVars = Omit<OutboxMessage, 'status'>;

/**
 * Mutations « rejouables » : leur logique est enregistrée via setMutationDefaults pour
 * qu'une mutation mise en pause hors ligne (et persistée) puisse reprendre après un
 * redémarrage de l'app — les callbacks d'un composant démonté n'existent plus.
 *
 * Usage : `useMutation<MessageDto, Error, SendMessageVars>({ mutationKey: mk.chatSend })`.
 */
export function registerMutationDefaults(qc: QueryClient) {
  qc.setMutationDefaults(mk.chatSend, {
    mutationFn: async (v: SendMessageVars): Promise<MessageDto> => {
      let fileId = v.fileId;
      if (!fileId && v.localUri && v.contentType && v.kind !== 'text') {
        const up = await uploadFile({ uri: v.localUri, contentType: v.contentType }, 'chat');
        fileId = up.fileId;
        useOutboxStore.getState().update(v.conversationId, v.clientId, { fileId });
      }
      return api.chat.send(v.conversationId, { clientId: v.clientId, kind: v.kind, body: v.body, fileId });
    },
    onMutate: (v: SendMessageVars) => {
      useOutboxStore.getState().upsert({ ...v, status: 'pending' });
    },
    onSuccess: (msg: MessageDto, v: SendMessageVars) => {
      upsertMessageInCache(qc, msg);
      useOutboxStore.getState().remove(v.conversationId, v.clientId);
      void qc.invalidateQueries({ queryKey: qk.chat.conversations });
    },
    onError: (_e: unknown, v: SendMessageVars) => {
      useOutboxStore.getState().update(v.conversationId, v.clientId, { status: 'failed' });
    },
  });
}
