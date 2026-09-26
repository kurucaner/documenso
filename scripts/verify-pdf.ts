#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { verifyPdf } from '../packages/lib/server-only/pdf/verify-pdf';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: bun run scripts/verify-pdf.ts <path-to.pdf>');
  process.exit(1);
}

const absolutePath = resolve(filePath);
const pdfBytes = new Uint8Array(readFileSync(absolutePath));
const result = await verifyPdf({ pdfBytes });

console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'trusted' ? 0 : 1);
