import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================
type FormState = 'idle' | 'loading' | 'success' | 'error';

type FormError = 
  | 'email_required'
  | 'email_invalid'
  | 'rate_limit'
  | 'unknown_error';

// ============================================
// CONSTANTES
// ============================================
const ERROR_MESSAGES: Record<FormError, string> = {
  email_required: 'Por favor, informe seu e-mail',
  email_invalid: 'E-mail inválido',
  rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
  unknown_error: 'Erro ao enviar. Tente novamente.',
};

// ============================================
// COMPONENTE
// ============================================
export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<FormError | null>(null);

  // ============================================
  // VALIDAÇÃO
  // ============================================
  const validateEmail = (): boolean => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setError('email_required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('email_invalid');
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

    if (!validateEmail()) return;

    setFormState('loading');

    try {
      const result = await resetPassword(email.trim().toLowerCase());

      // Sempre mostrar sucesso (segurança - não revelar se email existe)
      if (!result.success) {
        if (result.error?.includes('rate limit') || result.error?.includes('Too many')) {
          setError('rate_limit');
          setFormState('error');
          return;
        }
      }

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
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError(null);
    if (formState === 'error') setFormState('idle');
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      {/* LOGO E TÍTULO */}
      <div className="flex flex-col items-center mb-8">
        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">SGA PRATIC</h1>
        <p className="text-muted-foreground text-sm">Sistema de Gestão de Associados</p>
      </div>

      {/* CARD */}
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Recuperar Senha</CardTitle>
          <CardDescription>
            Digite seu e-mail para receber o link de recuperação
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ALERTA DE ERRO */}
          {formState === 'error' && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{ERROR_MESSAGES[error]}</AlertDescription>
            </Alert>
          )}

          {/* ALERTA DE SUCESSO */}
          {formState === 'success' && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <span className="font-medium">Solicitação enviada!</span>
                <br />
                Se este e-mail estiver cadastrado, você receberá as instruções para recuperação.
              </AlertDescription>
            </Alert>
          )}

          {/* FORMULÁRIO */}
          {formState !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* CAMPO EMAIL */}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@pratic.com.br"
                    value={email}
                    onChange={handleEmailChange}
                    disabled={formState === 'loading'}
                    className={cn(
                      "pl-10 h-11",
                      error && "border-destructive focus-visible:ring-destructive"
                    )}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {/* BOTÃO ENVIAR */}
              <Button 
                type="submit" 
                className="w-full h-11" 
                disabled={formState === 'loading'}
              >
                {formState === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
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
              className="w-full h-11"
              onClick={() => {
                setFormState('idle');
                setEmail('');
              }}
            >
              Tentar outro e-mail
            </Button>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>

      {/* FOOTER */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} PRATIC Proteção Veicular
        </p>
      </div>
    </div>
  );
}
