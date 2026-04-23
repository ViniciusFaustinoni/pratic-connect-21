import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, Headset } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Layout unificado do módulo de Cobranças.
 * Contém duas abas no topo:
 *  - Faturas       → /financeiro/cobrancas (lista de boletos/faturas)
 *  - Recuperação   → /financeiro/cobrancas/recuperacao (dashboard, régua, acordos, etc)
 *
 * Cada aba é renderizada via <Outlet /> conforme rota filha.
 */
export default function CobrancasLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGerencia } = usePermissions();

  const isRecuperacao = location.pathname.startsWith('/financeiro/cobrancas/recuperacao');
  const activeTab = isRecuperacao ? 'recuperacao' : 'faturas';

  const handleTabChange = (value: string) => {
    if (value === 'faturas') navigate('/financeiro/cobrancas');
    else navigate('/financeiro/cobrancas/recuperacao');
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="faturas" className="gap-2">
            <Receipt className="h-4 w-4" />
            Faturas
          </TabsTrigger>
          {isGerencia && (
            <TabsTrigger value="recuperacao" className="gap-2">
              <Headset className="h-4 w-4" />
              Recuperação
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
      <Outlet />
    </div>
  );
}
