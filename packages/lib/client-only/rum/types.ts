import type { RumPlugin } from '@datadog/browser-rum';

export interface IDatadogRumUser {
  email: string;
  id: string;
  name: string;
}

export interface ICreateDatadogRumOptions {
  applicationId?: string;
  clientToken?: string;
  env?: string;
  plugins?: RumPlugin[];
  proxyUrl?: string;
  service?: string;
  site?: string;
  version?: string;
}

export interface IDatadogRumClient {
  clearUser: () => void;
  init: () => void;
  isEnabled: () => boolean;
  setUser: (user: IDatadogRumUser) => void;
  trackError: (error: unknown, context?: Record<string, unknown>) => void;
  trackView: (name: string) => void;
}

export interface IDatadogRumConfig {
  applicationId: string;
  clientToken: string;
  env: string;
  plugins?: RumPlugin[];
  proxyUrl?: string;
  service: string;
  site: string;
  version?: string;
}
