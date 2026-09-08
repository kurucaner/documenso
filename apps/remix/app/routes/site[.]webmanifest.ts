import { getBasePath } from '@documenso/lib/constants/app';
import { APP_FAVICON_URL, APP_NAME } from '@documenso/lib/constants/branding';

export const loader = async () => {
  const basePath = getBasePath();
  const faviconUrl = APP_FAVICON_URL() ?? `${basePath}/favicon-32x32.png`;

  return Response.json(
    {
      name: APP_NAME(),
      short_name: APP_NAME(),
      icons: [
        {
          src: faviconUrl,
          sizes: '192x192',
          type: 'image/png',
        },
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
};
