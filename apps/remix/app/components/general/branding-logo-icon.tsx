import type { LucideProps } from 'lucide-react';
import { HomeIcon } from 'lucide-react';

export type LogoProps = LucideProps;

export const BrandingLogoIcon = ({ 'aria-label': ariaLabel = 'Home', ...props }: LogoProps) => {
  return <HomeIcon aria-label={ariaLabel} {...props} />;
};
