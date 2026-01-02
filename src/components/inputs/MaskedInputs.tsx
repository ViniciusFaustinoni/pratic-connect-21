import * as React from 'react';
import { Input } from '@/components/ui/input';
import { maskCPF, maskTelefone, maskPlaca, maskCEP, maskCurrency, parseCurrency } from '@/lib/validations';
import { cn } from '@/lib/utils';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export function CpfInput({ value, onChange, className, ...props }: MaskedInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(maskCPF(e.target.value));
  };

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      placeholder="000.000.000-00"
      maxLength={14}
      className={cn(className)}
    />
  );
}

export function TelefoneInput({ value, onChange, className, ...props }: MaskedInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(maskTelefone(e.target.value));
  };

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      placeholder="(00) 00000-0000"
      maxLength={15}
      className={cn(className)}
    />
  );
}

export function PlacaInput({ value, onChange, className, ...props }: MaskedInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(maskPlaca(e.target.value));
  };

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      placeholder="ABC-1234"
      maxLength={8}
      className={cn('uppercase', className)}
    />
  );
}

interface CepInputProps extends MaskedInputProps {
  onCepComplete?: (cep: string) => void;
}

export function CepInput({ value, onChange, className, onCepComplete, ...props }: CepInputProps) {
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

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(
    value ? maskCurrency((value * 100).toString()) : ''
  );

  React.useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(maskCurrency((value * 100).toString()));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const masked = maskCurrency(rawValue);
    setDisplayValue(masked);
    onChange(parseCurrency(masked));
  };

  return (
    <Input
      {...props}
      value={displayValue}
      onChange={handleChange}
      placeholder="R$ 0,00"
      className={cn(className)}
    />
  );
}
