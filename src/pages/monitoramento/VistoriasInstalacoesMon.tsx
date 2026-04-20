import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListChecks, Hand, History } from 'lucide-react';
import ServicosCampoUnificado from './ServicosCampoUnificado';
import { useConfigAtribuicaoManual } from '@/hooks/useAtribuicaoManual';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AlertaImprevistosPendentes from '@/components/monitoramento/AlertaImprevistosPendentes';

const AtribuicaoManualTab = lazy(() => import('@/components/monitoramento/AtribuicaoManualTab'));
const HistoricoAtribuicoesTab = lazy(() => import('@/components/monitoramento/HistoricoAtribuicoesTab'));

export default function VistoriasInstalacoesMon() {
  const { data: manualAtiva } = useConfigAtribuicaoManual();

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Serviços de Campo</h1>
        <p className="text-muted-foreground">
          Acompanhe instalações, vistorias, retiradas, encaixes, viagens e manutenções em um único painel
        </p>
      </div>

      <AlertaImprevistosPendentes />

      <Tabs defaultValue={manualAtiva ? 'atribuicao-manual' : 'servicos'} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-auto inline-flex">
            {manualAtiva && (
              <TabsTrigger value="atribuicao-manual" className="gap-2 shrink-0">
                <Hand className="h-4 w-4" />
                <span className="hidden sm:inline">Atribuição Manual</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="servicos" className="gap-2 shrink-0">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Serviços</span>
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

        <TabsContent value="servicos">
          <ServicosCampoUnificado />
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
