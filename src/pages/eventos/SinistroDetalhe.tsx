import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, FileText, Wrench, MapPin, Radio, Navigation } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteSinistro } from '@/hooks/useSinistros';
import { useTerceiros } from '@/hooks/useTerceiros';
import { ConfirmacaoExclusaoDialog } from '@/components/sinistros/ConfirmacaoExclusaoDialog';
import { ModalVincularProcesso } from '@/components/sinistros/ModalVincularProcesso';
import { SolicitarDocumentosSinistroDialog } from '@/components/sinistros/SolicitarDocumentosSinistroDialog';
import { AtualizarStatusModal } from '@/components/eventos/AtualizarStatusModal';
import { AgendarVistoriaModal } from '@/components/eventos/AgendarVistoriaModal';
import { EmitirParecerModal } from '@/components/eventos/EmitirParecerModal';
import { ConversaIADialog } from '@/components/sinistros/ConversaIADialog';
import { AcionarRecuperacaoModal } from '@/components/sinistros/AcionarRecuperacaoModal';
import { IniciarIndenizacaoModal } from '@/components/sinistros/IniciarIndenizacaoModal';
import { EncaminharSindicanciaDialog } from '@/components/sinistros/EncaminharSindicanciaDialog';
import { EncaminharJuridicoEventoModal } from '@/components/sinistros/EncaminharJuridicoEventoModal';
import { AtribuirFornecedoresDialog } from '@/components/sinistros/AtribuirFornecedoresDialog';
import { TimelineEventoTab } from '@/components/sinistros/TimelineEventoTab';
import { MapaRastreador } from '@/components/rastreadores/MapaRastreador';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { STATUS_SINISTRO_LABELS, STATUS_SINISTRO_COLORS } from '@/types/sinistros';

import { SinistroDetalheHeader } from '@/components/sinistros/detalhe/SinistroDetalheHeader';
import { SinistroDetalheQuickStats } from '@/components/sinistros/detalhe/SinistroDetalheQuickStats';
import { SinistroDetalheInfo } from '@/components/sinistros/detalhe/SinistroDetalheInfo';
import { SinistroDetalheReparo } from '@/components/sinistros/detalhe/SinistroDetalheReparo';
import { SinistroDetalheDocs } from '@/components/sinistros/detalhe/SinistroDetalheDocs';
import { SinistroDetalheGPS } from '@/components/sinistros/detalhe/SinistroDetalheGPS';
import { SinistroDetalheSidebar } from '@/components/sinistros/detalhe/SinistroDetalheSidebar';

const statusConfig: Record<string, { label: string; class: string }> = Object.fromEntries(
  Object.entries(STATUS_SINISTRO_LABELS).map(([key, label]) => [
    key,
    { label, class: STATUS_SINISTRO_COLORS[key as keyof typeof STATUS_SINISTRO_COLORS] || 'bg-gray-100 text-gray-800' }
  ])
);

const handleWhatsApp = (phone: string | null) => {
  if (!phone) return;
  const cleaned = phone.replace(/\D/g, '');
  window.open(`https://wa.me/55${cleaned}`, '_blank');
};

const tiposComRastreador = ['roubo', 'furto', 'colisao', 'colisao_parcial', 'colisao_total'];

export default function SinistroDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalVincularOpen, setModalVincularOpen] = useState(false);
  const [modalStatusOpen, setModalStatusOpen] = useState(false);
  const [modalVistoriaOpen, setModalVistoriaOpen] = useState(false);
  const [modalParecerOpen, setModalParecerOpen] = useState(false);
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [modalConversaOpen, setModalConversaOpen] = useState(false);
  const [modalSolicitarDocsOpen, setModalSolicitarDocsOpen] = useState(false);
  const [modalAcionamentoOpen, setModalAcionamentoOpen] = useState(false);
  const [mapaLocalizacaoOpen, setMapaLocalizacaoOpen] = useState(false);
  const [modalIndenizacaoOpen, setModalIndenizacaoOpen] = useState(false);
  const [modalSindicanciaOpen, setModalSindicanciaOpen] = useState(false);
  const [modalJuridicoOpen, setModalJuridicoOpen] = useState(false);
  const [showAtribuirFornecedores, setShowAtribuirFornecedores] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { isDiretor, isAnalistaEventosOnly, isRegulador } = usePermissions();

  const openModalSafely = (setter: (v: boolean) => void) => {
    setDropdownOpen(false);
    setTimeout(() => setter(true), 150);
  };
  const deleteSinistro = useDeleteSinistro();

  // ============= QUERIES =============
  const { data: sinistro, isLoading } = useQuery({
    queryKey: ['sinistro', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          *,
          associado:associados(
            id, nome, cpf, telefone, whatsapp, email,
            logradouro, numero, bairro, cidade, uf
          ),
          veiculo:veiculos(
            id, placa, marca, modelo, ano_modelo, cor, 
            chassi, valor_fipe, codigo_fipe, renavam
          ),
          analista:profiles!sinistros_analista_id_fkey(id, nome),
          sindicante:profiles!sinistros_sindicante_id_fkey(id, nome)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: terceirosData = [] } = useTerceiros(id);

  const { data: historico } = useQuery({
    queryKey: ['sinistro-historico', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_historico')
        .select(`*, usuario:profiles!sinistro_historico_usuario_id_fkey(nome)`)
        .eq('sinistro_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documentos } = useQuery({
    queryKey: ['sinistro-documentos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_documentos')
        .select('*')
        .eq('sinistro_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: processosVinculados = [] } = useQuery({
    queryKey: ['processos-sinistro', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select(`
          id, numero, numero_processo, tipo, natureza, status, fase, vara, comarca,
          advogado:advogados(id, nome)
        `)
        .eq('sinistro_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: solicitacaoIA } = useQuery({
    queryKey: ['sinistro-solicitacao-ia', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select('*')
        .eq('resultado_id', id!)
        .eq('tipo', 'sinistro')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: mensagensChat } = useQuery({
    queryKey: ['sinistro-chat-mensagens', sinistro?.associado_id, solicitacaoIA?.created_at],
    queryFn: async () => {
      if (!sinistro?.associado_id) return [];
      const solicitacaoDate = solicitacaoIA?.created_at ? new Date(solicitacaoIA.created_at) : new Date();
      const startDate = new Date(solicitacaoDate);
      startDate.setHours(startDate.getHours() - 24);
      const { data, error } = await supabase
        .from('chat_mensagens_ia')
        .select('*')
        .eq('associado_id', sinistro.associado_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', solicitacaoDate.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistro?.associado_id && !!solicitacaoIA,
  });

  const { data: vistoriaEvento } = useQuery({
    queryKey: ['sinistro-vistoria-evento', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('vistorias_evento')
        .select('*')
        .eq('sinistro_id', id!)
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: rastreadorVeiculo } = useQuery({
    queryKey: ['sinistro-rastreador-veiculo', sinistro?.veiculo_id],
    queryFn: async () => {
      if (!sinistro?.veiculo_id) return null;
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, status, ultima_posicao_lat, ultima_posicao_lng')
        .eq('veiculo_id', sinistro.veiculo_id)
        .eq('status', 'instalado')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sinistro?.veiculo_id && tiposComRastreador.includes(sinistro?.tipo || ''),
  });

  const descricaoCliente = useMemo(() => {
    if (!mensagensChat || mensagensChat.length === 0) return null;
    const mensagensUsuario = mensagensChat
      .filter(m => m.role === 'user')
      .filter(m => {
        const content = m.content?.toLowerCase() || '';
        return content.length > 20 &&
          !content.match(/^(sim|não|nao|ok|já|ja|certo|isso|entendi|blz|beleza)\.?$/);
      })
      .map(m => m.content);
    return mensagensUsuario.length > 0 ? mensagensUsuario.join('\n\n') : null;
  }, [mensagensChat]);

  // ============= LOADING / NOT FOUND =============
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-40" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!sinistro) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Sinistro não encontrado</h2>
        <Button onClick={() => navigate('/eventos/sinistros')}>Voltar para lista</Button>
      </div>
    );
  }

  const statusInfo = statusConfig[sinistro.status] || { label: sinistro.status, class: 'bg-gray-100 text-gray-800' };

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <SinistroDetalheHeader
        sinistro={sinistro}
        statusInfo={statusInfo}
        isDiretor={isDiretor}
        isAnalistaEventosOnly={isAnalistaEventosOnly}
        dropdownOpen={dropdownOpen}
        setDropdownOpen={setDropdownOpen}
        onNavigateBack={() => navigate('/eventos/sinistros')}
        onNavigate={navigate}
        openModalSafely={openModalSafely}
        setModalStatusOpen={setModalStatusOpen}
        setModalVistoriaOpen={setModalVistoriaOpen}
        setModalParecerOpen={setModalParecerOpen}
        setModalSindicanciaOpen={setModalSindicanciaOpen}
        setModalAcionamentoOpen={setModalAcionamentoOpen}
        setModalExcluirOpen={setModalExcluirOpen}
        setModalVincularOpen={setModalVincularOpen}
        setModalJuridicoOpen={setModalJuridicoOpen}
        setShowAtribuirFornecedores={setShowAtribuirFornecedores}
        handleWhatsApp={handleWhatsApp}
      />

      {/* Quick Stats */}
      <SinistroDetalheQuickStats sinistro={sinistro} />

      {/* Main Content: Tabs + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabs - Left */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full grid grid-cols-5 h-11">
              <TabsTrigger value="info" className="text-xs sm:text-sm gap-1">
                <FileText className="h-3.5 w-3.5 hidden sm:block" /> Informações
              </TabsTrigger>
              <TabsTrigger value="reparo" className="text-xs sm:text-sm gap-1">
                <Wrench className="h-3.5 w-3.5 hidden sm:block" /> Reparo
              </TabsTrigger>
              <TabsTrigger value="docs" className="text-xs sm:text-sm gap-1">
                <FileText className="h-3.5 w-3.5 hidden sm:block" /> Documentos
              </TabsTrigger>
              <TabsTrigger value="gps" className="text-xs sm:text-sm gap-1">
                <MapPin className="h-3.5 w-3.5 hidden sm:block" /> GPS
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs sm:text-sm gap-1">
                <Clock className="h-3.5 w-3.5 hidden sm:block" /> Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              <SinistroDetalheInfo
                sinistro={sinistro}
                vistoriaEvento={vistoriaEvento}
                descricaoCliente={descricaoCliente}
                mensagensChat={mensagensChat || null}
                onOpenConversa={() => setModalConversaOpen(true)}
              />
            </TabsContent>

            <TabsContent value="reparo" className="mt-4">
              <SinistroDetalheReparo
                sinistro={sinistro}
                terceirosData={terceirosData}
                isDiretor={isDiretor}
                isRegulador={isRegulador}
                isAnalista={isAnalistaEventosOnly || isDiretor}
                onOpenAtribuirFornecedores={() => setShowAtribuirFornecedores(true)}
              />
            </TabsContent>

            <TabsContent value="docs" className="mt-4">
              <SinistroDetalheDocs
                sinistro={sinistro}
                documentos={documentos}
                processosVinculados={processosVinculados}
                onSolicitarDocs={() => setModalSolicitarDocsOpen(true)}
                onVincularProcesso={() => setModalVincularOpen(true)}
              />
            </TabsContent>

            <TabsContent value="gps" className="mt-4">
              <SinistroDetalheGPS
                sinistro={sinistro}
                rastreadorVeiculo={rastreadorVeiculo}
                onOpenMapa={() => setMapaLocalizacaoOpen(true)}
                onAcionarRecuperacao={() => setModalAcionamentoOpen(true)}
                onIniciarIndenizacao={() => setModalIndenizacaoOpen(true)}
              />
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-5 w-5 text-primary" /> Histórico de Atualizações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TimelineEventoTab sinistroId={id!} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Right */}
        <div>
          <SinistroDetalheSidebar sinistro={sinistro} handleWhatsApp={handleWhatsApp} />
        </div>
      </div>

      {/* ============= MODAIS ============= */}
      <ModalVincularProcesso sinistroId={id!} open={modalVincularOpen} onOpenChange={setModalVincularOpen} />
      
      <AtualizarStatusModal
        open={modalStatusOpen}
        onClose={() => setModalStatusOpen(false)}
        sinistro={sinistro ? { id: sinistro.id, protocolo: sinistro.protocolo, status: sinistro.status } : null}
      />

      <AgendarVistoriaModal
        open={modalVistoriaOpen}
        onClose={() => setModalVistoriaOpen(false)}
        sinistro={sinistro ? { id: sinistro.id, protocolo: sinistro.protocolo, status: sinistro.status, associado_id: sinistro.associado_id, veiculo_id: sinistro.veiculo_id } : null}
      />

      <EmitirParecerModal
        open={modalParecerOpen}
        onClose={() => setModalParecerOpen(false)}
        sinistro={sinistro ? {
          id: sinistro.id, protocolo: sinistro.protocolo, status: sinistro.status,
          tipo: sinistro.tipo, valor_fipe: sinistro.valor_fipe,
          veiculo: sinistro.veiculo ? { placa: sinistro.veiculo.placa || '', marca: sinistro.veiculo.marca || '', modelo: sinistro.veiculo.modelo || '' } : null
        } : null}
      />

      {isDiretor && sinistro && (
        <ConfirmacaoExclusaoDialog
          open={modalExcluirOpen}
          onOpenChange={setModalExcluirOpen}
          protocolo={sinistro.protocolo}
          onConfirm={async (motivo) => {
            await deleteSinistro.mutateAsync({ sinistroId: id!, motivo });
            navigate('/eventos/sinistros');
          }}
        />
      )}

      <ConversaIADialog
        open={modalConversaOpen}
        onOpenChange={setModalConversaOpen}
        mensagens={mensagensChat || []}
        associadoNome={sinistro?.associado?.nome}
        dataConversa={solicitacaoIA?.created_at || mensagensChat?.[0]?.created_at}
      />

      {sinistro && (
        <SolicitarDocumentosSinistroDialog
          open={modalSolicitarDocsOpen}
          onOpenChange={setModalSolicitarDocsOpen}
          sinistroId={sinistro.id}
          protocolo={sinistro.protocolo}
          statusAtual={sinistro.status}
        />
      )}

      {sinistro && ['roubo', 'furto'].includes(sinistro.tipo) && sinistro.veiculo && (
        <AcionarRecuperacaoModal
          open={modalAcionamentoOpen}
          onOpenChange={setModalAcionamentoOpen}
          sinistro={{ id: sinistro.id, protocolo: sinistro.protocolo, tipo: sinistro.tipo, veiculo_id: sinistro.veiculo_id }}
          veiculo={{ placa: sinistro.veiculo.placa || '', marca: sinistro.veiculo.marca || '', modelo: sinistro.veiculo.modelo || '' }}
        />
      )}

      {sinistro && sinistro.veiculo_id && (
        <IniciarIndenizacaoModal
          open={modalIndenizacaoOpen}
          onOpenChange={setModalIndenizacaoOpen}
          sinistroId={sinistro.id}
          veiculoId={sinistro.veiculo_id}
          protocolo={sinistro.protocolo}
          valorFipe={sinistro.valor_fipe}
        />
      )}

      <Dialog open={mapaLocalizacaoOpen} onOpenChange={setMapaLocalizacaoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" /> Localização do Veículo - {sinistro?.veiculo?.placa}
            </DialogTitle>
          </DialogHeader>
          {rastreadorVeiculo && (
            <MapaRastreador rastreadorId={rastreadorVeiculo.id} altura="450px" mostrarControles={true} />
          )}
        </DialogContent>
      </Dialog>

      {sinistro && (
        <EncaminharSindicanciaDialog
          open={modalSindicanciaOpen}
          onClose={() => setModalSindicanciaOpen(false)}
          sinistroId={sinistro.id}
          protocolo={sinistro.protocolo}
          tipoEvento={sinistro.tipo}
        />
      )}

      {sinistro && (
        <EncaminharJuridicoEventoModal
          open={modalJuridicoOpen}
          onClose={() => setModalJuridicoOpen(false)}
          sinistroId={sinistro.id}
          protocolo={sinistro.protocolo}
          associadoId={sinistro.associado_id}
          associadoNome={sinistro.associado?.nome}
        />
      )}

      {sinistro && (
        <AtribuirFornecedoresDialog
          open={showAtribuirFornecedores}
          onOpenChange={setShowAtribuirFornecedores}
          sinistro={sinistro}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] }); }}
        />
      )}
    </div>
  );
}
