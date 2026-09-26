import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateOpenApi } from '@ts-rest/open-api';

import { ApiContractV1 } from './contract';

const generatedOpenApi = generateOpenApi(
  ApiContractV1,
  {
    info: {
      title: 'Documenso API',
      version: '1.0.0',
      description:
        'API V1 has been deprecated. For more details, see https://docs.documenso.com/docs/developers/api/migrate-to-envelopes. \n\nThe Documenso API for retrieving, creating, updating and deleting documents.',
    },
    servers: [
      {
        url: NEXT_PUBLIC_WEBAPP_URL(),
      },
    ],
  },
  {
    setOperationId: true,
  },
);

export const OpenAPIV1 = Object.assign(generatedOpenApi, {
  paths: {
    ...generatedOpenApi.paths,
    '/api/v1/verify': {
      post: {
        operationId: 'verifyPdf',
        summary: 'Verify a signed PDF',
        description:
          'Public endpoint (no API key). Upload a completed PDF to verify digital signatures and registry match. Files are not stored.',
        tags: ['Verify'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Signed PDF (max 25MB)' },
                  token: { type: 'string', description: 'Optional qr_* token from the certificate page' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Verification result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['trusted', 'tampered', 'unsigned', 'unknown_valid'],
                    },
                    summary: { type: 'string' },
                    signatures: { type: 'array', items: { type: 'object' } },
                    checks: { type: 'object' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '413': { description: 'File too large' },
          '429': { description: 'Rate limited' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      authorization: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
      },
    },
  },
  security: [
    {
      authorization: [],
    },
  ],
});
