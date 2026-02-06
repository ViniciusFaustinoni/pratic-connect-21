import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// Importar todas as variantes de logo
import logoFullLight from '@/assets/logos/logo-full-light.png';
import logoFullDark from '@/assets/logos/logo-full-dark.png';
import logoIconLight from '@/assets/logos/logo-icon-light.png';
import logoIconDark from '@/assets/logos/logo-icon-dark.png';

interface LogoProps {
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark' | 'auto';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-20',
};

const iconSizeClasses = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

export function Logo({ 
  variant = 'full', 
  theme = 'auto', 
  size = 'md',
  className 
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  
  // Determinar tema efetivo
  const effectiveTheme = theme === 'auto' 
    ? (resolvedTheme === 'dark' ? 'dark' : 'light')
    : theme;

  // Selecionar a imagem correta baseado na variante e tema
  const getLogoSrc = () => {
    if (variant === 'icon') {
      return effectiveTheme === 'dark' ? logoIconDark : logoIconLight;
    }
    return effectiveTheme === 'dark' ? logoFullDark : logoFullLight;
  };

  const sizeClass = variant === 'icon' 
    ? iconSizeClasses[size] 
    : sizeClasses[size];

  return (
    <img 
      src={getLogoSrc()} 
      alt="PRATIC Car" 
      className={cn(sizeClass, 'w-auto object-contain', className)}
    />
  );
}

// Versão para uso em fundos específicos (sem detecção automática de tema)
export function LogoLight({ variant = 'full', size = 'md', className }: Omit<LogoProps, 'theme'>) {
  return <Logo variant={variant} theme="light" size={size} className={className} />;
}

export function LogoDark({ variant = 'full', size = 'md', className }: Omit<LogoProps, 'theme'>) {
  return <Logo variant={variant} theme="dark" size={size} className={className} />;
}

// Para uso em contextos sem ThemeProvider (como PDFs)
export const LOGO_URLS = {
  fullLight: '/logos/logo-full-light.png',
  fullDark: '/logos/logo-full-dark.png',
  iconLight: '/logos/logo-icon-light.png',
  iconDark: '/logos/logo-icon-dark.png',
} as const;
