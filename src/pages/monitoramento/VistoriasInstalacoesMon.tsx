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
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-auto inline-flex">
            {manualAtiva && (
              <TabsTrigger value="atribuicao-manual" className="gap-2 shrink-0">
                <Hand className="h-4 w-4" />
                <span className="hidden sm:inline">Atribuição Manual</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="instalacoes" className="gap-2 shrink-0">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Instalações</span>
            </TabsTrigger>
            <TabsTrigger value="vistorias" className="gap-2 shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Vistorias</span>
            </TabsTrigger>
            <TabsTrigger value="retiradas" className="gap-2 shrink-0">
              <PackageX className="h-4 w-4" />
              <span className="hidden sm:inline">Retiradas</span>
            </TabsTrigger>
            <TabsTrigger value="encaixes" className="gap-2 shrink-0">
              <Puzzle className="h-4 w-4" />
              <span className="hidden sm:inline">Encaixes</span>
            </TabsTrigger>
            <TabsTrigger value="viagens" className="gap-2 shrink-0">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Viagens</span>
            </TabsTrigger>
            <TabsTrigger value="manutencao" className="gap-2 shrink-0">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Manutenção</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2 shrink-0">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>
        </div>

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
