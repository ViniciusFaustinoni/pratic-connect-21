import * as React from 'react';
import { Input } from '@/components/ui/input';
import { maskCPF, maskTelefone, maskPlaca, maskCEP, maskCNPJ } from '@/lib/validations';
import { cn } from '@/lib/utils';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export const CpfInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(maskCPF(e.target.value));
    };

    return (
      <Input
        ref={ref}
        {...props}
        value={value}
        onChange={handleChange}
        placeholder="000.000.000-00"
        maxLength={14}
        className={cn(className)}
      />
    );
  }
);

CpfInput.displayName = 'CpfInput';

export const TelefoneInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(maskTelefone(e.target.value));
    };

    return (
      <Input
        ref={ref}
        {...props}
        value={value}
        onChange={handleChange}
        placeholder="(00) 00000-0000"
        maxLength={15}
        className={cn(className)}
      />
    );
  }
);

TelefoneInput.displayName = 'TelefoneInput';

export const PlacaInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(maskPlaca(e.target.value));
    };

    return (
      <Input
        ref={ref}
        {...props}
        value={value}
        onChange={handleChange}
        placeholder="ABC-1234"
        maxLength={8}
        className={cn('uppercase', className)}
      />
    );
  }
);

PlacaInput.displayName = 'PlacaInput';

interface CepInputProps extends MaskedInputProps {
  onCepComplete?: (cep: string) => void;
}

export const CepInput = React.forwardRef<HTMLInputElement, CepInputProps>(
  ({ value, onChange, className, onCepComplete, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(maskCEP(e.target.value));
    };

    const handleBlur = () => {
      if (value && value.length === 9 && onCepComplete) {
        onCepComplete(value);
      }
    };

    return (
      <Input
        ref={ref}
        {...props}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="00000-000"
        maxLength={9}
        className={cn(className)}
      />
    );
  }
);

CepInput.displayName = 'CepInput';

export const CnpjInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(maskCNPJ(e.target.value));
    };

    return (
      <Input
        ref={ref}
        {...props}
        value={value}
        onChange={handleChange}
        placeholder="00.000.000/0000-00"
        maxLength={18}
        className={cn(className)}
      />
    );
  }
);

CnpjInput.displayName = 'CnpjInput';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const displayValue = React.useMemo(() => {
      if (!value || value === 0) return '';
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      const limitedValue = rawValue.slice(0, 8);
      const numericValue = parseInt(limitedValue || '0', 10) / 100;

      onChange(numericValue);
    };

    return (
      <Input
        ref={ref}
        {...props}
        value={displayValue}
        onChange={handleChange}
        placeholder="R$ 0,00"
        className={cn(className)}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
