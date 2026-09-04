import { z } from 'zod';

export const API_TOKEN_EXPIRATION_VALUES = ['ONE_WEEK', 'ONE_MONTH', 'THREE_MONTHS', 'SIX_MONTHS', 'ONE_YEAR'] as const;

export type ApiTokenExpirationValue = (typeof API_TOKEN_EXPIRATION_VALUES)[number];

export const ZApiTokenExpirationSchema = z.enum(API_TOKEN_EXPIRATION_VALUES).nullable();

export type ApiTokenExpiration = z.infer<typeof ZApiTokenExpirationSchema>;
