import { expect, test } from '@playwright/test';

test.describe('PDF verify API', () => {
  test('returns unsigned for a minimal PDF without signatures', async ({ request }) => {
    const minimalPdf = Buffer.from('%PDF-1.7\n%%EOF');

    const response = await request.post('/api/verify', {
      multipart: {
        file: {
          name: 'unsigned.pdf',
          mimeType: 'application/pdf',
          buffer: minimalPdf,
        },
      },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body.status).toBe('unsigned');
    expect(body.checks.integrityValid).toBe(false);
  });

  test('rejects non-PDF uploads', async ({ request }) => {
    const response = await request.post('/api/verify', {
      multipart: {
        file: {
          name: 'notes.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('hello'),
        },
      },
    });

    expect(response.status()).toBe(400);
  });
});
