import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wrench, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Email inválido');

export default function InstaladorLogin() {
  const navigate = useNavigate();
  const { user, hasRole, signIn, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user && hasRole('instalador_vistoriador')) {
      navigate('/instalador', { replace: true });
    }
    if (user && hasRole('analista_eventos' as any)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, hasRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError('Email inválido.');
      return;
    }

    if (!password) {
      setError('Digite sua senha.');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn({ email, password });

      if (!result.success) {
        const errorMessage = result.error || 'Erro ao fazer login';
        if (errorMessage.includes('incorretos') || errorMessage.includes('Invalid')) {
          setError('Email ou senha inválidos.');
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-2xl bg-blue-500/20 blur-xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
              <Wrench className="h-10 w-10 text-white" />
            </div>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f172a]">
      {/* Gradient Background Effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Header com Logo */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-16">
        <div className="flex flex-col items-center gap-5">
          {/* Logo Icon com Glow Effect */}
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-2xl bg-blue-500/30 blur-xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl shadow-blue-500/30 transition-transform hover:scale-105">
              <Wrench className="h-12 w-12 text-white drop-shadow-lg" />
            </div>
          </div>
          
          {/* Branding */}
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              PRATIC
            </h1>
            <p className="mt-1 text-sm font-medium text-blue-400">
              App do Instalador
            </p>
          </div>
        </div>
      </div>

      {/* Card do Formulário */}
      <div className="relative w-full rounded-t-[2rem] bg-[#1e293b] px-6 pb-10 pt-8 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
        {/* Handle Decorativo */}
        <div className="absolute left-1/2 top-3 h-1 w-12 -translate-x-1/2 rounded-full bg-slate-600" />
        
        <div className="mx-auto w-full max-w-sm">
          {/* Título */}
          <div className="mb-8 text-center">
            <h2 className="text-xl font-semibold text-white">
              Acesse sua conta
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Digite seu email e senha
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                disabled={loading}
                className="h-12 rounded-xl border-slate-600/50 bg-slate-700/50 text-white transition-all placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  className="h-12 rounded-xl border-slate-600/50 bg-slate-700/50 pr-12 text-white transition-all placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg text-slate-400 hover:bg-slate-600/50 hover:text-slate-300"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-base font-semibold shadow-lg shadow-blue-500/25 transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-blue-500/40 active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Versão */}
          <p className="mt-8 text-center text-xs text-slate-500">
            Versão 1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
