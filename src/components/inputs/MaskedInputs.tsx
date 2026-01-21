import * as React from 'react';
import { Input } from '@/components/ui/input';
import { maskCPF, maskTelefone, maskPlaca, maskCEP, maskCNPJ, maskCurrency, parseCurrency } from '@/lib/validations';
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

export function CnpjInput({ value, onChange, className, ...props }: MaskedInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(maskCNPJ(e.target.value));
  };

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      placeholder="00.000.000/0000-00"
      maxLength={18}
      className={cn(className)}
    />
  );
}

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  // Formatar valor para exibição usando Intl.NumberFormat (mais robusto)
  const displayValue = React.useMemo(() => {
    if (!value || value === 0) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Extrair apenas dígitos
    const rawValue = e.target.value.replace(/\D/g, '');
    
    // Limitar a 8 dígitos (máximo R$ 999.999,99)
    const limitedValue = rawValue.slice(0, 8);
    
    // Converter centavos para reais
    const numericValue = parseInt(limitedValue || '0', 10) / 100;
    
    onChange(numericValue);
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
