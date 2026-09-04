import { cn } from '@documenso/ui/lib/utils';
import { Trans } from '@lingui/react/macro';

const DOCUMENSO_URL = 'https://documenso.com';

export type ForkAttributionFooterProps = {
  className?: string;
};

export const ForkAttributionFooter = ({ className }: ForkAttributionFooterProps) => {
  return (
    <footer className={cn('flex justify-center px-4 py-3', className)}>
      <p className="text-[10px] text-muted-foreground/80">
        <Trans>
          Forked from{' '}
          <a
            href={DOCUMENSO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-muted-foreground"
          >
            Documenso
          </a>
        </Trans>
      </p>
    </footer>
  );
};
