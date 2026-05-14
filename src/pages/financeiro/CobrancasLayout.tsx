import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, ListChecks } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

export default function CobrancasLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGerencia } = usePermissions();

  const isRegua = location.pathname.startsWith('/financeiro/cobrancas/regua');
  // Aba "Recuperados" desativada no menu — rota continua viva.
  const activeTab = isRegua ? 'regua' : 'faturas';

  const handleTabChange = (value: string) => {
    if (value === 'faturas') navigate('/financeiro/cobrancas');
    else if (value === 'regua') navigate('/financeiro/cobrancas/regua');
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full ${isGerencia ? 'max-w-xl grid-cols-2' : 'max-w-md grid-cols-1'}`}>
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
