import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListChecks, Hand, History, Map as MapIcon, ShieldOff, Ban } from 'lucide-react';
import ServicosCampoUnificado from './ServicosCampoUnificado';
import { useConfigAtribuicaoManual } from '@/hooks/useAtribuicaoManual';
import { useVeiculosSuspensos } from '@/hooks/useVeiculosSuspensos';
import { useVeiculosNegados } from '@/hooks/useVeiculosNegados';
import { Badge } from '@/components/ui/badge';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AlertaImprevistosPendentes from '@/components/monitoramento/AlertaImprevistosPendentes';

const AtribuicaoManualTab = lazy(() => import('@/components/monitoramento/AtribuicaoManualTab'));
const HistoricoAtribuicoesTab = lazy(() => import('@/components/monitoramento/HistoricoAtribuicoesTab'));
const VeiculosSuspensosTab = lazy(() => import('./VeiculosSuspensosTab'));
const VeiculosNegadosTab = lazy(() => import('./VeiculosNegadosTab'));
const MapaTab = lazy(() => import('./Mapa'));

export default function VistoriasInstalacoesMon() {
  const { data: manualAtiva } = useConfigAtribuicaoManual();
  const { data: suspensos } = useVeiculosSuspensos();
  const { data: negados } = useVeiculosNegados();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const defaultTab = tabFromUrl || (manualAtiva ? 'atribuicao-manual' : 'servicos');
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  return (
    <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 max-w-full overflow-x-hidden">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Serviços de Campo</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Acompanhe instalações, vistorias, retiradas, encaixes, viagens e manutenções em um único painel
        </p>
      </div>

      <AlertaImprevistosPendentes />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4 scrollbar-thin">
          <TabsList className="w-auto inline-flex h-9">

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
            <TabsTrigger value="suspensos" className="gap-2 shrink-0">
              <ShieldOff className="h-4 w-4" />
              <span className="hidden sm:inline">Veículos Suspensos</span>
              {suspensos && suspensos.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {suspensos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="negados" className="gap-2 shrink-0">
              <Ban className="h-4 w-4" />
              <span className="hidden sm:inline">Negados</span>
              {negados && negados.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {negados.length}
                </Badge>
              )}
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

        <TabsContent value="suspensos">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <VeiculosSuspensosTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="negados">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <VeiculosNegadosTab />
          </Suspense>
        </TabsContent>




        <TabsContent value="mapa">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <MapaTab />
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
