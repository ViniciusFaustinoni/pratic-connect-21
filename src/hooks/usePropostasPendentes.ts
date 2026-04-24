import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';


type Contrato = Database['public']['Tables']['contratos']['Row'];
type Associado = Database['public']['Tables']['associados']['Row'];
type Plano = Database['public']['Tables']['planos']['Row'];

const APP_BASE_URL = 'https://app.praticcar.org';

export interface DocumentoAnexado {
  id: string;
  tipo: string;
  arquivo_nome: string | null;
  arquivo_url: string;
  status: string;
  created_at: string;
}

export interface VistoriaFotoInfo {
  id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

export interface VistoriaInfo {
  id: string;
  status: string;
  tipo: string;
  modalidade?: string; // 'autovistoria' | 'presencial' | 'ponto_fixo'
  fotos: VistoriaFotoInfo[];
  observacoes?: string | null;
  km_atual?: number | null;
  video_360_url?: string | null;
}

export interface DocumentoSolicitadoEnviado {
  id: string;
  tipo_documento: string;
  descricao: string | null;
  enviado_em: string | null;
  observacao_solicitacao: string | null;
  observacao_cliente: string | null;
  documento: {
    id: string;
    arquivo_url: string;
    nome_arquivo: string | null;
    status: string | null;
  } | null;
}

export interface DocumentoSolicitadoPendente {
  id: string;
  tipo_documento: string;
  descricao: string | null;
  observacao_solicitacao: string | null;
  solicitado_em: string | null;
  created_at: string | null;
}

// Informações da instalação e rastreador
export interface InstalacaoInfo {
  id: string;
  status: string;
  concluida_em: string | null;
  rastreador_imei: string | null;
  rastreador_codigo: string | null;
  rastreador_id: string | null;
  rastreador_plataforma: string | null;
  rastreador_ativado: boolean;
  instalador_nome: string | null;
  assinatura_cliente_url: string | null;
}

// Informações da instalação agendada (antes da execução)
export interface InstalacaoAgendadaInfo {
  data: string;
  horario: string;
  permite_encaixe: boolean;
}

// Informações da vistoria na base
export interface VistoriaBaseInfo {
  id: string;
  data_agendada: string;
  horario: string;
  status: string;
  atendido_por_nome: string | null;
}

// Estágio da análise para diferenciar fila do analista
export type TipoEtapaAnalise =
  | 'agendamento_confirmado'   // Cliente agendou, vistoria/instalação ainda não executada
  | 'vistoria_em_execucao'     // Autovistoria iniciada (algumas fotos enviadas)
  | 'vistoria_concluida'       // Autovistoria/vistoria-base concluída
  | 'instalacao_concluida';    // Instalação domiciliar concluída

export interface PropostaPendente {
  id: string;
  numero: string | null;
  data_assinatura: string | null;
  valor_mensal: number | null;
  status: string | null;
  tipo_etapa_analise: TipoEtapaAnalise | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  veiculo_placa: string | null;
  veiculo_modelo: string | null;
  veiculo_marca: string | null;
  veiculo_ano: number | null;
  veiculo_cor: string | null;
  veiculo_renavam: string | null;
  veiculo_chassi: string | null;
  // Conferência (vindos de contratos / cotacoes)
  veiculo_combustivel: string | null;
  veiculo_categoria: string | null;
  veiculo_tipo_uso: string | null;
  veiculo_ano_fabricacao: number | null;
  veiculo_alienado: boolean | null;
  veiculo_blindado: boolean | null;
  veiculo_financeira: string | null;
  veiculo_procedencia: string | null;
  veiculo_valor_fipe: number | null;
  codigo_fipe: string | null;
  cobertura_fipe: number | null;
  valor_adesao: number | null;
  uso_aplicativo: boolean | null;
  cenario_adesao: string | null;
  dia_vencimento: number | null;
  associado_id: string | null;
  cotacao_id: string | null;
  veiculo_id: string | null; // ID do veículo vinculado
  veiculo_cobertura_total: boolean | null; // Se veículo tem cobertura total ativada
  contrato_link_token: string | null;
  associado: Associado | null;
  plano: { nome: string } | null;
  plano_nome: string | null; // Fallback do nome do plano
  endereco_completo: string | null; // Endereço completo da cotação
  vendedor: { nome: string | null } | null;
  documentos: DocumentoAnexado[];
  tem_documento_pendente: boolean;
  associado_status: string | null;
  vistoria: VistoriaInfo | null;
  documentos_solicitados_enviados: DocumentoSolicitadoEnviado[];
  documentos_solicitados_pendentes: DocumentoSolicitadoPendente[];
  instalacao_info: InstalacaoInfo | null; // Dados da instalação concluída
  instalacao_agendada: InstalacaoAgendadaInfo | null; // Dados do agendamento (pré-instalação)
  vistoria_base_info: VistoriaBaseInfo | null; // Dados da vistoria na base
  tipo_vistoria: 'autovistoria' | 'agendada' | 'agendada_base' | null; // Modalidade definida na cotação
  /**
   * True quando o plano contratado tem cobertura de Roubo e/ou Furto.
   * Define se o Cadastro precisa avaliar fotos do veículo (com R&F) ou só
   * documentação (sem R&F — assistência 24h, vidros, benefícios soltos).
   * Detectado inspecionando os nomes das coberturas do plano via regex /roubo|furto/i.
   */
  plano_tem_roubo_furto: boolean;
}

/**
 * Verifica se um plano possui cobertura de Roubo e/ou Furto consultando
 * planos_coberturas + coberturas. Mesma heurística usada em outros pontos
 * do sistema (regex /roubo|furto/i sobre o nome da cobertura).
 */
async function checkPlanoTemRouboFurto(planoId: string | null | undefined): Promise<boolean> {
  if (!planoId) return false;
  const { data } = await supabase
    .from('planos_coberturas')
    .select('coberturas(nome)')
    .eq('plano_id', planoId);
  if (!data || data.length === 0) return false;
  return data.some((row: any) => {
    const nome = row?.coberturas?.nome || '';
    return /roubo|furto/i.test(nome);
  });
}

export interface PropostaStats {
  aguardando: number;
  emAnalise: number;
  aprovadosHoje: number;
  reprovadosHoje: number;
}

// ============================================
// QUERY: Buscar propostas pendentes
// ============================================
export function usePropostasPendentes() {
  return useQuery({
    queryKey: ['propostas-pendentes'],
    queryFn: async (): Promise<PropostaPendente[]> => {
      // Buscar contratos assinados
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select(`
          id,
          link_token,
          numero,
          data_assinatura,
          valor_mensal,
          status,
          cliente_nome,
          cliente_cpf,
          cliente_telefone,
          cliente_email,
          veiculo_placa,
          veiculo_modelo,
          veiculo_marca,
          veiculo_ano,
          veiculo_ano_fabricacao,
          veiculo_cor,
          veiculo_combustivel,
          veiculo_categoria,
          veiculo_tipo_uso,
          veiculo_alienado,
          veiculo_financeira,
          veiculo_procedencia,
          veiculo_valor_fipe,
          codigo_fipe,
          cobertura_fipe,
          valor_adesao,
          uso_aplicativo,
          dia_vencimento,
          associado_id,
          cotacao_id,
          plano_id,
          vendedor_id,
          veiculo_id
        `)
        .eq('status', 'assinado')
        .order('data_assinatura', { ascending: true });

      if (error) throw error;

      // Para cada contrato, buscar dados relacionados
      const propostasComRelacoes = await Promise.all(
        (contratos || []).map(async (contrato) => {
          // Buscar associado
          let associado = null;
          if (contrato.associado_id) {
            const { data } = await supabase
              .from('associados')
              .select('*')
              .eq('id', contrato.associado_id)
              .single();
            associado = data;
          }

          // Buscar plano
          let plano = null;
          if (contrato.plano_id) {
            const { data } = await supabase
              .from('planos')
              .select('nome')
              .eq('id', contrato.plano_id)
              .single();
            plano = data;
          }

          // Buscar vendedor
          let vendedor = null;
          if (contrato.vendedor_id) {
            const { data } = await supabase
              .from('profiles')
              .select('nome')
              .eq('id', contrato.vendedor_id)
              .single();
          vendedor = data;
          }

          // Buscar documentos anexados via cotacao_id OU pela URL do storage que contém o cotacao_id
          let documentos: DocumentoAnexado[] = [];
          if (contrato.cotacao_id) {
            // Primeiro, tenta buscar por cotacao_id
            const { data: docs } = await supabase
              .from('contratos_documentos')
              .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
              .eq('cotacao_id', contrato.cotacao_id)
              .order('created_at', { ascending: false });
            
            if (docs && docs.length > 0) {
              documentos = docs as DocumentoAnexado[];
            } else {
              // Fallback: buscar por URL que contém o cotacao_id
              const { data: docsByUrl } = await supabase
                .from('contratos_documentos')
                .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
                .ilike('arquivo_url', `%${contrato.cotacao_id}%`)
                .order('created_at', { ascending: false });
              documentos = (docsByUrl || []) as DocumentoAnexado[];
            }
          }

          // Buscar dados extras da cotação para endereço, plano E dados de encaixe
          let enderecoCompleto: string | null = null;
          let planoNome: string | null = null;
          let instalacaoAgendada: InstalacaoAgendadaInfo | null = null;
          let tipoVistoriaCotacao: 'autovistoria' | 'agendada' | 'agendada_base' | null = null;
          let veiculoBlindadoCot: boolean | null = null;
          let cenarioAdesaoCot: string | null = null;
          
          if (contrato.cotacao_id) {
            const { data: cotacao } = await supabase
              .from('cotacoes')
              .select('cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_uf, plano_escolhido_id, vistoria_permite_encaixe, vistoria_data_agendada, vistoria_horario_agendado, tipo_vistoria, veiculo_blindado, cenario_adesao')
              .eq('id', contrato.cotacao_id)
              .maybeSingle();
            
            if (cotacao) {
              tipoVistoriaCotacao = (cotacao.tipo_vistoria as any) || null;
              veiculoBlindadoCot = (cotacao as any).veiculo_blindado ?? null;
              cenarioAdesaoCot = (cotacao as any).cenario_adesao ?? null;
              if (cotacao.cliente_logradouro) {
                enderecoCompleto = `${cotacao.cliente_logradouro}, ${cotacao.cliente_numero || 'S/N'} - ${cotacao.cliente_bairro || ''}, ${cotacao.cliente_cidade || ''} - ${cotacao.cliente_uf || ''}`;
              }
              // Buscar nome do plano separadamente
              if (cotacao.plano_escolhido_id) {
                const { data: plano } = await supabase
                  .from('planos')
                  .select('nome')
                  .eq('id', cotacao.plano_escolhido_id)
                  .maybeSingle();
                planoNome = plano?.nome || null;
              }
              
              // Dados de instalação agendada (encaixe)
              if (cotacao.vistoria_data_agendada) {
                instalacaoAgendada = {
                  data: cotacao.vistoria_data_agendada,
                  horario: cotacao.vistoria_horario_agendado || '---',
                  permite_encaixe: cotacao.vistoria_permite_encaixe || false,
                };
              }
            }
          }

          // Verificar se há documentos pendentes
          let temDocumentoPendente = false;
          if (contrato.associado_id) {
            const { count } = await supabase
              .from('documentos_solicitados')
              .select('*', { count: 'exact', head: true })
              .eq('associado_id', contrato.associado_id)
              .eq('status', 'pendente');
            temDocumentoPendente = (count || 0) > 0;
          }

      // ==== BUSCA UNIFICADA DE FOTOS DE VISTORIA ====
      // Funciona para PROPOSTAS (sem cotação) e COTAÇÕES (com cotação)
      let vistoria: VistoriaInfo | null = null;
      
      // 1. Tentar buscar vistoria vinculada ao contrato (nova arquitetura)
      const { data: vistoriaData } = await supabase
        .from('vistorias')
        .select('id, status, modalidade, observacoes, km_atual, video_360_url')
        .eq('contrato_id', contrato.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vistoriaData?.id) {
        // Buscar fotos da tabela vistoria_fotos
        const { data: fotosVistoria } = await supabase
          .from('vistoria_fotos')
          .select('id, tipo, arquivo_url, created_at')
          .eq('vistoria_id', vistoriaData.id)
          .order('created_at', { ascending: true });

        if (fotosVistoria && fotosVistoria.length > 0) {
          vistoria = {
            id: vistoriaData.id,
            status: vistoriaData.status || 'pendente',
            tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
            modalidade: vistoriaData.modalidade || undefined,
            fotos: fotosVistoria as VistoriaFotoInfo[],
            observacoes: vistoriaData.observacoes,
            km_atual: vistoriaData.km_atual,
            video_360_url: vistoriaData.video_360_url,
          };
        }
      }

      // 2. Fallback: buscar em cotacoes_vistoria_fotos (legado, apenas se tiver cotacao_id)
      // E também buscar tipo_vistoria da cotação para determinar modalidade corretamente
      if (!vistoria && contrato.cotacao_id) {
        // Primeiro, buscar o tipo_vistoria da cotação para determinar modalidade
        const { data: cotacaoTipo } = await supabase
          .from('cotacoes')
          .select('tipo_vistoria')
          .eq('id', contrato.cotacao_id)
          .maybeSingle();
        
        // Buscar vistoria pela cotacao_id para obter video_360_url
        const { data: vistoriaCotacao } = await supabase
          .from('vistorias')
          .select('video_360_url')
          .eq('cotacao_id', contrato.cotacao_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // tipo_vistoria: 'autovistoria' | 'agendada' | 'agendada_base'
        const isAutoFromCotacao = cotacaoTipo?.tipo_vistoria === 'autovistoria';
        
        const { data: fotosLegado } = await supabase
          .from('cotacoes_vistoria_fotos')
          .select('id, tipo, arquivo_url, created_at')
          .eq('cotacao_id', contrato.cotacao_id)
          .order('created_at', { ascending: true });

        if (fotosLegado && fotosLegado.length > 0) {
          // Só marcar como autovistoria se a cotação indicar isso
          vistoria = {
            id: contrato.cotacao_id,
            status: 'pendente',
            tipo: isAutoFromCotacao ? 'autovistoria' : 'agendada',
            modalidade: isAutoFromCotacao ? 'autovistoria' : 'presencial',
            fotos: fotosLegado as VistoriaFotoInfo[],
            video_360_url: vistoriaCotacao?.video_360_url || null,
          };
        }
      }

      // Buscar documentos solicitados que já foram enviados pelo cliente
      let documentosSolicitadosEnviados: DocumentoSolicitadoEnviado[] = [];
      let documentosSolicitadosPendentes: DocumentoSolicitadoPendente[] = [];
      if (contrato.associado_id) {
        const { data: docsSolicitados } = await supabase
          .from('documentos_solicitados')
          .select(`
            id,
            tipo_documento,
            descricao,
            enviado_em,
            observacao_solicitacao,
            observacao_cliente,
            documento:documentos(
              id,
              arquivo_url,
              nome_arquivo,
              status
            )
          `)
          .eq('associado_id', contrato.associado_id)
          .eq('status', 'enviado');

        if (docsSolicitados) {
          documentosSolicitadosEnviados = docsSolicitados as unknown as DocumentoSolicitadoEnviado[];
        }

        // Pendentes ainda não enviados pelo cliente (bloqueiam aprovação)
        const { data: docsPend } = await supabase
          .from('documentos_solicitados')
          .select('id, tipo_documento, descricao, observacao_solicitacao, solicitado_em, created_at')
          .eq('associado_id', contrato.associado_id)
          .eq('status', 'pendente')
          .is('enviado_em', null);

        if (docsPend) {
          documentosSolicitadosPendentes = docsPend as unknown as DocumentoSolicitadoPendente[];
        }
      }

      // ============================================
      // BUSCAR INSTALAÇÃO CONCLUÍDA COM IMEI DO RASTREADOR
      // A análise cadastral só deve acontecer APÓS instalação
      // ============================================
      let instalacaoInfo: InstalacaoInfo | null = null;
      
      const { data: instalacaoData } = await supabase
        .from('instalacoes')
        .select(`
          id,
          status,
          concluida_em,
          rastreador_id,
          instalador_id,
          assinatura_cliente_url
        `)
        .eq('contrato_id', contrato.id)
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (instalacaoData) {
        // Buscar dados do rastreador instalado (com IMEI, plataforma e status de ativação)
        let rastreadorImei: string | null = null;
        let rastreadorCodigo: string | null = null;
        let rastreadorId: string | null = null;
        let rastreadorPlataforma: string | null = null;
        let rastreadorAtivado = false;
        
        if (instalacaoData.rastreador_id) {
          const { data: rastreador } = await supabase
            .from('rastreadores')
            .select('id, imei, codigo, plataforma, plataforma_device_id')
            .eq('id', instalacaoData.rastreador_id)
            .single();
          
          if (rastreador) {
            rastreadorImei = rastreador.imei;
            rastreadorCodigo = rastreador.codigo;
            rastreadorId = rastreador.id;
            rastreadorPlataforma = rastreador.plataforma;
            rastreadorAtivado = !!rastreador.plataforma_device_id;
          }
        }
        
        // Buscar nome do instalador
        let instaladorNome: string | null = null;
        if (instalacaoData.instalador_id) {
          const { data: instalador } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', instalacaoData.instalador_id)
            .single();
          instaladorNome = instalador?.nome || null;
        }
        
        // Buscar assinatura: priorizar vistoria_fotos > servicos > instalacoes
        let assinaturaUrl = instalacaoData.assinatura_cliente_url;
        
        // Se vistoria existe, verificar se há assinatura em vistoria_fotos
        if (vistoria?.id && !assinaturaUrl) {
          const { data: fotoAssinatura } = await supabase
            .from('vistoria_fotos')
            .select('arquivo_url')
            .eq('vistoria_id', vistoria.id)
            .eq('tipo', 'assinatura_cliente')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (fotoAssinatura?.arquivo_url) {
            assinaturaUrl = fotoAssinatura.arquivo_url;
          }
        }
        
        // Fallback: buscar em servicos
        if (!assinaturaUrl) {
          const { data: servicoData } = await supabase
            .from('servicos')
            .select('assinatura_cliente_url')
            .eq('contrato_id', contrato.id)
            .not('assinatura_cliente_url', 'is', null)
            .order('concluida_em', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (servicoData?.assinatura_cliente_url) {
            assinaturaUrl = servicoData.assinatura_cliente_url;
          }
        }
        

        instalacaoInfo = {
          id: instalacaoData.id,
          status: instalacaoData.status,
          concluida_em: instalacaoData.concluida_em,
          rastreador_imei: rastreadorImei,
          rastreador_codigo: rastreadorCodigo,
          rastreador_id: rastreadorId,
          rastreador_plataforma: rastreadorPlataforma,
          rastreador_ativado: rastreadorAtivado,
          instalador_nome: instaladorNome,
          assinatura_cliente_url: assinaturaUrl,
        };
      }

      // REGRA ATUALIZADA: Incluir propostas que tenham:
      // - Instalação concluída (fluxo normal)
      // - OU Autovistoria concluída com fotos (aguardando aprovação para roubo/furto)
      // - OU Vistoria na base concluída
      const temAutovistoria = vistoria && vistoria.fotos && vistoria.fotos.length > 0;
      
      // NOVO: Verificar se tem vistoria na base concluída
      let vistoriaBaseInfo: {
        id: string;
        data_agendada: string;
        horario: string;
        status: string;
        atendido_por_nome: string | null;
      } | null = null;
      
      if (contrato.cotacao_id) {
        // Aceita 'agendado' OU 'realizado' (analista pode revisar docs já no agendamento)
        const { data: agendamentoBase } = await supabase
          .from('agendamentos_base')
          .select(`
            id, 
            data_agendada, 
            horario, 
            status,
            atendido_por_profile:profiles!agendamentos_base_atendido_por_fkey(nome)
          `)
          .eq('cotacao_id', contrato.cotacao_id)
          .in('status', ['agendado', 'realizado'])
          .order('data_agendada', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (agendamentoBase) {
          vistoriaBaseInfo = {
            id: agendamentoBase.id,
            data_agendada: agendamentoBase.data_agendada,
            horario: agendamentoBase.horario,
            status: agendamentoBase.status,
            atendido_por_nome: (agendamentoBase.atendido_por_profile as any)?.nome || null,
          };
        }
      }
      
      const temVistoriaBaseRealizada = vistoriaBaseInfo?.status === 'realizado';
      const temVistoriaBaseAgendada = vistoriaBaseInfo?.status === 'agendado';
      const temInstalacaoAgendada = !!instalacaoAgendada;

      // NOVA REGRA: incluir propostas com agendamento confirmado OU execução em andamento/concluída
      const temQualquerEtapa =
        instalacaoInfo ||
        temAutovistoria ||
        temVistoriaBaseRealizada ||
        temVistoriaBaseAgendada ||
        temInstalacaoAgendada;

      if (!temQualquerEtapa) {
        return null;
      }

      // Determinar estágio para o analista
      let tipoEtapaAnalise: TipoEtapaAnalise;
      if (instalacaoInfo) {
        tipoEtapaAnalise = 'instalacao_concluida';
      } else if (temAutovistoria || temVistoriaBaseRealizada) {
        tipoEtapaAnalise = 'vistoria_concluida';
      } else {
        tipoEtapaAnalise = 'agendamento_confirmado';
      }

          const planoTemRouboFurto = await checkPlanoTemRouboFurto(contrato.plano_id);

          return {
            ...contrato,
            tipo_etapa_analise: tipoEtapaAnalise,
            associado,
            plano,
            plano_nome: planoNome,
            endereco_completo: enderecoCompleto,
            vendedor,
            documentos,
            tem_documento_pendente: temDocumentoPendente,
            associado_status: associado?.status || null,
            vistoria,
            documentos_solicitados_enviados: documentosSolicitadosEnviados,
            documentos_solicitados_pendentes: documentosSolicitadosPendentes,
            instalacao_info: instalacaoInfo,
            instalacao_agendada: instalacaoAgendada,
            vistoria_base_info: vistoriaBaseInfo,
            tipo_vistoria: tipoVistoriaCotacao,
            veiculo_id: null, // Não disponível na lista resumida
            veiculo_cobertura_total: null, // Não disponível na lista resumida
            veiculo_renavam: null, // Não disponível na lista resumida
            veiculo_chassi: null, // Não disponível na lista resumida
            veiculo_blindado: veiculoBlindadoCot,
            cenario_adesao: cenarioAdesaoCot,
            plano_tem_roubo_furto: planoTemRouboFurto,
          } as PropostaPendente;
        })
      );

      // Filtrar propostas nulas (sem instalação concluída nem autovistoria)
      return propostasComRelacoes.filter((p): p is PropostaPendente => p !== null);
    },
    staleTime: 30000,
  });
}

// ============================================
// QUERY: Buscar proposta específica
// ============================================
export function useProposta(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['proposta', contratoId],
    queryFn: async (): Promise<PropostaPendente | null> => {
      if (!contratoId) return null;

      const { data: contrato, error } = await supabase
        .from('contratos')
        .select(`
          id,
          link_token,
          numero,
          data_assinatura,
          valor_mensal,
          status,
          cliente_nome,
          cliente_cpf,
          cliente_telefone,
          cliente_email,
          veiculo_placa,
          veiculo_modelo,
          veiculo_marca,
          veiculo_ano,
          veiculo_ano_fabricacao,
          veiculo_cor,
          veiculo_combustivel,
          veiculo_categoria,
          veiculo_tipo_uso,
          veiculo_alienado,
          veiculo_financeira,
          veiculo_procedencia,
          veiculo_valor_fipe,
          codigo_fipe,
          cobertura_fipe,
          valor_adesao,
          uso_aplicativo,
          dia_vencimento,
          associado_id,
          cotacao_id,
          plano_id,
          vendedor_id,
          pdf_assinado_url,
          updated_at
        `)
        .eq('id', contratoId)
        .single();

      if (error) throw error;
      if (!contrato) return null;

      // Buscar dados relacionados
      let associado = null;
      if (contrato.associado_id) {
        const { data } = await supabase
          .from('associados')
          .select('*')
          .eq('id', contrato.associado_id)
          .single();
        associado = data;
      }

      let plano = null;
      if (contrato.plano_id) {
        const { data } = await supabase
          .from('planos')
          .select('nome')
          .eq('id', contrato.plano_id)
          .single();
        plano = data;
      }

      let vendedor = null;
      if (contrato.vendedor_id) {
        const { data } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', contrato.vendedor_id)
          .single();
        vendedor = data;
      }

      // Buscar documentos anexados via cotacao_id OU pela URL do storage que contém o cotacao_id
      let documentos: DocumentoAnexado[] = [];
      if (contrato.cotacao_id) {
        // Primeiro, tenta buscar por cotacao_id
        const { data: docs } = await supabase
          .from('contratos_documentos')
          .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
          .eq('cotacao_id', contrato.cotacao_id)
          .order('created_at', { ascending: false });
        
        if (docs && docs.length > 0) {
          documentos = docs as DocumentoAnexado[];
        } else {
          // Fallback: buscar por URL que contém o cotacao_id
          const { data: docsByUrl } = await supabase
            .from('contratos_documentos')
            .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
            .ilike('arquivo_url', `%${contrato.cotacao_id}%`)
            .order('created_at', { ascending: false });
          documentos = (docsByUrl || []) as DocumentoAnexado[];
        }
      }

      // ============================================
      // INJETAR CONTRATO ASSINADO COMO DOCUMENTO VIRTUAL
      // O PDF assinado pela Autentique está em contratos.pdf_assinado_url
      // ============================================
      if (contrato.pdf_assinado_url) {
        documentos.unshift({
          id: `contrato-assinado-${contrato.id}`,
          tipo: 'contrato_assinado',
          arquivo_nome: `Contrato ${contrato.numero || ''} - Assinado.pdf`,
          arquivo_url: contrato.pdf_assinado_url,
          status: 'aprovado',
          created_at: contrato.data_assinatura || contrato.updated_at || new Date().toISOString(),
        });
      }

      // Buscar dados extras da cotação para endereço, plano E dados de encaixe
      let enderecoCompleto: string | null = null;
      let planoNome: string | null = null;
      let instalacaoAgendada: InstalacaoAgendadaInfo | null = null;
      let tipoVistoriaCotacao: 'autovistoria' | 'agendada' | 'agendada_base' | null = null;
      let veiculoBlindadoCot: boolean | null = null;
      let cenarioAdesaoCot: string | null = null;
      
      if (contrato.cotacao_id) {
        const { data: cotacao } = await supabase
          .from('cotacoes')
          .select(`
            cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_uf, 
            plano_escolhido_id, vistoria_permite_encaixe, 
            vistoria_data_agendada, vistoria_horario_agendado,
            vistoria_completa_data_agendada, vistoria_completa_horario_agendado,
            tipo_vistoria, veiculo_blindado, cenario_adesao
          `)
          .eq('id', contrato.cotacao_id)
          .maybeSingle();
        
        if (cotacao) {
          tipoVistoriaCotacao = (cotacao.tipo_vistoria as any) || null;
          veiculoBlindadoCot = (cotacao as any).veiculo_blindado ?? null;
          cenarioAdesaoCot = (cotacao as any).cenario_adesao ?? null;
          if (cotacao.cliente_logradouro) {
            enderecoCompleto = `${cotacao.cliente_logradouro}, ${cotacao.cliente_numero || 'S/N'} - ${cotacao.cliente_bairro || ''}, ${cotacao.cliente_cidade || ''} - ${cotacao.cliente_uf || ''}`;
          }
          // Buscar nome do plano separadamente
          if (cotacao.plano_escolhido_id) {
            const { data: plano } = await supabase
              .from('planos')
              .select('nome')
              .eq('id', cotacao.plano_escolhido_id)
              .maybeSingle();
            planoNome = plano?.nome || null;
          }
          
          // Dados de instalação agendada (encaixe) - priorizar vistoria_completa_* (autovistoria)
          const dataAgendadaEfetiva = cotacao.vistoria_completa_data_agendada || cotacao.vistoria_data_agendada;
          const horarioEfetivo = cotacao.vistoria_completa_horario_agendado || cotacao.vistoria_horario_agendado;
          
          if (dataAgendadaEfetiva) {
            instalacaoAgendada = {
              data: dataAgendadaEfetiva,
              horario: horarioEfetivo || '---',
              permite_encaixe: cotacao.vistoria_permite_encaixe || false,
            };
          }
        }
      }

      // Verificar se há documentos pendentes
      let temDocumentoPendente = false;
      if (contrato.associado_id) {
        const { count } = await supabase
          .from('documentos_solicitados')
          .select('*', { count: 'exact', head: true })
          .eq('associado_id', contrato.associado_id)
          .eq('status', 'pendente');
        temDocumentoPendente = (count || 0) > 0;
      }

      // ==== BUSCA UNIFICADA DE FOTOS DE VISTORIA ====
      // Funciona para PROPOSTAS (sem cotação) e COTAÇÕES (com cotação)
      let vistoria: VistoriaInfo | null = null;
      
      // 1. Tentar buscar vistoria vinculada ao contrato (nova arquitetura)
      const { data: vistoriaData } = await supabase
        .from('vistorias')
        .select('id, status, modalidade, observacoes, km_atual, video_360_url')
        .eq('contrato_id', contrato.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vistoriaData?.id) {
        // Buscar fotos da tabela vistoria_fotos
        const { data: fotosVistoria } = await supabase
          .from('vistoria_fotos')
          .select('id, tipo, arquivo_url, created_at')
          .eq('vistoria_id', vistoriaData.id)
          .order('created_at', { ascending: true });

        if (fotosVistoria && fotosVistoria.length > 0) {
          vistoria = {
            id: vistoriaData.id,
            status: vistoriaData.status || 'pendente',
            tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
            modalidade: vistoriaData.modalidade || undefined,
            fotos: fotosVistoria as VistoriaFotoInfo[],
            observacoes: vistoriaData.observacoes,
            km_atual: vistoriaData.km_atual,
            video_360_url: vistoriaData.video_360_url,
          };
        }
      }

      // 2. Fallback: buscar em cotacoes_vistoria_fotos (legado, apenas se tiver cotacao_id)
      if (!vistoria && contrato.cotacao_id) {
        // Buscar vistoria pela cotacao_id para obter video_360_url
        const { data: vistoriaCotacao } = await supabase
          .from('vistorias')
          .select('video_360_url, observacoes, km_atual')
          .eq('cotacao_id', contrato.cotacao_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: fotosLegado } = await supabase
          .from('cotacoes_vistoria_fotos')
          .select('id, tipo, arquivo_url, created_at')
          .eq('cotacao_id', contrato.cotacao_id)
          .order('created_at', { ascending: true });

        if (fotosLegado && fotosLegado.length > 0) {
          vistoria = {
            id: contrato.cotacao_id,
            status: 'pendente',
            tipo: 'autovistoria',
            modalidade: 'autovistoria', // Legado sempre é autovistoria
            fotos: fotosLegado as VistoriaFotoInfo[],
            video_360_url: vistoriaCotacao?.video_360_url || null,
            observacoes: vistoriaCotacao?.observacoes,
            km_atual: vistoriaCotacao?.km_atual,
          };
        }
      }

      // Buscar documentos solicitados que já foram enviados pelo cliente
      let documentosSolicitadosEnviados: DocumentoSolicitadoEnviado[] = [];
      let documentosSolicitadosPendentes: DocumentoSolicitadoPendente[] = [];
      if (contrato.associado_id) {
        const { data: docsSolicitados } = await supabase
          .from('documentos_solicitados')
          .select(`
            id,
            tipo_documento,
            descricao,
            enviado_em,
            observacao_solicitacao,
            observacao_cliente,
            documento:documentos(
              id,
              arquivo_url,
              nome_arquivo,
              status
            )
          `)
          .eq('associado_id', contrato.associado_id)
          .eq('status', 'enviado');

        if (docsSolicitados) {
          documentosSolicitadosEnviados = docsSolicitados as unknown as DocumentoSolicitadoEnviado[];
        }

        // Pendentes ainda não enviados pelo cliente (bloqueiam aprovação)
        const { data: docsPend } = await supabase
          .from('documentos_solicitados')
          .select('id, tipo_documento, descricao, observacao_solicitacao, solicitado_em, created_at')
          .eq('associado_id', contrato.associado_id)
          .eq('status', 'pendente')
          .is('enviado_em', null);

        if (docsPend) {
          documentosSolicitadosPendentes = docsPend as unknown as DocumentoSolicitadoPendente[];
        }
      }

      // ============================================
      // BUSCAR INSTALAÇÃO CONCLUÍDA COM IMEI DO RASTREADOR
      // ============================================
      let instalacaoInfo: InstalacaoInfo | null = null;
      
      const { data: instalacaoData } = await supabase
        .from('instalacoes')
        .select(`
          id,
          status,
          concluida_em,
          rastreador_id,
          instalador_id,
          assinatura_cliente_url
        `)
        .eq('contrato_id', contrato.id)
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (instalacaoData) {
        // Buscar dados do rastreador instalado (com IMEI, plataforma e status de ativação)
        let rastreadorImei: string | null = null;
        let rastreadorCodigo: string | null = null;
        let rastreadorId: string | null = null;
        let rastreadorPlataforma: string | null = null;
        let rastreadorAtivado = false;
        let instaladorNome: string | null = null;
        let assinaturaUrl = instalacaoData.assinatura_cliente_url;
        
        if (instalacaoData.rastreador_id) {
          const { data: rastreador } = await supabase
            .from('rastreadores')
            .select('id, imei, codigo, plataforma, plataforma_device_id')
            .eq('id', instalacaoData.rastreador_id)
            .maybeSingle();
          
          if (rastreador) {
            rastreadorImei = rastreador.imei;
            rastreadorCodigo = rastreador.codigo;
            rastreadorId = rastreador.id;
            rastreadorPlataforma = rastreador.plataforma;
            rastreadorAtivado = !!rastreador.plataforma_device_id;
          }
        }
        
        // Buscar nome do instalador
        if (instalacaoData.instalador_id) {
          const { data: instalador } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', instalacaoData.instalador_id)
            .maybeSingle();
          instaladorNome = instalador?.nome || null;
        }
        
        // FALLBACK: Se não tem rastreador em instalacoes, buscar em servicos
        if (!rastreadorImei) {
          const { data: servicoRastreador } = await (supabase as any)
            .from('servicos')
            .select(`
              rastreador_id,
              profissional_id,
              concluida_em,
              assinatura_cliente_url
            `)
            .eq('contrato_id', contrato.id)
            .eq('status', 'concluida')
            .not('rastreador_id', 'is', null)
            .order('concluida_em', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (servicoRastreador?.rastreador_id) {
            // Buscar dados do rastreador
            const { data: rastreadorServico } = await supabase
              .from('rastreadores')
              .select('id, imei, codigo, plataforma, plataforma_device_id')
              .eq('id', servicoRastreador.rastreador_id)
              .maybeSingle();
            
            if (rastreadorServico) {
              rastreadorImei = rastreadorServico.imei;
              rastreadorCodigo = rastreadorServico.codigo;
              rastreadorId = rastreadorServico.id;
              rastreadorPlataforma = rastreadorServico.plataforma;
              rastreadorAtivado = !!rastreadorServico.plataforma_device_id;
            }
            
            // Também pegar nome do instalador se não tinha
            if (!instaladorNome && servicoRastreador.profissional_id) {
              const { data: profissional } = await supabase
                .from('profiles')
                .select('nome')
                .eq('id', servicoRastreador.profissional_id)
                .maybeSingle();
              instaladorNome = profissional?.nome || null;
            }
            
            // E assinatura se não tinha
            if (!assinaturaUrl && servicoRastreador.assinatura_cliente_url) {
              assinaturaUrl = servicoRastreador.assinatura_cliente_url;
            }
          }
        }
        
        // Buscar assinatura: priorizar vistoria_fotos > servicos > instalacoes
        // Se vistoria existe, verificar se há assinatura em vistoria_fotos
        if (vistoria?.id && !assinaturaUrl) {
          const { data: fotoAssinatura } = await supabase
            .from('vistoria_fotos')
            .select('arquivo_url')
            .eq('vistoria_id', vistoria.id)
            .eq('tipo', 'assinatura_cliente')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (fotoAssinatura?.arquivo_url) {
            assinaturaUrl = fotoAssinatura.arquivo_url;
          }
        }
        
        // Fallback final: buscar em servicos
        if (!assinaturaUrl) {
          const { data: servicoData } = await (supabase as any)
            .from('servicos')
            .select('assinatura_cliente_url')
            .eq('contrato_id', contrato.id)
            .not('assinatura_cliente_url', 'is', null)
            .order('concluida_em', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (servicoData?.assinatura_cliente_url) {
            assinaturaUrl = servicoData.assinatura_cliente_url;
          }
        }
        

        instalacaoInfo = {
          id: instalacaoData.id,
          status: instalacaoData.status,
          concluida_em: instalacaoData.concluida_em,
          rastreador_imei: rastreadorImei,
          rastreador_codigo: rastreadorCodigo,
          rastreador_id: rastreadorId,
          rastreador_plataforma: rastreadorPlataforma,
          rastreador_ativado: rastreadorAtivado,
          instalador_nome: instaladorNome,
          assinatura_cliente_url: assinaturaUrl,
        };
      }
      
      // FALLBACK: Se não encontrou instalação concluída MAS há autovistoria ou serviço concluído,
      // buscar dados diretamente em servicos pelo contrato
      if (!instalacaoInfo) {
        const { data: servicoCompleto } = await (supabase as any)
          .from('servicos')
          .select(`
            id,
            rastreador_id,
            profissional_id,
            concluida_em,
            assinatura_cliente_url
          `)
          .eq('contrato_id', contrato.id)
          .eq('status', 'concluida')
          .order('concluida_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (servicoCompleto) {
          let rastreadorImei: string | null = null;
          let rastreadorCodigo: string | null = null;
          let rastreadorId: string | null = null;
          let rastreadorPlataforma: string | null = null;
          let rastreadorAtivado = false;
          let instaladorNome: string | null = null;
          
          // Buscar rastreador
          if (servicoCompleto.rastreador_id) {
            const { data: rastreador } = await supabase
              .from('rastreadores')
              .select('id, imei, codigo, plataforma, plataforma_device_id')
              .eq('id', servicoCompleto.rastreador_id)
              .maybeSingle();
            
            if (rastreador) {
              rastreadorImei = rastreador.imei;
              rastreadorCodigo = rastreador.codigo;
              rastreadorId = rastreador.id;
              rastreadorPlataforma = rastreador.plataforma;
              rastreadorAtivado = !!rastreador.plataforma_device_id;
            }
          }
          
          // Buscar profissional
          if (servicoCompleto.profissional_id) {
            const { data: profissional } = await supabase
              .from('profiles')
              .select('nome')
              .eq('id', servicoCompleto.profissional_id)
              .maybeSingle();
            instaladorNome = profissional?.nome || null;
          }
          
          // Buscar assinatura em vistoria_fotos se tiver vistoria
          let assinaturaUrl = servicoCompleto.assinatura_cliente_url;
          if (vistoria?.id && !assinaturaUrl) {
            const { data: fotoAssinatura } = await supabase
              .from('vistoria_fotos')
              .select('arquivo_url')
              .eq('vistoria_id', vistoria.id)
              .eq('tipo', 'assinatura_cliente')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (fotoAssinatura?.arquivo_url) {
              assinaturaUrl = fotoAssinatura.arquivo_url;
            }
          }
          
          instalacaoInfo = {
            id: servicoCompleto.id,
            status: 'concluida',
            concluida_em: servicoCompleto.concluida_em,
            rastreador_imei: rastreadorImei,
            rastreador_codigo: rastreadorCodigo,
            rastreador_id: rastreadorId,
            rastreador_plataforma: rastreadorPlataforma,
            rastreador_ativado: rastreadorAtivado,
            instalador_nome: instaladorNome,
            assinatura_cliente_url: assinaturaUrl,
          };
        }
      }

      // Buscar veículo_id e cobertura_total do veículo
      // Priorizar contrato.veiculo_id (determinístico), fallback por associado_id
      let veiculoId: string | null = null;
      let veiculoCoberturaTotal: boolean | null = null;
      let veiculoRenavam: string | null = null;
      let veiculoChassi: string | null = null;
      
      const veiculoFilter = (contrato as any).veiculo_id 
        ? supabase.from('veiculos').select('id, cobertura_total, renavam, chassi').eq('id', (contrato as any).veiculo_id).maybeSingle()
        : contrato.associado_id 
          ? supabase.from('veiculos').select('id, cobertura_total, renavam, chassi').eq('associado_id', contrato.associado_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : null;
      
      if (veiculoFilter) {
        const { data: veiculo } = await veiculoFilter;
        if (veiculo) {
          veiculoId = veiculo.id;
          veiculoCoberturaTotal = veiculo.cobertura_total;
          veiculoRenavam = veiculo.renavam;
          veiculoChassi = veiculo.chassi;
        }
      }

      // NOVO: Buscar vistoria na base realizada
      let vistoriaBaseInfo: {
        id: string;
        data_agendada: string;
        horario: string;
        status: string;
        atendido_por_nome: string | null;
      } | null = null;
      
      if (contrato.cotacao_id) {
        const { data: agendamentoBase } = await supabase
          .from('agendamentos_base')
          .select(`
            id, 
            data_agendada, 
            horario, 
            status,
            atendido_por_profile:profiles!agendamentos_base_atendido_por_fkey(nome)
          `)
          .eq('cotacao_id', contrato.cotacao_id)
          .in('status', ['agendado', 'realizado'])
          .order('data_agendada', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (agendamentoBase) {
          vistoriaBaseInfo = {
            id: agendamentoBase.id,
            data_agendada: agendamentoBase.data_agendada,
            horario: agendamentoBase.horario,
            status: agendamentoBase.status,
            atendido_por_nome: (agendamentoBase.atendido_por_profile as any)?.nome || null,
          };
        }
      }

      // Determinar estágio para o analista (mesma lógica da listagem)
      const temAutovistoriaProp = vistoria && vistoria.fotos && vistoria.fotos.length > 0;
      const temVistoriaBaseRealizadaProp = vistoriaBaseInfo?.status === 'realizado';
      let tipoEtapaAnaliseSingle: TipoEtapaAnalise | null = null;
      if (instalacaoInfo) {
        tipoEtapaAnaliseSingle = 'instalacao_concluida';
      } else if (temAutovistoriaProp || temVistoriaBaseRealizadaProp) {
        tipoEtapaAnaliseSingle = 'vistoria_concluida';
      } else if (instalacaoAgendada || vistoriaBaseInfo?.status === 'agendado') {
        tipoEtapaAnaliseSingle = 'agendamento_confirmado';
      }

      const planoTemRouboFurto = await checkPlanoTemRouboFurto(contrato.plano_id);

      const result: PropostaPendente = {
        ...contrato,
        tipo_etapa_analise: tipoEtapaAnaliseSingle,
        associado,
        plano,
        plano_nome: planoNome,
        endereco_completo: enderecoCompleto,
        vendedor,
        documentos,
        tem_documento_pendente: temDocumentoPendente,
        associado_status: associado?.status || null,
        vistoria,
        documentos_solicitados_enviados: documentosSolicitadosEnviados,
        documentos_solicitados_pendentes: documentosSolicitadosPendentes,
        instalacao_info: instalacaoInfo,
        instalacao_agendada: instalacaoAgendada,
        vistoria_base_info: vistoriaBaseInfo,
        tipo_vistoria: tipoVistoriaCotacao,
        veiculo_id: veiculoId,
        veiculo_cobertura_total: veiculoCoberturaTotal,
        veiculo_renavam: veiculoRenavam,
        veiculo_chassi: veiculoChassi,
        veiculo_blindado: veiculoBlindadoCot,
        cenario_adesao: cenarioAdesaoCot,
        plano_tem_roubo_furto: planoTemRouboFurto,
      };
      return result;
    },
    enabled: !!contratoId,
  });
}

// ============================================
// QUERY: Estatísticas de propostas
// ============================================
export function usePropostaStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['propostas-stats'],
    queryFn: async (): Promise<PropostaStats> => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();

      // ========================================
      // AGUARDANDO: Usar mesma lógica da lista
      // Só conta propostas PRONTAS para análise:
      // - Com autovistoria (fotos enviadas) OU
      // - Com instalação/vistoria concluída
      // ========================================
      const { data: contratosAssinados } = await supabase
        .from('contratos')
        .select('id, cotacao_id')
        .eq('status', 'assinado');

      let aguardando = 0;

      if (contratosAssinados && contratosAssinados.length > 0) {
        // Buscar instalações concluídas para todos os contratos
        const contratoIds = contratosAssinados.map(c => c.id);
        const { data: instalacoesConcluidas } = await supabase
          .from('instalacoes')
          .select('contrato_id')
          .in('contrato_id', contratoIds)
          .eq('status', 'concluida');

        const contratosComInstalacao = new Set(
          instalacoesConcluidas?.map(i => i.contrato_id) || []
        );

        // Buscar cotações com fotos de autovistoria
        const cotacaoIds = contratosAssinados
          .map(c => c.cotacao_id)
          .filter(Boolean) as string[];

        let cotacoesComFotos = new Set<string>();
        if (cotacaoIds.length > 0) {
          const { data: fotosData } = await supabase
            .from('cotacoes_vistoria_fotos')
            .select('cotacao_id')
            .in('cotacao_id', cotacaoIds);

          cotacoesComFotos = new Set(fotosData?.map(f => f.cotacao_id) || []);
        }

        // NOVO: Buscar agendamentos base realizados
        let cotacoesComVistoriaBase = new Set<string>();
        if (cotacaoIds.length > 0) {
          const { data: agendamentosRealizados } = await supabase
            .from('agendamentos_base')
            .select('cotacao_id')
            .in('cotacao_id', cotacaoIds)
            .eq('status', 'realizado');

          cotacoesComVistoriaBase = new Set(
            agendamentosRealizados?.map(a => a.cotacao_id).filter(Boolean) as string[] || []
          );
        }

        // Contar apenas propostas prontas para análise
        aguardando = contratosAssinados.filter(contrato => {
          // Tem instalação concluída?
          if (contratosComInstalacao.has(contrato.id)) return true;
          // Tem autovistoria com fotos?
          if (contrato.cotacao_id && cotacoesComFotos.has(contrato.cotacao_id)) return true;
          // NOVO: Tem vistoria na base realizada?
          if (contrato.cotacao_id && cotacoesComVistoriaBase.has(contrato.cotacao_id)) return true;
          return false;
        }).length;
      }

      // Buscar contratos em análise (pendente é usado para em análise)
      const { count: emAnalise } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');

      // Buscar contratos aprovados hoje
      const { count: aprovadosHoje } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .gte('data_ativacao', hojeISO);

      // Buscar contratos cancelados hoje (usado como reprovados)
      const { count: reprovadosHoje } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelado')
        .gte('updated_at', hojeISO);

      return {
        aguardando,
        emAnalise: emAnalise || 0,
        aprovadosHoje: aprovadosHoje || 0,
        reprovadosHoje: reprovadosHoje || 0,
      };
    },
    staleTime: 30000,
  });
}

// ============================================
// MUTATION: Aprovar proposta
// ============================================
export function useAprovarProposta() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: { contratoId: string; veiculoRenavam?: string; veiculoChassi?: string }) => {
      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('aprovar-proposta', {
        body: {
          contrato_id: params.contratoId,
          aprovado_por: profile.id,
          veiculo_renavam: params.veiculoRenavam || null,
          veiculo_chassi: params.veiculoChassi || null,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao aprovar proposta');
      if (!data?.success) throw new Error(data?.error || 'Erro ao aprovar proposta');

      return {
        contratoId: params.contratoId,
        associadoId: data.associadoId,
        jaAprovado: data.jaAprovado,
        mensagem: data.mensagem,
      };
    },
    onSuccess: async (result) => {
      // Mostrar mensagem apropriada baseada no resultado
      if (result.jaAprovado) {
        toast.info(result.mensagem);
      } else {
        toast.success(result.mensagem);
      }
      
      // Invalidar e forçar refetch imediato de todas as queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] }),
        queryClient.invalidateQueries({ queryKey: ['propostas-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['proposta'] }),
        queryClient.invalidateQueries({ queryKey: ['associados'] }),
        queryClient.invalidateQueries({ queryKey: ['contratos'] }),
        queryClient.invalidateQueries({ queryKey: ['instalacoes'] }),
        queryClient.invalidateQueries({ queryKey: ['cobrancas'] }),
      ]);
      
      // Forçar refetch imediato das propostas pendentes
      await queryClient.refetchQueries({ queryKey: ['propostas-pendentes'] });
    },
    onError: (error: Error) => {
      console.error('Erro ao aprovar proposta:', error);
      toast.error(error.message || 'Erro ao aprovar proposta. Tente novamente.');
    },
  });
}

// ============================================
// MUTATION: Solicitar documentos
// ============================================
interface SolicitarDocumentosParams {
  contratoId: string;
  associadoId: string;
  documentos: string[];
  observacoes: string;
}

export function useSolicitarDocumentos() {
  const queryClient = useQueryClient();
  const { profile } = useAuth(); // Usar profile.id (da tabela profiles)

  return useMutation({
    mutationFn: async ({ contratoId, associadoId, documentos, observacoes }: SolicitarDocumentosParams) => {
      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: contratoComLink } = await supabase
        .from('contratos')
        .select('link_token, cotacao_token_publico')
        .eq('id', contratoId)
        .single();

      const linkPendencias = contratoComLink?.link_token
        ? `${APP_BASE_URL}/acompanhar/${contratoComLink.link_token}`
        : contratoComLink?.cotacao_token_publico
          ? `${APP_BASE_URL}/cotacao/${contratoComLink.cotacao_token_publico}`
          : null;

      // 1. Criar registros na tabela documentos_solicitados
      const docsParaInserir = documentos.map((tipo) => ({
        associado_id: associadoId,
        contrato_id: contratoId,
        tipo_documento: tipo,
        status: 'pendente',
        solicitado_por: profile.id,
        observacao_solicitacao: observacoes || null,
      }));

      const { error: docsError } = await supabase
        .from('documentos_solicitados')
        .insert(docsParaInserir);

      if (docsError) {
        console.error('Erro ao criar docs solicitados:', docsError);
        throw docsError;
      }

      // 2. Atualizar status do associado
      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'documentacao_pendente' as any,
        })
        .eq('id', associadoId);

      if (associadoError) throw associadoError;

      // 3. Registrar histórico (usando profile.id que referencia profiles)
      const { error: historicoError } = await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          contrato_id: contratoId,
          tipo: 'status_alterado',
          descricao: `Documentos solicitados: ${documentos.join(', ')}. ${observacoes || ''}`,
          usuario_id: profile.id,
        });

      if (historicoError) {
        console.warn('Erro ao registrar histórico (não crítico):', historicoError);
        // Não falhar por causa do histórico
      }

      let notificacaoResultado: unknown = null;
      let notificacaoErro: string | null = null;

      // 4. Enviar notificação via WhatsApp com link de acompanhamento
      try {
        // Mapa de labels para documentos
        const DOCUMENTO_LABELS: Record<string, string> = {
          cnh: 'CNH',
          crlv: 'CRLV',
          comprovante_residencia: 'Comprovante de Residência',
          selfie_veiculo: 'Selfie com Veículo',
          frente: 'Foto Frente do Veículo',
          traseira: 'Foto Traseira',
          lateral_direita: 'Foto Lateral Direita',
          lateral_esquerda: 'Foto Lateral Esquerda',
          odometro: 'Foto do Odômetro',
          chassi: 'Foto do Chassi',
          motor: 'Foto do Motor',
          video_360: 'Vídeo 360° do Veículo',
          painel: 'Foto do Painel',
          banco_dianteiro: 'Foto Banco Dianteiro',
          banco_traseiro: 'Foto Banco Traseiro',
          pneu_dianteiro_direito: 'Pneu Dianteiro Direito',
          pneu_dianteiro_esquerdo: 'Pneu Dianteiro Esquerdo',
          pneu_traseiro_direito: 'Pneu Traseiro Direito',
          pneu_traseiro_esquerdo: 'Pneu Traseiro Esquerdo',
          outro: 'Outro Documento',
        };

        // Formatar lista de documentos com labels legíveis
        const docsFormatados = documentos
          .map((id) => `• ${DOCUMENTO_LABELS[id] || id}`)
          .join('\n');

        const { data: notifData, error: notifError } = await supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'documentos_solicitados',
            associado_id: associadoId,
            dados: {
              documentos: docsFormatados,
              observacoes: observacoes ? `📝 Obs: ${observacoes}` : '',
              link_acompanhamento: linkPendencias || 'Acesse pelo link enviado anteriormente',
            },
          },
        });
        if (notifError) throw notifError;
        notificacaoResultado = notifData;
        console.log('[useSolicitarDocumentos] Notificação WhatsApp enviada com link:', linkPendencias);
      } catch (notifError) {
        notificacaoErro = notifError instanceof Error ? notifError.message : 'Erro desconhecido na notificação';
        console.warn('[useSolicitarDocumentos] Erro ao enviar notificação (não crítico):', notifError);
        // Não falhar por causa da notificação
      }

      await supabase.from('logs_auditoria').insert({
        usuario_id: profile.id,
        usuario_nome: (profile as any)?.nome || (profile as any)?.email || 'Cadastro',
        acao: 'documentos_solicitados_criados',
        modulo: 'cadastro',
        tabela: 'documentos_solicitados',
        registro_id: contratoId,
        descricao: `Cadastro solicitou ${documentos.length} pendência(s) documental(is) ao associado`,
        dados_novos: {
          contrato_id: contratoId,
          associado_id: associadoId,
          documentos,
          observacoes: observacoes || null,
          link_publico: linkPendencias,
          notificacao_resultado: notificacaoResultado,
          notificacao_erro: notificacaoErro,
        },
      } as any);

      return { contratoId, associadoId, linkPendencias };
    },
    onSuccess: () => {
      toast.success('Documentos solicitados! O cliente será notificado no link de acompanhamento.');
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['docs-solicitados'] });
    },
    onError: (error) => {
      console.error('Erro ao solicitar documentos:', error);
      toast.error('Erro ao enviar solicitação. Tente novamente.');
    },
  });
}

// ============================================
// MUTATION: Reprovar proposta
// ============================================
interface ReprovarPropostaParams {
  contratoId: string;
  associadoId: string;
  motivo: string;
  justificativa: string;
}

export function useReprovarProposta() {
  const queryClient = useQueryClient();
  const { profile } = useAuth(); // Usar profile.id (da tabela profiles)

  return useMutation({
    mutationFn: async ({ contratoId, associadoId, motivo, justificativa }: ReprovarPropostaParams) => {
      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar veículo do associado
      const { data: veiculoData } = await supabase
        .from('veiculos')
        .select('id, placa, chassi')
        .eq('associado_id', associadoId)
        .limit(1)
        .maybeSingle();

      // Atualizar contrato (usar 'cancelado' pois 'reprovado' não existe no enum)
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({
          status: 'cancelado',
          motivo_cancelamento: `REPROVADO - ${motivo}: ${justificativa}`,
        })
        .eq('id', contratoId);

      if (contratoError) throw contratoError;

      // Atualizar associado para recusado
      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'recusado',
        })
        .eq('id', associadoId);

      if (associadoError) throw associadoError;

      // Atualizar veículo para 'recusado' e adicionar à blacklist
      if (veiculoData?.id) {
        // Atualizar status do veículo
        const { error: veiculoError } = await supabase
          .from('veiculos')
          .update({ 
            status: 'recusado',
            motivo_recusa_veiculo: `${motivo}: ${justificativa}`,
          })
          .eq('id', veiculoData.id);

        if (veiculoError) {
          console.warn('Erro ao atualizar veículo (não crítico):', veiculoError);
        }

        // Adicionar veículo à blacklist
        if (veiculoData.placa) {
          const { error: blacklistError } = await supabase
            .from('blacklist_veiculos')
            .insert({
              placa: veiculoData.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
              chassi: veiculoData.chassi,
              motivo: motivo,
              justificativa: justificativa,
              tipo_reprovacao: 'proposta_reprovada',
              veiculo_id: veiculoData.id,
              associado_id: associadoId,
              contrato_id: contratoId,
              adicionado_por: profile.id,
              ativo: true,
            });

          if (blacklistError) {
            console.warn('Erro ao adicionar à blacklist (não crítico):', blacklistError);
          }
        }
      }

      // Registrar histórico (usando profile.id)
      const { error: historicoError } = await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          contrato_id: contratoId,
          tipo: 'status_alterado',
          descricao: `Proposta reprovada. Motivo: ${motivo}. ${justificativa || ''}`,
          usuario_id: profile.id,
        });

      if (historicoError) {
        console.warn('Erro ao registrar histórico (não crítico):', historicoError);
      }

      return { contratoId, associadoId };
    },
    onSuccess: () => {
      toast.success('Proposta reprovada e veículo adicionado à blacklist.');
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
    },
    onError: (error) => {
      console.error('Erro ao reprovar proposta:', error);
      toast.error('Erro ao reprovar proposta. Tente novamente.');
    },
  });
}
