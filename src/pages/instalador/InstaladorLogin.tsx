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

  // Redirect if already logged in as instalador
  useEffect(() => {
    if (user && hasRole('instalador_vistoriador')) {
      navigate('/instalador', { replace: true });
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
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Email ou senha inválidos.');
        } else {
          setError(signInError.message);
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
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      {/* Header com Logo */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4 pt-12">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <Wrench className="h-12 w-12 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">PRATIC</h1>
            <p className="text-sm text-slate-400">App do Instalador</p>
          </div>
        </div>
      </div>

      {/* Card do Formulário */}
      <div className="w-full rounded-t-3xl bg-slate-800 px-6 pb-8 pt-6 shadow-2xl">
        <div className="mx-auto w-full max-w-sm">
          {/* Título */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-white">Acesse sua conta</h2>
            <p className="text-sm text-slate-400">Digite seu email e senha</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-800 bg-red-900/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
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
                className="h-12 border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Senha</Label>
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
                  className="h-12 border-slate-600 bg-slate-700/50 pr-12 text-white placeholder:text-slate-500"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 text-slate-400 hover:bg-transparent hover:text-white"
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
              className="h-12 w-full bg-blue-600 text-base font-semibold hover:bg-blue-700"
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
          <p className="mt-6 text-center text-xs text-slate-500">
            Versão 1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
