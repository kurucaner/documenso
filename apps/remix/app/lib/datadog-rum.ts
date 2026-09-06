import { createDatadogRum } from '@documenso/lib/client-only/rum/create-datadog-rum';
import { extractDatadogRumConfig } from '@documenso/lib/client-only/rum/extract-datadog-rum-config';

const datadogRum = createDatadogRum(extractDatadogRumConfig() ?? {});

export const {
  clearUser: clearDatadogRumUser,
  init: initDatadogRum,
  isEnabled: isDatadogRumEnabled,
  setUser: setDatadogRumUser,
  trackError: trackDatadogRumError,
  trackView: trackDatadogRumView,
} = datadogRum;
