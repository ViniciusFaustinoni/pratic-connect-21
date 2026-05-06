import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldCheck, ArrowRightLeft, ShieldAlert, AlertTriangle, ClipboardList } from 'lucide-react';
import AprovacaoAssociados from './AcionamentosRouboFurto';
import AprovacoesTroca from './AprovacoesTroca';
import LiberacoesAutoVistoria from './LiberacoesAutoVistoria';
import RecusasInstalador from '../cadastro/RecusasInstalador';
import RessalvasPendentes from './RessalvasPendentes';
import ImprevistosPainel from './ImprevistosPainel';

type Aba = 'associados' | 'troca' | 'liberacao-suspensao' | 'recusas' | 'ressalvas' | 'imprevistos';

const ABAS: Aba[] = ['associados', 'troca', 'liberacao-suspensao', 'recusas', 'ressalvas', 'imprevistos'];

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
          Centraliza aprovação de associados, troca de titularidade, liberação de suspensão, recusas do instalador e ressalvas pendentes.
        </p>
      </div>

      <Tabs value={aba} onValueChange={handleChange}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
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
      </Tabs>
    </div>
  );
}
