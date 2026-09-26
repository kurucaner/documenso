import { APP_NAME } from '@documenso/lib/constants/branding';
import type { VerifyResult } from '@documenso/lib/server-only/pdf/verify-pdf.types';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckCircle2Icon, FileUpIcon, ShieldAlertIcon, ShieldXIcon } from 'lucide-react';
import { useRef, useState } from 'react';

type VerifyPdfUploadProps = {
  qrToken?: string;
  compact?: boolean;
};

const statusIcon = (status: VerifyResult['status']) => {
  switch (status) {
    case 'trusted':
      return <CheckCircle2Icon className="h-8 w-8 text-green-600" />;
    case 'tampered':
      return <ShieldXIcon className="h-8 w-8 text-red-600" />;
    case 'unknown_valid':
      return <ShieldAlertIcon className="h-8 w-8 text-amber-600" />;
    case 'unsigned':
      return <ShieldXIcon className="h-8 w-8 text-muted-foreground" />;
  }
};

export const VerifyPdfUpload = ({ qrToken, compact = false }: VerifyPdfUploadProps) => {
  const { t } = useLingui();
  const appName = APP_NAME();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const verifyFile = async (file: File) => {
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const formData = new FormData();

      formData.append('file', file);

      if (qrToken) {
        formData.append('token', qrToken);
      }

      const response = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(typeof payload.error === 'string' ? payload.error : t`Verification failed. Please try again.`);

        return;
      }

      setResult(payload as VerifyResult);
    } catch {
      setError(t`Verification failed. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const onFileSelected = (file: File | undefined) => {
    if (!file) {
      return;
    }

    void verifyFile(file);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      {!compact && (
        <div className="text-center">
          <h1 className="font-semibold text-2xl">
            <Trans>Verify document authenticity</Trans>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            <Trans>
              Upload a completed PDF from {appName} to check whether it was signed on this instance and has not been
              modified.
            </Trans>
          </p>
        </div>
      )}

      <button
        type="button"
        className={`flex min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-border border-dashed p-8 transition-colors ${
          isDragging ? 'border-primary bg-muted/50' : 'bg-background'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => {
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          onFileSelected(event.dataTransfer.files[0]);
        }}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        <FileUpIcon className="h-10 w-10 text-muted-foreground" />
        <p className="text-center font-medium text-sm">
          <Trans>Drop your signed PDF here, or click to browse</Trans>
        </p>
        <p className="text-center text-muted-foreground text-xs">
          <Trans>PDF only, up to 25MB. Files are not stored.</Trans>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            onFileSelected(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </button>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm">
          <Trans>Verifying signature…</Trans>
        </p>
      )}

      {error && <p className="text-center text-destructive text-sm">{error}</p>}

      {result && (
        <div className="rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            {statusIcon(result.status)}
            <div className="flex-1 space-y-2">
              <p className="font-medium">{result.summary}</p>

              {result.document && (
                <div className="space-y-1 text-muted-foreground text-sm">
                  <p>
                    <Trans>Document: {result.document.title}</Trans>
                  </p>
                  {result.document.shareUrl && (
                    <a className="text-primary underline" href={result.document.shareUrl}>
                      <Trans>View original in {APP_NAME()}</Trans>
                    </a>
                  )}
                </div>
              )}

              {result.signatures.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  <Trans>{result.signatures.length} signature(s) checked</Trans>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {qrToken && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            inputRef.current?.click();
          }}
          disabled={isLoading}
        >
          <Trans>Verify another copy</Trans>
        </Button>
      )}
    </div>
  );
};
