import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AcessoNegado() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const homeUrl = profile?.tipo === 'associado' ? '/app/home' : '/dashboard';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center px-4">
        <ShieldX className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para acessar esta página.
          Entre em contato com o administrador se precisar de acesso.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={() => navigate(homeUrl)}>
            <Home className="mr-2 h-4 w-4" />
            Ir para Início
          </Button>
        </div>
      </div>
    </div>
  );
}
