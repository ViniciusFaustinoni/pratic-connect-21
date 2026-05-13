import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ArrowRightLeft, ShieldAlert, AlertTriangle, ClipboardList } from 'lucide-react';
import AprovacaoAssociados from './AcionamentosRouboFurto';
import AprovacoesTroca from './AprovacoesTroca';
import LiberacoesAutoVistoria from './LiberacoesAutoVistoria';
import RecusasInstalador from '../cadastro/RecusasInstalador';
import RessalvasPendentes from './RessalvasPendentes';
import ImprevistosPainel from './ImprevistosPainel';
import { useAprovacoesMonitoramentoBreakdown } from '@/hooks/useAprovacoesMonitoramentoCount';

type Aba = 'associados' | 'troca' | 'liberacao-suspensao' | 'recusas' | 'ressalvas' | 'imprevistos';

const ABAS: Aba[] = ['associados', 'troca', 'liberacao-suspensao', 'recusas', 'ressalvas', 'imprevistos'];

function CountBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-primary/15 text-primary border-primary/30">
      {n}
    </Badge>
  );
}

export default function AprovacoesUnificadas() {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = location.hash.replace('#', '') as Aba;
  const [aba, setAba] = useState<Aba>(ABAS.includes(initial) ? initial : 'associados');

  const handleChange = (v: string) => {
    setAba(v as Aba);
    navigate(`${location.pathname}#${v}`, { replace: true });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Aprovações do Monitoramento
        </h1>
        <p className="text-muted-foreground">
          Centraliza aprovação de associados, troca de titularidade, liberação de suspensão, recusas do instalador, ressalvas pendentes e imprevistos.
        </p>
      </div>

      <Tabs value={aba} onValueChange={handleChange}>
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full h-auto gap-1 p-1">
          <TabsTrigger value="associados" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Aprovação de Associados</span>
            <span className="sm:hidden">Associados</span>
          </TabsTrigger>
          <TabsTrigger value="troca" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Troca de Titularidade</span>
            <span className="sm:hidden">Troca</span>
          </TabsTrigger>
          <TabsTrigger value="liberacao-suspensao" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Liberação de Suspensão</span>
            <span className="sm:hidden">Liberação</span>
          </TabsTrigger>
          <TabsTrigger value="recusas" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Recusas do Instalador</span>
            <span className="sm:hidden">Recusas</span>
          </TabsTrigger>
          <TabsTrigger value="ressalvas" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Ressalvas Pendentes</span>
            <span className="sm:hidden">Ressalvas</span>
          </TabsTrigger>
          <TabsTrigger value="imprevistos" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Imprevistos</span>
            <span className="sm:hidden">Imprev.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="associados" className="pt-2">
          <AprovacaoAssociados />
        </TabsContent>
        <TabsContent value="troca" className="pt-2">
          <AprovacoesTroca />
        </TabsContent>
        <TabsContent value="liberacao-suspensao" className="pt-2">
          <LiberacoesAutoVistoria />
        </TabsContent>
        <TabsContent value="recusas" className="pt-2">
          <RecusasInstalador />
        </TabsContent>
        <TabsContent value="ressalvas" className="pt-2">
          <RessalvasPendentes />
        </TabsContent>
        <TabsContent value="imprevistos" className="pt-2">
          <ImprevistosPainel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
