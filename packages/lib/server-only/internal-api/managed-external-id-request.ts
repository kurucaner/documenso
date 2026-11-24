import { z } from 'zod';

const zManagedExternalIdUuid = z.string().uuid();

export const ZManagedExternalIdBodyFields = {
  managedExternalId: zManagedExternalIdUuid.optional(),
  /** @deprecated Use `managedExternalId` — removed after one release. */
  propertyOsPropertyId: zManagedExternalIdUuid.optional(),
};

export type TManagedExternalIdBody = {
  managedExternalId?: string;
  propertyOsPropertyId?: string;
};

export const addManagedExternalIdAliasRefinement = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((data, ctx) => {
    const body = data as TManagedExternalIdBody;

    if (
      body.managedExternalId != null &&
      body.propertyOsPropertyId != null &&
      body.managedExternalId !== body.propertyOsPropertyId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'managedExternalId and propertyOsPropertyId must match when both are sent',
        path: ['managedExternalId'],
      });
    }
  });

export const resolveManagedExternalIdFromRequest = (body: TManagedExternalIdBody): string | undefined =>
  body.managedExternalId ?? body.propertyOsPropertyId;
