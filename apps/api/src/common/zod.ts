import { ArgumentMetadata, Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';
import { badRequest } from './errors';

// Messages de validation Zod en français (instance partagée avec @depano/schemas).
z.config(z.locales.fr());

export function zodIssues(error: z.ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code }));
}

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issues = zodIssues(r.error);
    const first = issues[0];
    throw badRequest('validation_error', first ? `Données invalides : ${first.path ? `${first.path} — ` : ''}${first.message}` : 'Données invalides.', issues);
  }
  return r.data;
}

export class ZodValidationPipe<T extends z.ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown, _meta: ArgumentMetadata): z.output<T> {
    return parseOrThrow(this.schema, value ?? {});
  }
}

function jsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  try {
    const s = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'openapi-3.0' }) as Record<string, unknown>;
    delete s.$schema;
    return s;
  } catch {
    return { type: 'object' };
  }
}

/** Corps validé par un schéma Zod + documentation OpenAPI. */
export const ZBody =
  (schema: z.ZodTypeAny): ParameterDecorator =>
  (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key!, index);
    const descriptor = Object.getOwnPropertyDescriptor(target, key!);
    if (descriptor) ApiBody({ schema: jsonSchema(schema) as never })(target, key!, descriptor);
  };

/** Query string validée par un schéma Zod (objet) + documentation OpenAPI. */
export const ZQuery =
  (schema: z.ZodTypeAny): ParameterDecorator =>
  (target, key, index) => {
    Query(new ZodValidationPipe(schema))(target, key!, index);
    const descriptor = Object.getOwnPropertyDescriptor(target, key!);
    const shape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
    if (descriptor && shape) {
      for (const [name, s] of Object.entries(shape)) {
        ApiQuery({ name, required: !s.safeParse(undefined).success, schema: jsonSchema(s) as never })(target, key!, descriptor);
      }
    }
  };
