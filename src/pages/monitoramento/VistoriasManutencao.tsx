import { useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  ManutencaoMetricas, 
  ManutencaoFiltros, 
  ManutencaoTabela,
  AbrirManutencaoModal,
  AgendarManutencaoModal,
  RegistrarResultadoModal,
} from '@/components/monitoramento/manutencao';
import { 
  useVistoriasManutencao, 
  useVistoriasManutencaoMetricas,
  useCancelarVistoriaManutencao,
  useMarcarNaoCompareceu,
} from '@/hooks/useVistoriaManutencao';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/PermissionGate';
import type { ManutencaoFiltros as FiltrosType, VistoriaManutencao } from '@/types/vistoriaManutencao';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function VistoriasManutencao() {
  const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
  const canOpenManutencao = isDiretor || isCoordenadorMonitoramento;

  const [filtros, setFiltros] = useState<FiltrosType>({});
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalAgendar, setModalAgendar] = useState(false);
  const [modalResultado, setModalResultado] = useState(false);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<VistoriaManutencao | null>(null);
  const [dialogCancelar, setDialogCancelar] = useState(false);
  const [dialogNaoCompareceu, setDialogNaoCompareceu] = useState(false);

  const { data: vistorias, isLoading } = useVistoriasManutencao(filtros);
  const { data: metricas, isLoading: loadingMetricas } = useVistoriasManutencaoMetricas();
  const cancelarMutation = useCancelarVistoriaManutencao();
  const naoCompareceuMutation = useMarcarNaoCompareceu();

  const handleAgendar = (vistoria: VistoriaManutencao) => {
    setVistoriaSelecionada(vistoria);
    setModalAgendar(true);
  };

  const handleRegistrarResultado = (vistoria: VistoriaManutencao) => {
    setVistoriaSelecionada(vistoria);
    setModalResultado(true);
  };

  const handleCancelar = (vistoria: VistoriaManutencao) => {
    setVistoriaSelecionada(vistoria);
    setDialogCancelar(true);
  };

  const handleNaoCompareceu = (vistoria: VistoriaManutencao) => {
    setVistoriaSelecionada(vistoria);
    setDialogNaoCompareceu(true);
  };

  const confirmarCancelamento = async () => {
    if (!vistoriaSelecionada) return;
    await cancelarMutation.mutateAsync({ servicoId: vistoriaSelecionada.id });
    setDialogCancelar(false);
    setVistoriaSelecionada(null);
  };

  const confirmarNaoCompareceu = async () => {
    if (!vistoriaSelecionada) return;
    await naoCompareceuMutation.mutateAsync({ servicoId: vistoriaSelecionada.id });
    setDialogNaoCompareceu(false);
    setVistoriaSelecionada(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Vistorias de Manutenção
          </h1>
          <p className="text-muted-foreground">
            Gestão de manutenções de rastreadores instalados
          </p>
        </div>

        {canOpenManutencao && (
          <Button onClick={() => setModalAbrir(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Manutenção
          </Button>
        )}
      </div>

      {/* Métricas */}
      <ManutencaoMetricas metricas={metricas} isLoading={loadingMetricas} />

      {/* Filtros */}
      <ManutencaoFiltros filtros={filtros} onFiltrosChange={setFiltros} />

      {/* Tabela */}
      <ManutencaoTabela
        vistorias={vistorias}
        isLoading={isLoading}
        onAgendar={handleAgendar}
        onRegistrarResultado={handleRegistrarResultado}
        onMarcarNaoCompareceu={handleNaoCompareceu}
        onCancelar={handleCancelar}
      />

      {/* Modais */}
      <AbrirManutencaoModal open={modalAbrir} onOpenChange={setModalAbrir} />
      
      <AgendarManutencaoModal 
        open={modalAgendar} 
        onOpenChange={setModalAgendar}
        vistoria={vistoriaSelecionada}
      />
      
      <RegistrarResultadoModal 
        open={modalResultado} 
        onOpenChange={setModalResultado}
        vistoria={vistoriaSelecionada}
      />

      {/* Dialog Cancelar */}
      <AlertDialog open={dialogCancelar} onOpenChange={setDialogCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Manutenção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar a vistoria de manutenção e o rastreador voltará ao status "instalado".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCancelamento}>
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Não Compareceu */}
      <AlertDialog open={dialogNaoCompareceu} onOpenChange={setDialogNaoCompareceu}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Não Compareceu?</AlertDialogTitle>
            <AlertDialogDescription>
              O associado não compareceu em 48h. As proteções (roubo, furto e colisão) serão SUSPENSAS conforme regulamento 5.12.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarNaoCompareceu}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Suspender Proteção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
