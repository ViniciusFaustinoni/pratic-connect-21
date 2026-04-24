import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, ListChecks } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Layout unificado do módulo de Cobranças.
 * Abas no topo:
 *  - Faturas → /financeiro/cobrancas
 *  - Régua   → /financeiro/cobrancas/regua  (régua + emissão de cobranças)
 */
export default function CobrancasLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGerencia } = usePermissions();

  const isRegua = location.pathname.startsWith('/financeiro/cobrancas/regua');
  const activeTab = isRegua ? 'regua' : 'faturas';

  const handleTabChange = (value: string) => {
    if (value === 'faturas') navigate('/financeiro/cobrancas');
    else navigate('/financeiro/cobrancas/regua');
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
            <TabsTrigger value="regua" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Régua
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
      <Outlet />
    </div>
  );
}
