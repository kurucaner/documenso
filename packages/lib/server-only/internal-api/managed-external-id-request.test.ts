import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  addManagedExternalIdAliasRefinement,
  resolveManagedExternalIdFromRequest,
  ZManagedExternalIdBodyFields,
} from './managed-external-id-request';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

const ZTestSchema = addManagedExternalIdAliasRefinement(z.object(ZManagedExternalIdBodyFields));

describe('resolveManagedExternalIdFromRequest', () => {
  it('prefers managedExternalId when both alias fields are absent except primary', () => {
    expect(resolveManagedExternalIdFromRequest({ managedExternalId: UUID_A })).toBe(UUID_A);
  });

  it('falls back to propertyOsPropertyId', () => {
    expect(resolveManagedExternalIdFromRequest({ propertyOsPropertyId: UUID_A })).toBe(UUID_A);
  });

  it('returns undefined when neither field is set', () => {
    expect(resolveManagedExternalIdFromRequest({})).toBeUndefined();
  });
});

describe('addManagedExternalIdAliasRefinement', () => {
  it('rejects when both ids are sent and differ', () => {
    const result = ZTestSchema.safeParse({
      managedExternalId: UUID_A,
      propertyOsPropertyId: UUID_B,
    });

    expect(result.success).toBe(false);
  });

  it('accepts when both ids match', () => {
    const result = ZTestSchema.safeParse({
      managedExternalId: UUID_A,
      propertyOsPropertyId: UUID_A,
    });

    expect(result.success).toBe(true);
  });
});
