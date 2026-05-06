import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListChecks, Hand, History, Camera, Map as MapIcon } from 'lucide-react';
import ServicosCampoUnificado from './ServicosCampoUnificado';
import { useConfigAtribuicaoManual } from '@/hooks/useAtribuicaoManual';
import { useVistoriaLinksAguardandoAprovacao } from '@/hooks/useVistoriaLinkPublica';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AlertaImprevistosPendentes from '@/components/monitoramento/AlertaImprevistosPendentes';
import { Badge } from '@/components/ui/badge';

const AtribuicaoManualTab = lazy(() => import('@/components/monitoramento/AtribuicaoManualTab'));
const HistoricoAtribuicoesTab = lazy(() => import('@/components/monitoramento/HistoricoAtribuicoesTab'));
const AprovacaoFotosVistoriaTab = lazy(() => import('@/components/monitoramento/AprovacaoFotosVistoriaTab'));
const MapaTab = lazy(() => import('./Mapa'));

export default function VistoriasInstalacoesMon() {
  const { data: manualAtiva } = useConfigAtribuicaoManual();
  const { data: aprovacoesPendentes } = useVistoriaLinksAguardandoAprovacao();
  const totalAprovacoes = aprovacoesPendentes?.length || 0;
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const defaultTab = tabFromUrl || (manualAtiva ? 'atribuicao-manual' : 'servicos');
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Serviços de Campo</h1>
        <p className="text-muted-foreground">
          Acompanhe instalações, vistorias, retiradas, encaixes, viagens e manutenções em um único painel
        </p>
      </div>

      <AlertaImprevistosPendentes />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            <TabsTrigger value="mapa" className="gap-2 shrink-0">
              <MapIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Mapa</span>
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

        <TabsContent value="mapa">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <MapaTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="aprovacao-fotos">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <AprovacaoFotosVistoriaTab />
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
