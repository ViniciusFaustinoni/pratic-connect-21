import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Zap,
  User,
  Smartphone,
  ShieldCheck,
  ShieldOff,
  XCircle,
  Ban,
  ExternalLink,
  ClipboardCheck,
  Copy,
  FileText,
  FileCheck,
  ArrowRightCircle,
  Info,
} from 'lucide-react';
import {
  useProposta,
  usePropostasPendentes,
  useAprovarProposta,
  useSolicitarDocumentos,
  useReprovarProposta,
} from '@/hooks/usePropostasPendentes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAtivarRastreador } from '@/hooks/useAtivarRastreador';
import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';
import { resolverEscopoAnaliseCadastro } from '@/lib/cadastro/escopoAnaliseCadastro';
import { useGerarVistoriaLink } from '@/hooks/useVistoriaLinkPublica';
import { SolicitarDocumentosDialog } from '@/components/cadastro/SolicitarDocumentosDialog';
import { SituacaoFinanceiraGate } from '@/components/cadastro/SituacaoFinanceiraGate';
import { ReprovarPropostaDialog } from '@/components/cadastro/ReprovarPropostaDialog';
import { VisualizadorDocumentoModal } from '@/components/cadastro/VisualizadorDocumentoModal';
import { ReverterReprovacaoDocumentoDialog, type NovoStatusReversao } from '@/components/cadastro/ReverterReprovacaoDocumentoDialog';
import { ObservacoesCotacaoCard } from '@/components/cadastro/ObservacoesCotacaoCard';
import { BypassAplicadoBanner } from '@/components/cadastro/BypassAplicadoBanner';
import { registrarLog } from '@/hooks/useAuditLog';
import { resolverGatesAprovacaoCadastro } from '@/lib/cadastro/gatesAprovacaoCadastro';
import { toastErroEdge } from '@/lib/ui/toastErroEdge';
import {
  PropostaHeroHeader,
  PropostaDetalhesTabs,
  PropostaApprovalStepper,
} from '@/components/cadastro/proposta';
import type { DocumentoAnexadoCompleto } from '@/types/documentos';
import { isValidChassi, normalizeChassi } from '@/lib/chassi';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function PropostaAnalise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showSolicitarDocs, setShowSolicitarDocs] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [showConfirmAprovar, setShowConfirmAprovar] = useState(false);
  const [showConfirmAtivacaoSoftruck, setShowConfirmAtivacaoSoftruck] = useState(false);
  const [showBypassJanela, setShowBypassJanela] = useState(false);
  const [bypassJustificativa, setBypassJustificativa] = useState('');
  const [bypassNomeAutorizador, setBypassNomeAutorizador] = useState('');
  const [bypassResponsabilidade, setBypassResponsabilidade] = useState(false);
  const [bypassAcao, setBypassAcao] = useState<'aprovar' | 'converter'>('aprovar');
  const [showConfirmConverter, setShowConfirmConverter] = useState(false);
  const [convertendoTroca, setConvertendoTroca] = useState(false);
  const [documentoVisualizar, setDocumentoVisualizar] = useState<DocumentoAnexadoCompleto | null>(null);
  const [documentoReverter, setDocumentoReverter] = useState<DocumentoAnexadoCompleto | null>(null);
  const [linkPendenciasGerado, setLinkPendenciasGerado] = useState<string | null>(null);
  const { hasRole } = useAuth();
  const isDiretor = hasRole('diretor');
  const [sgaLiberado, setSgaLiberado] = useState(false);
  
  // Campos editáveis do veículo para SGA Hinova
  const [veiculoRenavam, setVeiculoRenavam] = useState('');
  const [veiculoChassi, setVeiculoChassi] = useState('');

  const { data: proposta, isLoading } = useProposta(id);
  const { data: todasPropostas } = usePropostasPendentes();

  const aprovarMutation = useAprovarProposta();
  const solicitarDocsMutation = useSolicitarDocumentos();
  const reprovarMutation = useReprovarProposta();
  const ativarRastreadorMutation = useAtivarRastreador();

  // Sub-etapa 1 do Cadastro: aprovação dos documentos (gate para sub-etapa 2)
  // Ver mem://logic/operations/cadastro-duas-subetapas
  const documentosAprovadosEm = (proposta as any)?.documentos_aprovados_em as string | null | undefined;
  // Troca de titularidade não tem sub-etapa 1 (edge aprovar-documentos-cadastro
  // recusa com fluxo_troca_titularidade) — aprova direto via aprovar-proposta.
  const isTrocaTitularidade =
    ((proposta as any)?.tipo_entrada === 'troca_titularidade') ||
    !!((proposta as any)?.origem_troca_titularidade_id);
  const subEtapa1Liberada = !!documentosAprovadosEm || isTrocaTitularidade;
  const [isAprovandoDocs, setIsAprovandoDocs] = useState(false);

  const handleAprovarDocumentos = async () => {
    if (!id) return;
    if (isTrocaTitularidade) {
      toast.info('Troca de titularidade aprova direto', {
        description: 'Este fluxo não tem sub-etapa de documentos — use o botão "Aprovar Proposta".',
      });
      return;
    }
    setIsAprovandoDocs(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const aprovado_por = sess?.user?.id;
      if (!aprovado_por) throw new Error('Sessão inválida — faça login novamente.');
      const { data, error } = await supabase.functions.invoke('aprovar-documentos-cadastro', {
        body: { contrato_id: id, aprovado_por },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Documentos aprovados', {
        description: 'Sub-etapa 1 concluída. Agora avalie a vistoria enxuta para finalizar.',
      });
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
    } catch (err: any) {
      console.error('[PropostaAnalise] aprovar-documentos-cadastro falhou:', err);
      toast.error('Erro ao aprovar documentos', {
        description: err?.message || 'Tente novamente.',
      });
    } finally {
      setIsAprovandoDocs(false);
    }
  };

  // Encontrar próxima proposta
  const currentIndex = todasPropostas?.findIndex((p) => p.id === id) ?? -1;
  const nextProposta = currentIndex >= 0 && todasPropostas ? todasPropostas[currentIndex + 1] : null;

  // Determinar se é autovistoria
  // OBS: agendamento base (vistoria_base_info) é evento da INSTALAÇÃO posterior
  // e PODE coexistir com uma autovistoria antecipada (associado fez fotos+vídeo
  // antes do dia da instalação para liberar R&F já no Cadastro). Por isso NÃO
  // dependemos mais de !isVistoriaBase aqui — só uma instalação concluída
  // invalida a autovistoria como fonte de fotos para o Cadastro.
  const isVistoriaBase = !!proposta?.vistoria_base_info;
  // CORREÇÃO: a existência de uma instalação agendada (criada pelo link público
  // após o agendamento) NÃO deve ocultar a autovistoria. ≥30k pode ter as duas
  // em paralelo — autovistoria opcional/enxuta para liberar R/F antes do técnico.
  // Só uma instalação CONCLUÍDA invalida a autovistoria como fonte de fotos.
  const isAutovistoria = (
    proposta?.vistoria?.modalidade === 'autovistoria' ||
    proposta?.vistoria?.tipo === 'autovistoria'
  ) && !proposta?.instalacao_info?.concluida_em;

  // Tipo de veículo (carro/moto) para personalizar labels do dialog de reenvio
  const { tipoVeiculo } = useDetectarTipoVeiculo(
    proposta?.veiculo_marca,
    proposta?.veiculo_modelo
  );

  // Verificar se pode aprovar
  // NOVO: bloqueia aprovação enquanto vistoria/instalação não foi executada
  const aguardandoExecucao = proposta?.tipo_etapa_analise === 'agendamento_confirmado';

  // ============================================================
  // REGRA CANÔNICA — Escopo de análise do Cadastro
  // Fonte única: src/lib/cadastro/escopoAnaliseCadastro.ts
  // Memória: mem://logic/operations/cadastro-escopo-canonico
  // ------------------------------------------------------------
  // Cadastro avalia APENAS: docs (sempre) + autovistoria ENXUTA acima FIPE.
  // Demais casos (presencial técnica, sub-FIPE completa) → Monitoramento.
  // ============================================================
  const isMoto = (tipoVeiculo || '').toLowerCase().includes('moto');
  const planoTemRouboFurto = !!proposta?.plano_tem_roubo_furto;
  const {
    temFotosOuVideo,
    autovistoriaCompleta,
    isVistoriaAgendadaSemFotos,
    isVistoriaPresencialTecnica,
    isAutovistoriaCompletaSubFipe,
    cadastroAvaliaFotos,
    aprovarApenasDocumentos,
    aguardandoMonitoramentoVistoria,
  } = resolverEscopoAnaliseCadastro(proposta as any, { isMoto });

  const podeAprovar =
    proposta?.status === 'assinado' &&
    !proposta?.tem_documento_pendente &&
    (!aguardandoExecucao || aprovarApenasDocumentos) &&
    sgaLiberado;

  // Estado final (já aprovado / reprovado / cancelado)
  const isAprovada = proposta?.status === 'ativo';
  const isReprovada = proposta?.status === 'reprovado';
  const isCancelada = proposta?.status === 'cancelado';
  const isFinalizada = isAprovada || isReprovada || isCancelada;

  // Buscar dados de aprovação/reprovação para banner
  const [estadoFinal, setEstadoFinal] = useState<{
    aprovado_em: string | null;
    aprovado_por_nome: string | null;
    motivo_reprovacao?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!id || !isFinalizada) {
      setEstadoFinal(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: contrato } = await supabase
        .from('contratos')
        .select('aprovado_em, aprovado_por')
        .eq('id', id)
        .maybeSingle();
      let aprovadorNome: string | null = null;
      if (contrato?.aprovado_por) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', contrato.aprovado_por)
          .maybeSingle();
        aprovadorNome = prof?.nome || null;
      }
      if (!cancelled) {
        setEstadoFinal({
          aprovado_em: contrato?.aprovado_em || null,
          aprovado_por_nome: aprovadorNome,
          motivo_reprovacao: null,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [id, isFinalizada]);

  const handleAprovar = () => {
    setShowConfirmAprovar(true);
  };

  const gerarVistoriaLinkMut = useGerarVistoriaLink();

  const handleConfirmarAprovacao = async () => {
    if (!id) return;

    // Validação de chassi: se foi digitado nesta tela, precisa ser VIN válido (17 chars).
    const chassiInformado = veiculoChassi?.trim();
    if (chassiInformado && !isValidChassi(chassiInformado)) {
      toast.error('Chassi inválido', {
        description: 'O chassi precisa ter 17 caracteres no padrão VIN (sem I, O ou Q).',
      });
      return;
    }

    // Chassi sempre é preenchido manualmente — nenhuma comparação com OCR é feita aqui.

    setShowConfirmAprovar(false);

    try {
      await aprovarMutation.mutateAsync({
        contratoId: id,
        veiculoRenavam: veiculoRenavam || undefined,
        veiculoChassi: chassiInformado ? normalizeChassi(chassiInformado) : undefined,
      });

      // Após aprovação documental, gerar (ou reutilizar) o link público de vistoria.
      // Idempotente: se já existir, devolve o mesmo token. Não bloqueia o fluxo se falhar.
      try {
        const cotacaoId = (proposta as any)?.cotacao_id || (proposta as any)?.cotacao?.id;
        if (cotacaoId) {
          await gerarVistoriaLinkMut.mutateAsync({ cotacaoId });
        }
      } catch (linkErr) {
        console.warn('[PropostaAnalise] Falha ao gerar link de vistoria (não bloqueante):', linkErr);
      }

      if (nextProposta) {
        navigate(`/cadastro/propostas/${nextProposta.id}`);
      } else {
        navigate('/cadastro/propostas');
      }
    } catch (error: any) {
      console.error('[PropostaAnalise] Erro ao aprovar:', error);
      // Troca de titularidade fora da janela: o Cadastro decide entre
      // aprovar fora da janela (com autorizador+justificativa+termo de
      // responsabilidade) ou converter em cotação normal.
      if (error?.codigo === 'JANELA_TROCA_EXPIRADA' && isTrocaTitularidade) {
        setBypassJustificativa('');
        setBypassNomeAutorizador('');
        setBypassResponsabilidade(false);
        setBypassAcao('aprovar');
        setShowBypassJanela(true);
        return;
      }
      toast.error('Erro ao aprovar proposta', {
        description: error?.message || 'Tente novamente. Se o problema persistir, atualize a página.'
      });
    }
  };

  const bypassFormValido = () => {
    return (
      bypassNomeAutorizador.trim().length >= 3 &&
      bypassJustificativa.trim().length >= 20 &&
      bypassResponsabilidade
    );
  };

  const handleConfirmarBypassJanela = async () => {
    if (!id) return;
    if (!bypassFormValido()) {
      toast.error('Preencha os campos obrigatórios', {
        description: 'Autorizador (≥3), justificativa (≥20) e confirmação de responsabilidade.',
      });
      return;
    }
    const justificativa = bypassJustificativa.trim();
    const nomeAutorizador = bypassNomeAutorizador.trim();
    setShowBypassJanela(false);
    try {
      const chassiInformado = veiculoChassi?.trim();
      await aprovarMutation.mutateAsync({
        contratoId: id,
        veiculoRenavam: veiculoRenavam || undefined,
        veiculoChassi: chassiInformado ? normalizeChassi(chassiInformado) : undefined,
        bypassJanela: true,
        bypassJustificativa: justificativa,
        bypassNomeAutorizador: nomeAutorizador,
      });
      try {
        await registrarLog({
          acao: 'aprovar',
          modulo: 'cotacoes',
          descricao: `[TROCA_BYPASS_JANELA] ${id} - Autorizado por ${nomeAutorizador}: ${justificativa}`,
          entidade_id: id,
          tabela: 'contratos',
        });
      } catch {}
      try {
        const cotacaoId = (proposta as any)?.cotacao_id || (proposta as any)?.cotacao?.id;
        if (cotacaoId) await gerarVistoriaLinkMut.mutateAsync({ cotacaoId });
      } catch (linkErr) {
        console.warn('[PropostaAnalise] Falha ao gerar link de vistoria (não bloqueante):', linkErr);
      }
      if (nextProposta) navigate(`/cadastro/propostas/${nextProposta.id}`);
      else navigate('/cadastro/propostas');
    } catch (err: any) {
      console.error('[PropostaAnalise] Bypass janela falhou:', err);
      toast.error('Falha no bypass', { description: err?.message || 'Tente novamente.' });
    }
  };

  const handleConverterEmCotacaoNormal = async () => {
    if (!id) return;
    if (!bypassFormValido()) {
      toast.error('Preencha os campos obrigatórios', {
        description: 'Autorizador (≥3), justificativa (≥20) e confirmação de responsabilidade.',
      });
      return;
    }
    // Resolve solicitacao_id via cotacao da proposta.
    const cotacaoId = (proposta as any)?.cotacao_id || (proposta as any)?.cotacao?.id;
    if (!cotacaoId) {
      toast.error('Cotação não encontrada para esta proposta.');
      return;
    }
    setConvertendoTroca(true);
    try {
      const { data: sol, error: solErr } = await supabase
        .from('solicitacoes_troca_titularidade')
        .select('id')
        .eq('cotacao_id', cotacaoId)
        .maybeSingle();
      if (solErr) throw solErr;
      if (!sol?.id) throw new Error('Solicitação de troca não encontrada.');

      const { data, error } = await supabase.functions.invoke('converter-troca-em-cotacao-normal', {
        body: {
          solicitacao_id: (sol as any).id,
          nome_autorizador: bypassNomeAutorizador.trim(),
          justificativa: bypassJustificativa.trim(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Troca convertida em cotação normal', {
        description: 'A troca foi cancelada. O cliente precisa iniciar uma nova adesão.',
      });
      setShowConfirmConverter(false);
      setShowBypassJanela(false);
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      if (nextProposta) navigate(`/cadastro/propostas/${nextProposta.id}`);
      else navigate('/cadastro/propostas');
    } catch (err: any) {
      console.error('[PropostaAnalise] Conversão falhou:', err);
      toast.error('Falha ao converter em cotação normal', {
        description: err?.message || 'Tente novamente.',
      });
    } finally {
      setConvertendoTroca(false);
    }
  };

  const handleSolicitarDocumentos = async (documentos: string[], observacoes: string) => {
    if (!proposta?.associado_id || !id) return;
    const result = await solicitarDocsMutation.mutateAsync({
      contratoId: id,
      associadoId: proposta.associado_id,
      documentos,
      observacoes,
    });
    setLinkPendenciasGerado(result.linkPendencias || null);
    setShowSolicitarDocs(false);
    queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
  };

  const handleReprovar = async (motivo: string, justificativa: string) => {
    if (!proposta?.associado_id || !id) return;
    await reprovarMutation.mutateAsync({
      contratoId: id,
      associadoId: proposta.associado_id,
      motivo,
      justificativa,
    });
    setShowReprovar(false);
    // Navegar para próxima ou voltar para lista
    if (nextProposta) {
      navigate(`/cadastro/propostas/${nextProposta.id}`);
    } else {
      navigate('/cadastro/propostas');
    }
  };

  // Handler para ativar rastreador Softruck
  const handleConfirmarAtivacaoSoftruck = async () => {
    if (!proposta?.instalacao_info?.rastreador_imei || 
        !proposta?.veiculo_id || 
        !proposta?.associado_id) {
      return;
    }
    
    setShowConfirmAtivacaoSoftruck(false);
    
    try {
      await ativarRastreadorMutation.mutateAsync({
        imei: proposta.instalacao_info.rastreador_imei,
        veiculoId: proposta.veiculo_id,
        associadoId: proposta.associado_id,
        associadoEmail: proposta.cliente_email || undefined,
      });
      
      // Refetch para atualizar estado
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    } catch (error) {
      console.error('Erro ao ativar rastreador:', error);
    }
  };

  // Handler para aprovar documento individual
  // Suporta dois fluxos:
  //  - id começando com `solicitado-`  → atualiza `documentos_solicitados` + `documentos`
  //  - caso contrário                  → atualiza `contratos_documentos`
  const handleAprovarDocumento = async (docId: string) => {
    if (docId.startsWith('solicitado-')) {
      const solicitadoId = docId.replace(/^solicitado-/, '');
      const { data: sol, error: e0 } = await supabase
        .from('documentos_solicitados')
        .select('id, documento_id')
        .eq('id', solicitadoId)
        .maybeSingle();
      if (e0 || !sol) {
        toast.error('Erro ao aprovar documento reenviado', { description: e0?.message });
        return;
      }
      if (sol.documento_id) {
        await supabase.from('documentos').update({ status: 'aprovado' }).eq('id', sol.documento_id);
      }
      const { error } = await supabase
        .from('documentos_solicitados')
        .update({ status: 'aprovado' })
        .eq('id', solicitadoId);
      if (error) {
        toast.error('Erro ao aprovar documento reenviado', { description: error.message });
        return;
      }
      toast.success('Documento reenviado aprovado');
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      return;
    }

    const { error } = await supabase
      .from('contratos_documentos')
      .update({ status: 'aprovado' })
      .eq('id', docId);
    
    if (error) {
      toast.error('Erro ao aprovar documento', { description: error.message });
      return;
    }
    toast.success('Documento aprovado');
    queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
  };

  // Handler para reprovar documento individual
  const handleReprovarDocumento = async (docId: string, motivo: string) => {
    if (docId.startsWith('solicitado-')) {
      const solicitadoId = docId.replace(/^solicitado-/, '');
      const { data: sol } = await supabase
        .from('documentos_solicitados')
        .select('id, documento_id')
        .eq('id', solicitadoId)
        .maybeSingle();
      if (sol?.documento_id) {
        await supabase.from('documentos').update({ status: 'reprovado' }).eq('id', sol.documento_id);
      }
      // Volta a solicitação para 'pendente' para o cliente reenviar novamente
      const { error } = await supabase
        .from('documentos_solicitados')
        .update({
          status: 'pendente',
          enviado_em: null,
          documento_id: null,
          observacao_cliente: motivo || null,
        })
        .eq('id', solicitadoId);
      if (error) {
        toast.error('Erro ao reprovar documento reenviado', { description: error.message });
        return;
      }
      toast.success('Documento reenviado reprovado — cliente será notificado para reenviar');
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      return;
    }

    const { error } = await supabase
      .from('contratos_documentos')
      .update({ status: 'reprovado' })
      .eq('id', docId);
    
    if (error) {
      toast.error('Erro ao reprovar documento', { description: error.message });
      return;
    }
    toast.success('Documento reprovado');
    queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
  };

  // Handler para reverter reprovação de documento (com justificativa obrigatória)
  const handleReverterReprovacaoDocumento = async (
    docId: string,
    novoStatus: NovoStatusReversao,
    justificativa: string,
  ) => {
    // Defesa: proposta já fechada não permite reversão
    if (isFinalizada) {
      toast.error('Proposta já finalizada — reversão não permitida');
      throw new Error('proposta_finalizada');
    }

    const isSolicitado = docId.startsWith('solicitado-');
    const realId = isSolicitado ? docId.replace(/^solicitado-/, '') : docId;

    // Snapshot antes
    let documentoIdHist: string | null = null;
    let tipoDoc: string | null = null;
    let motivoOriginal: string | null = null;

    try {
      if (isSolicitado) {
        const { data: sol, error: e0 } = await supabase
          .from('documentos_solicitados')
          .select('id, documento_id, tipo_documento, observacao_cliente')
          .eq('id', realId)
          .maybeSingle();
        if (e0 || !sol) throw new Error(e0?.message || 'Solicitação não encontrada');
        documentoIdHist = sol.documento_id;
        tipoDoc = sol.tipo_documento;
        motivoOriginal = sol.observacao_cliente;

        if (sol.documento_id) {
          const { error: eDoc } = await supabase
            .from('documentos')
            .update({ status: novoStatus, motivo_reprovacao: null })
            .eq('id', sol.documento_id);
          if (eDoc) throw new Error(eDoc.message);
        }
        const { error: eSol } = await supabase
          .from('documentos_solicitados')
          .update({
            status: novoStatus === 'aprovado' ? 'aprovado' : 'enviado',
            observacao_cliente: null,
          })
          .eq('id', realId);
        if (eSol) throw new Error(eSol.message);
      } else {
        const { data: cd, error: e0 } = await supabase
          .from('contratos_documentos')
          .select('id, tipo')
          .eq('id', realId)
          .maybeSingle();
        if (e0 || !cd) throw new Error(e0?.message || 'Documento não encontrado');
        documentoIdHist = null; // FK aponta para public.documentos; contratos_documentos não é elegível
        tipoDoc = cd.tipo;

        const { error } = await supabase
          .from('contratos_documentos')
          .update({ status: novoStatus })
          .eq('id', realId);
        if (error) throw new Error(error.message);
      }

      // Histórico do associado
      if (proposta?.associado_id) {
        await supabase.from('associados_historico').insert({
          associado_id: proposta.associado_id,
          contrato_id: proposta.id,
          documento_id: documentoIdHist,
          tipo: 'documento_reprovacao_revertida',
          acao: novoStatus === 'aprovado' ? 'aprovar' : 'reativar',
          descricao: `Reprovação do documento "${tipoDoc ?? 'documento'}" revertida para ${novoStatus === 'aprovado' ? 'APROVADO' : 'em análise'}`,
          motivo: justificativa,
          status_anterior: 'reprovado',
          status_novo: novoStatus,
          metadata: {
            motivo_reprovacao_original: motivoOriginal,
            origem: isSolicitado ? 'documentos_solicitados' : 'contratos_documentos',
            doc_id: realId,
          },
        });
      }

      // Log de auditoria
      await registrarLog({
        acao: 'reativar',
        modulo: 'documentos',
        descricao: `Reverter reprovação de documento "${tipoDoc ?? 'documento'}" para ${novoStatus}`,
        entidade_id: realId,
        tabela: isSolicitado ? 'documentos_solicitados' : 'contratos_documentos',
        dados_anteriores: { status: 'reprovado', motivo_reprovacao: motivoOriginal },
        dados_novos: { status: novoStatus, justificativa },
      });

      toast.success(
        novoStatus === 'aprovado'
          ? 'Reprovação revertida e documento aprovado'
          : 'Reprovação revertida — documento voltou para análise',
      );
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao reverter reprovação', { description: msg });
      throw err;
    }
  };
  const podeAtivarSoftruck = proposta?.status === 'ativo' &&
    proposta?.instalacao_info?.rastreador_plataforma === 'softruck' &&
    !proposta?.instalacao_info?.rastreador_ativado &&
    !proposta?.veiculo_cobertura_total;

  const isAtivandoSoftruck = ativarRastreadorMutation.isPending;

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-4">
        <Skeleton className="h-48 w-full rounded-xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-lg bg-muted" />
          <Skeleton className="h-40 w-full rounded-lg bg-muted" />
          <Skeleton className="h-40 w-full rounded-lg bg-muted" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg bg-muted" />
      </div>
    );
  }

  // Not found
  if (!proposta) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Proposta não encontrada</h2>
        <p className="text-muted-foreground mt-2">A proposta solicitada não existe ou foi removida.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/cadastro/propostas')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 pb-8">
      {/* Bypass aplicado (Troca de Titularidade fora da janela / convertida) */}
      <BypassAplicadoBanner bypassAplicado={(proposta as any)?.bypass_aplicado} />

      {/* ZONA 1: Header Hero (sem botões de ação) */}
      <PropostaHeroHeader
        proposta={proposta}
        onVoltar={() => navigate('/cadastro/propostas')}
        onProxima={nextProposta ? () => navigate(`/cadastro/propostas/${nextProposta.id}`) : undefined}
      />


      {/* Observações do operador + Tipo da Cotação + Histórico de avisos SGA */}
      <ObservacoesCotacaoCard
        cotacaoId={(proposta as any)?.cotacao_id ?? null}
        contratoId={proposta?.id ?? null}
        cpf={(proposta as any)?.cliente_cpf ?? null}
        placa={(proposta as any)?.veiculo_placa ?? null}
      />

      {/* Banner de estado final (proposta já aprovada / reprovada / cancelada) */}
      {isFinalizada && (
        <div
          className={
            isAprovada
              ? 'rounded-lg border-2 border-success/40 bg-success/10 p-4 space-y-3'
              : isReprovada
                ? 'rounded-lg border-2 border-destructive/40 bg-destructive/10 p-4 space-y-3'
                : 'rounded-lg border-2 border-muted-foreground/30 bg-muted p-4 space-y-3'
          }
        >
          <div className="flex items-start gap-3">
            {isAprovada ? (
              <CheckCircle className="h-6 w-6 text-success mt-0.5 shrink-0" />
            ) : isReprovada ? (
              <XCircle className="h-6 w-6 text-destructive mt-0.5 shrink-0" />
            ) : (
              <Ban className="h-6 w-6 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p
                className={
                  isAprovada
                    ? 'font-semibold text-success'
                    : isReprovada
                      ? 'font-semibold text-destructive'
                      : 'font-semibold text-foreground'
                }
              >
                {isAprovada
                  ? 'Proposta aprovada — cadastro concluído'
                  : isReprovada
                    ? 'Proposta reprovada'
                    : 'Proposta cancelada'}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isAprovada && estadoFinal?.aprovado_em && (
                  <>
                    Aprovada em{' '}
                    {new Date(estadoFinal.aprovado_em).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {estadoFinal.aprovado_por_nome && <> por <strong className="text-foreground">{estadoFinal.aprovado_por_nome}</strong></>}.
                  </>
                )}
                {isAprovada && !estadoFinal?.aprovado_em && (
                  <>O associado já está ativo no sistema.</>
                )}
                {isReprovada && <>Esta proposta foi reprovada e não está mais disponível para análise.</>}
                {isCancelada && <>Esta proposta foi cancelada.</>}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {isAprovada && proposta.associado_id && (
              <Button
                className="flex-1 bg-success hover:bg-success/90 text-white"
                onClick={() => navigate(`/cadastro/associados/${proposta.associado_id}`)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver associado
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/cadastro/propostas')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para lista
            </Button>
          </div>
        </div>
      )}

      {/* Banner: aguardando execução da vistoria/instalação (analista pode revisar docs mas não aprovar) */}
      {!isFinalizada && aguardandoExecucao && !aprovarApenasDocumentos && (
        <div className="rounded-lg border-2 border-info/40 bg-info/10 p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="h-5 w-5 text-info mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-info">Análise documental disponível</p>
              {proposta?.plano_tem_roubo_furto ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Você pode revisar documentos e contrato agora. A <strong>aprovação final</strong> será liberada após a execução da vistoria/instalação agendada.
                  Em seguida, o monitoramento dará o <strong>segundo check</strong> para liberar a Proteção 360 e o app do associado.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Você pode revisar documentos e contrato agora. A <strong>aprovação final</strong> será liberada após a execução da vistoria.
                  Este plano de assistência <strong>não inclui</strong> instalação de rastreador nem segundo check de monitoramento.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {podeAtivarSoftruck && (
        <div className="rounded-lg border-2 border-warning/30 bg-warning/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-warning">Ativação Pendente</p>
              <p className="text-sm text-muted-foreground">
                O rastreador foi instalado mas ainda não foi ativado na plataforma Softruck.
              </p>
            </div>
          </div>
          
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
            onClick={() => setShowConfirmAtivacaoSoftruck(true)}
            disabled={isAtivandoSoftruck}
          >
            {isAtivandoSoftruck ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ativando na Softruck...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Ativar Rastreador Softruck
              </>
            )}
          </Button>
        </div>
      )}

      {linkPendenciasGerado && (
        <div className="rounded-lg border-2 border-warning/30 bg-warning/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-warning">Link público para envio das pendências</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você também pode enviar manualmente este link ao associado para anexar as documentações pendentes.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 truncate rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
                  {linkPendenciasGerado}
                </div>
                <Button
                  variant="outline"
                  className="border-warning/50 text-warning hover:bg-warning/10"
                  onClick={async () => {
                    await navigator.clipboard.writeText(linkPendenciasGerado);
                    toast.success('Link público copiado');
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar link
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZONA 1.5: Gate de Situação Financeira (SGA) — bloqueia avanço se inadimplente */}
      {!isFinalizada && (
        <SituacaoFinanceiraGate
          contratoId={proposta.id}
          onChange={setSgaLiberado}
        />
      )}

      {/* ZONA 2: Stepper de Aprovação por Etapas */}
      <div>
        <PropostaApprovalStepper
          proposta={proposta}
          documentos={(proposta.documentos || []) as unknown as DocumentoAnexadoCompleto[]}
          onViewDocumento={setDocumentoVisualizar}
          onAprovarDocumento={handleAprovarDocumento}
          onReprovarDocumento={handleReprovarDocumento}
          onReverterReprovacaoDocumento={isFinalizada ? undefined : (doc) => setDocumentoReverter(doc)}
          onAprovar={handleAprovar}
          onSolicitarDocs={() => setShowSolicitarDocs(true)}
          onReprovar={() => setShowReprovar(true)}
          isAprovando={aprovarMutation.isPending}
          isAutovistoria={isAutovistoria}
          podeAprovar={podeAprovar}
          cadastroAvaliaFotos={cadastroAvaliaFotos}
          planoTemRouboFurto={planoTemRouboFurto}
          aguardandoMonitoramentoVistoria={aguardandoMonitoramentoVistoria}
          aprovarApenasDocumentos={aprovarApenasDocumentos}
          documentosAprovadosEm={documentosAprovadosEm ?? (isTrocaTitularidade ? new Date(0).toISOString() : null)}
          onAprovarDocumentos={handleAprovarDocumentos}
          isAprovandoDocumentos={isAprovandoDocs}
        />
      </div>

      {/* ZONA 3: Tabs de Detalhes (sempre visíveis) */}
      <PropostaDetalhesTabs
        proposta={proposta}
        veiculoRenavam={veiculoRenavam}
        setVeiculoRenavam={setVeiculoRenavam}
        veiculoChassi={veiculoChassi}
        setVeiculoChassi={setVeiculoChassi}
      />

      {/* DIALOGS */}
      <SolicitarDocumentosDialog
        open={showSolicitarDocs}
        onOpenChange={setShowSolicitarDocs}
        onConfirm={handleSolicitarDocumentos}
        loading={solicitarDocsMutation.isPending}
        isAutovistoria={isAutovistoria}
        tipoVeiculo={tipoVeiculo}
      />

      <ReprovarPropostaDialog
        open={showReprovar}
        onOpenChange={setShowReprovar}
        onConfirm={handleReprovar}
        loading={reprovarMutation.isPending}
      />

      {/* Modal de visualização de documento */}
      {documentoVisualizar && (
        <VisualizadorDocumentoModal
          documento={documentoVisualizar}
          open={!!documentoVisualizar}
          onClose={() => setDocumentoVisualizar(null)}
          onAprovar={handleAprovarDocumento}
          onReprovar={handleReprovarDocumento}
        />
      )}

      {/* Dialog de confirmação de aprovação */}
      <AlertDialog open={showConfirmAprovar} onOpenChange={setShowConfirmAprovar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isAutovistoria ? (
                <ShieldCheck className="h-5 w-5 text-success" />
              ) : (
                <CheckCircle className="h-5 w-5 text-success" />
              )}
              Confirmar Aprovação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta etapa é <strong>apenas a análise documental</strong>. Ao confirmar, o sistema irá:
                </p>

                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                      <FileCheck className="h-3 w-3 text-success" />
                    </div>
                    <span>Marcar a documentação como aprovada pelo Cadastro</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-info/20 flex items-center justify-center">
                      <ArrowRightCircle className="h-3 w-3 text-info" />
                    </div>
                    <span>Encaminhar a proposta para a fila de <strong>Monitoramento › Aprovação de Associados</strong></span>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    A <strong>ativação do associado</strong>, o envio como pendente para o <strong>SGA</strong> e a <strong>liberação do acesso ao App</strong> ocorrem somente após a aprovação do Monitoramento, depois da instalação/vistoria concluída.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarAprovacao}
              className="bg-success hover:bg-success/90 text-white"
              disabled={aprovarMutation.isPending}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {aprovarMutation.isPending ? 'Aprovando...' : 'Aprovar Documentação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de ativação Softruck */}
      <AlertDialog open={showConfirmAtivacaoSoftruck} onOpenChange={setShowConfirmAtivacaoSoftruck}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Zap className="h-5 w-5 text-primary" />
              Confirmar Ativação do Rastreador
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-muted-foreground">
                <p>Esta ação irá:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Ativar o rastreador na plataforma <strong className="text-foreground">SOFTRUCK</strong></li>
                  <li>Liberar a <strong className="text-foreground">Proteção 360º</strong> para o veículo {proposta?.veiculo_placa}</li>
                  <li>Criar veículo/device na Softruck se necessário</li>
                </ul>
                <p className="font-medium text-foreground">Deseja continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleConfirmarAtivacaoSoftruck}
              disabled={isAtivandoSoftruck}
            >
              {isAtivandoSoftruck ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Confirmar Ativação
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverter reprovação de documento (somente proposta aberta) */}
      <ReverterReprovacaoDocumentoDialog
        documento={documentoReverter}
        open={!!documentoReverter}
        onOpenChange={(o) => !o && setDocumentoReverter(null)}
        onConfirm={handleReverterReprovacaoDocumento}
      />

      {/* Bypass de janela mesmo-dia em Troca de Titularidade (decisão do Cadastro) */}
      <AlertDialog open={showBypassJanela} onOpenChange={setShowBypassJanela}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Troca fora da janela — escolha como prosseguir
            </AlertDialogTitle>
            <AlertDialogDescription>
              A janela canônica de mesmo-dia (até 23:59:59 BRT do dia da assinatura do termo de cancelamento) já expirou.
              Escolha entre <strong>aprovar fora da janela</strong> (segue para o Monitoramento como Troca normal)
              ou <strong>converter em cotação normal</strong> (cancela a troca; o novo titular precisa refazer como nova adesão).
              A decisão é registrada em <strong>logs_auditoria</strong>, na fila <strong>Relacionamento › Análises</strong> e
              fica visível no Monitoramento.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex gap-2 p-1 bg-muted rounded-md">
              <Button
                type="button"
                size="sm"
                variant={bypassAcao === 'aprovar' ? 'default' : 'ghost'}
                className={bypassAcao === 'aprovar' ? 'flex-1 bg-amber-600 hover:bg-amber-700 text-white' : 'flex-1'}
                onClick={() => setBypassAcao('aprovar')}
              >
                Aprovar fora da janela
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bypassAcao === 'converter' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setBypassAcao('converter')}
              >
                Converter em cotação normal
              </Button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bypass-autorizador">Nome de quem autorizou *</Label>
              <input
                id="bypass-autorizador"
                value={bypassNomeAutorizador}
                onChange={(e) => setBypassNomeAutorizador(e.target.value)}
                placeholder="Ex.: João Silva (Gerente Comercial)"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">{bypassNomeAutorizador.trim().length} / 3 caracteres mínimos</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bypass-justificativa">Justificativa *</Label>
              <Textarea
                id="bypass-justificativa"
                value={bypassJustificativa}
                onChange={(e) => setBypassJustificativa(e.target.value)}
                placeholder="Ex.: Cliente já assinou termo + adesão paga; resgate excepcional autorizado pelo gerente comercial em ligação às 14h."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{bypassJustificativa.trim().length} / 20 caracteres mínimos</p>
            </div>

            <label className="flex items-start gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 cursor-pointer">
              <input
                type="checkbox"
                checked={bypassResponsabilidade}
                onChange={(e) => setBypassResponsabilidade(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-amber-900 dark:text-amber-100">
                Confirmo que tenho responsabilidade por esta decisão e que ela está autorizada por{' '}
                <strong>{bypassNomeAutorizador.trim() || '— preencha o nome acima —'}</strong>.
              </span>
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {bypassAcao === 'aprovar' ? (
              <AlertDialogAction
                onClick={handleConfirmarBypassJanela}
                disabled={!bypassFormValido() || aprovarMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {aprovarMutation.isPending ? 'Aprovando…' : 'Aprovar fora da janela'}
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); if (bypassFormValido()) setShowConfirmConverter(true); }}
                disabled={!bypassFormValido() || convertendoTroca}
                className="bg-destructive hover:bg-destructive/90"
              >
                Converter em cotação normal
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação extra para conversão (ação destrutiva) */}
      <AlertDialog open={showConfirmConverter} onOpenChange={setShowConfirmConverter}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar conversão em cotação normal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>cancela definitivamente</strong> a troca de titularidade:
              a solicitação, a cotação derivada e o contrato derivado serão cancelados,
              e o veículo voltará a ficar disponível. O novo titular precisará iniciar
              uma <strong>nova adesão</strong> do zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convertendoTroca}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConverterEmCotacaoNormal}
              disabled={convertendoTroca}
              className="bg-destructive hover:bg-destructive/90"
            >
              {convertendoTroca ? 'Convertendo…' : 'Sim, converter agora'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
