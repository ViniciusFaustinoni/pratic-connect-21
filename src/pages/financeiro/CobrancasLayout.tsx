import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, ListChecks, Send } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

export default function CobrancasLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGerencia } = usePermissions();

  const isRegua = location.pathname.startsWith('/financeiro/cobrancas/regua');
  const isEmissao = location.pathname.startsWith('/financeiro/cobrancas/emissao');
  const activeTab = isEmissao ? 'emissao' : isRegua ? 'regua' : 'faturas';

  const handleTabChange = (value: string) => {
    if (value === 'faturas') navigate('/financeiro/cobrancas');
    else if (value === 'regua') navigate('/financeiro/cobrancas/regua');
    else if (value === 'emissao') navigate('/financeiro/cobrancas/emissao');
  };

  const cols = isGerencia ? 'grid-cols-3 max-w-2xl' : 'grid-cols-1 max-w-md';

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full ${cols}`}>
          <TabsTrigger value="faturas" className="gap-2">
            <Receipt className="h-4 w-4" />
            Faturas
          </TabsTrigger>
          {isGerencia && (
            <>
              <TabsTrigger value="regua" className="gap-2">
                <ListChecks className="h-4 w-4" />
                Régua
              </TabsTrigger>
              <TabsTrigger value="emissao" className="gap-2">
                <Send className="h-4 w-4" />
                Emissão de Cobranças
              </TabsTrigger>
            </>
          )}
        </TabsList>
      </Tabs>
      <Outlet />
    </div>
  );
}
