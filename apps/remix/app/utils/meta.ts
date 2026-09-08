import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { APP_COMPANY_NAME, APP_DESCRIPTION, APP_NAME, formatPageTitle } from '@documenso/lib/constants/branding';
import { i18n, type MessageDescriptor } from '@lingui/core';

export const appMetaTags = (title?: MessageDescriptor) => {
  const appName = APP_NAME();
  const description = APP_DESCRIPTION();
  const pageTitle = title ? i18n._(title) : undefined;

  return [
    {
      title: formatPageTitle(pageTitle),
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content: `${appName}, document signing, e-signatures, electronic signatures`,
    },
    {
      name: 'author',
      content: APP_COMPANY_NAME(),
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: formatPageTitle(pageTitle),
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
