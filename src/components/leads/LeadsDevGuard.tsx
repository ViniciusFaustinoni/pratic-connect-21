import { useNavigate } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

interface LeadsDevGuardProps {
  children: React.ReactNode;
}

export function LeadsDevGuard({ children }: LeadsDevGuardProps) {
  const { isDiretor, isAdminMaster, isDesenvolvedor } = usePermissions();
  const navigate = useNavigate();

  const hasAccess = isDiretor || isAdminMaster || isDesenvolvedor;

  if (!hasAccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <Construction className="h-10 w-10 text-amber-500" />
          </div>
          
          <div className="space-y-2">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
              Em Desenvolvimento
            </Badge>
            <h2 className="text-xl font-semibold text-foreground">
              Módulo em Desenvolvimento
            </h2>
            <p className="text-muted-foreground">
              Este módulo está em desenvolvimento e será disponibilizado em breve.
            </p>
          </div>

          <Button variant="outline" onClick={() => navigate('/vendas/planos-beneficios')}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
