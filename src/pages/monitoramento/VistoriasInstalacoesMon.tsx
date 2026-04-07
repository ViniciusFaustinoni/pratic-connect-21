import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, ClipboardCheck, Puzzle, Truck, PackageX, Hand, History, Settings } from 'lucide-react';
import Instalacoes from './Instalacoes';
import Vistorias from './Vistorias';
import MonitoramentoEncaixes from './Encaixes';
import ViagensTab from './ViagensTab';
import RetiradasContent from './RetiradasContent';
import { useConfigAtribuicaoManual } from '@/hooks/useAtribuicaoManual';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const AtribuicaoManualTab = lazy(() => import('@/components/monitoramento/AtribuicaoManualTab'));
const HistoricoAtribuicoesTab = lazy(() => import('@/components/monitoramento/HistoricoAtribuicoesTab'));
const ManutencaoRastreadoresTab = lazy(() => import('@/components/monitoramento/manutencao-rastreadores/ManutencaoRastreadoresTab'));

export default function VistoriasInstalacoesMon() {
  const { data: manualAtiva } = useConfigAtribuicaoManual();

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Serviços de Campo</h1>
        <p className="text-muted-foreground">
          Acompanhe instalações, vistorias, retiradas e encaixes em um único painel
        </p>
      </div>

      <Tabs defaultValue={manualAtiva ? 'atribuicao-manual' : 'instalacoes'} className="w-full">
        <TabsList>
          {manualAtiva && (
            <TabsTrigger value="atribuicao-manual" className="gap-2">
              <Hand className="h-4 w-4" />
              Atribuição Manual
            </TabsTrigger>
          )}
          <TabsTrigger value="instalacoes" className="gap-2">
            <Wrench className="h-4 w-4" />
            Instalações
          </TabsTrigger>
          <TabsTrigger value="vistorias" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Vistorias
          </TabsTrigger>
          <TabsTrigger value="retiradas" className="gap-2">
            <PackageX className="h-4 w-4" />
            Retiradas
          </TabsTrigger>
          <TabsTrigger value="encaixes" className="gap-2">
            <Puzzle className="h-4 w-4" />
            Encaixes
          </TabsTrigger>
          <TabsTrigger value="viagens" className="gap-2">
            <Truck className="h-4 w-4" />
            Viagens
          </TabsTrigger>
          <TabsTrigger value="manutencao" className="gap-2">
            <Settings className="h-4 w-4" />
            Manutenção
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {manualAtiva && (
          <TabsContent value="atribuicao-manual">
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <AtribuicaoManualTab />
            </Suspense>
          </TabsContent>
        )}

        <TabsContent value="instalacoes">
          <Instalacoes />
        </TabsContent>

        <TabsContent value="vistorias">
          <Vistorias />
        </TabsContent>

        <TabsContent value="retiradas">
          <RetiradasContent />
        </TabsContent>

        <TabsContent value="encaixes">
          <MonitoramentoEncaixes embedded />
        </TabsContent>

        <TabsContent value="viagens">
          <ViagensTab />
        </TabsContent>

        <TabsContent value="manutencao">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <ManutencaoRastreadoresTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="historico">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <HistoricoAtribuicoesTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
