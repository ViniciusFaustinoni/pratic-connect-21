import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, User, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================
type FormState = 'idle' | 'loading' | 'success' | 'error';

type FormError = 
  | 'cpf_required'
  | 'cpf_invalid'
  | 'rate_limit'
  | 'unknown_error';

// ============================================
// CONSTANTES
// ============================================
const ERROR_MESSAGES: Record<FormError, string> = {
  cpf_required: 'Por favor, informe seu CPF',
  cpf_invalid: 'CPF inválido',
  rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
  unknown_error: 'Erro ao enviar. Tente novamente.',
};

// ============================================
// UTILS - MÁSCARA DE CPF
// ============================================
const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

const unformatCPF = (cpf: string): string => {
  return cpf.replace(/\D/g, '');
};

const isValidCPF = (cpf: string): boolean => {
  const numbers = unformatCPF(cpf);
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[10])) return false;
  
  return true;
};

// ============================================
// COMPONENTE
// ============================================
export default function AppForgotPassword() {
  const [cpf, setCpf] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<FormError | null>(null);

  // ============================================
  // VALIDAÇÃO
  // ============================================
  const validateCpf = (): boolean => {
    const cpfNumbers = unformatCPF(cpf);
    
    if (!cpfNumbers) {
      setError('cpf_required');
      return false;
    }

    if (!isValidCPF(cpf)) {
      setError('cpf_invalid');
      return false;
    }

    return true;
  };

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateCpf()) return;

    setFormState('loading');

    try {
      const cpfNumbers = unformatCPF(cpf);
      
      // 1. Buscar email pelo CPF na tabela associados
      const { data: associado } = await supabase
        .from('associados')
        .select('email')
        .eq('cpf', cpfNumbers)
        .single();

      // Sempre mostrar sucesso (segurança - não revelar se CPF existe)
      if (associado?.email) {
        // Se encontrou, enviar email de reset
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          associado.email,
          {
            redirectTo: `${window.location.origin}/app/redefinir-senha`,
          }
        );

        if (resetError) {
          if (resetError.message.includes('rate limit') || resetError.message.includes('Too many')) {
            setError('rate_limit');
            setFormState('error');
            return;
          }
        }
      }

      // Sucesso (mesmo se CPF não existe - segurança)
      setFormState('success');

    } catch (err) {
      console.error('Unexpected error:', err);
      // Mesmo em erro, mostrar sucesso por segurança
      setFormState('success');
    }
  };

  // ============================================
  // HANDLER INPUT
  // ============================================
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    if (error) setError(null);
    if (formState === 'error') setFormState('idle');
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-primary/80">

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">

        {/* ============================================ */}
        {/* ÁREA SUPERIOR - LOGO */}
        {/* ============================================ */}
        <div className="mb-8 flex flex-col items-center">

          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-background/10 backdrop-blur-sm">
            <Shield className="h-10 w-10 text-primary-foreground" />
          </div>

          <h1 className="text-2xl font-bold text-primary-foreground">
            PRATIC
          </h1>

          <p className="text-sm text-primary-foreground/80">
            Proteção Veicular
          </p>

        </div>

        {/* ============================================ */}
        {/* CARD */}
        {/* ============================================ */}
        <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">

          <h2 className="mb-2 text-center text-xl font-semibold text-foreground">
            Recuperar Senha
          </h2>

          <p className="mb-6 text-center text-sm text-muted-foreground">
            Digite seu CPF para receber o link de recuperação
          </p>

          {/* ALERTA DE ERRO */}
          {formState === 'error' && error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{ERROR_MESSAGES[error]}</AlertDescription>
            </Alert>
          )}

          {/* ALERTA DE SUCESSO */}
          {formState === 'success' && (
            <Alert className="mb-4 border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Solicitação enviada!</strong>
                <br />
                Se este CPF estiver cadastrado, você receberá um e-mail com instruções.
              </AlertDescription>
            </Alert>
          )}

          {/* FORMULÁRIO */}
          {formState !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* CAMPO CPF */}
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-medium">
                  CPF
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="cpf"
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    disabled={formState === 'loading'}
                    className={cn(
                      "h-12 pl-10 text-lg tracking-wide",
                      error && "border-destructive focus-visible:ring-destructive"
                    )}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>

              {/* BOTÃO ENVIAR */}
              <Button
                type="submit"
                className="h-12 w-full text-base font-semibold"
                disabled={formState === 'loading'}
              >
                {formState === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Link'
                )}
              </Button>
            </form>
          )}

          {/* BOTÃO TENTAR NOVAMENTE */}
          {formState === 'success' && (
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => {
                setFormState('idle');
                setCpf('');
              }}
            >
              Tentar outro CPF
            </Button>
          )}

          {/* LINK VOLTAR */}
          <Link
            to="/app/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </div>

        {/* SPACER */}
        <div className="h-12" />

      </div>

    </div>
  );
}
