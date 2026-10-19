import { Param, PipeTransform } from '@nestjs/common';
import { badRequest } from './errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class UuidPipe implements PipeTransform {
  transform(v: string) {
    if (!UUID.test(v)) throw badRequest('invalid_id', 'Identifiant invalide.');
    return v;
  }
}

/** Paramètre de route UUID validé. */
export const IdParam = (name = 'id') => Param(name, new UuidPipe());
