import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApisLeadsTab } from '@/components/integracoes/ApisLeadsTab';

export default function IntegracaoFontesLeads() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/configuracoes/integracoes')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Fontes de Leads</h1>
            <p className="text-sm text-muted-foreground">
              Configure de onde seus leads serão recebidos via API
            </p>
          </div>
        </div>
      </div>

      <ApisLeadsTab />
    </div>
  );
}
