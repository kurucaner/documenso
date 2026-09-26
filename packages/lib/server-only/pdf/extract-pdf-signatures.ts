export type ExtractedPdfSignature = {
  byteRange: [number, number, number, number];
  contentsStart: number;
  contentsEnd: number;
  contentsHexLength: number;
  subFilter: string | null;
};

const BYTE_RANGE_PATTERN = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;

const parseHexContentsLength = (pdfBytes: Uint8Array, contentsStart: number) => {
  if (pdfBytes[contentsStart] !== 0x3c) {
    return null;
  }

  let index = contentsStart + 1;

  while (index < pdfBytes.length) {
    const byte = pdfBytes[index];

    if (byte === 0x3e) {
      return index - contentsStart + 1;
    }

    index += 1;
  }

  return null;
};

const findContentsNearByteRange = (pdfBytes: Uint8Array, byteRangeStart: number) => {
  const contentsMarker = '/Contents <';
  const searchBeforeStart = Math.max(0, byteRangeStart - 65536);
  const beforeWindow = Buffer.from(pdfBytes.subarray(searchBeforeStart, byteRangeStart)).toString('latin1');
  const beforeMarkerIndex = beforeWindow.lastIndexOf(contentsMarker);

  if (beforeMarkerIndex !== -1) {
    return searchBeforeStart + beforeMarkerIndex + '/Contents '.length;
  }

  const searchAfterEnd = Math.min(pdfBytes.length, byteRangeStart + 65536);
  const afterWindow = Buffer.from(pdfBytes.subarray(byteRangeStart, searchAfterEnd)).toString('latin1');
  const afterMarkerIndex = afterWindow.indexOf(contentsMarker);

  if (afterMarkerIndex === -1) {
    return null;
  }

  return byteRangeStart + afterMarkerIndex + '/Contents '.length;
};

/**
 * Extract PKCS#7 signature placeholders from a PDF byte stream.
 * Supports standard PAdES / PKCS#7 detached signatures produced by Documenso.
 */
export const extractPdfSignatures = (pdfBytes: Uint8Array): ExtractedPdfSignature[] => {
  const pdfText = Buffer.from(pdfBytes).toString('latin1');
  const signatures: ExtractedPdfSignature[] = [];

  for (const match of pdfText.matchAll(BYTE_RANGE_PATTERN)) {
    const byteRangeStart = match.index ?? 0;
    const byteRange: [number, number, number, number] = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
    ];

    const contentsStart = findContentsNearByteRange(pdfBytes, byteRangeStart);

    if (contentsStart === null) {
      continue;
    }

    const contentsHexLength = parseHexContentsLength(pdfBytes, contentsStart);

    if (!contentsHexLength) {
      continue;
    }

    const subFilterWindow = pdfText.slice(Math.max(0, byteRangeStart - 512), byteRangeStart + 512);
    const subFilterMatch = subFilterWindow.match(/\/SubFilter\s*\/([^\s/>]+)/);
    const subFilter = subFilterMatch?.[1] ?? null;

    signatures.push({
      byteRange,
      contentsStart,
      contentsEnd: contentsStart + contentsHexLength,
      contentsHexLength,
      subFilter,
    });
  }

  return signatures;
};

export const buildSignedByteRanges = (pdfBytes: Uint8Array, byteRange: ExtractedPdfSignature['byteRange']) => {
  const [start1, length1, start2, length2] = byteRange;
  const part1 = pdfBytes.subarray(start1, start1 + length1);
  const part2 = pdfBytes.subarray(start2, start2 + length2);
  const signedData = new Uint8Array(part1.length + part2.length);

  signedData.set(part1, 0);
  signedData.set(part2, part1.length);

  return signedData;
};

export const decodeSignatureContents = (pdfBytes: Uint8Array, signature: ExtractedPdfSignature) => {
  const hexSlice = pdfBytes.subarray(signature.contentsStart + 1, signature.contentsEnd - 1);
  const hexString = Buffer.from(hexSlice).toString('ascii').replace(/\s/g, '');

  return Buffer.from(hexString, 'hex');
};
