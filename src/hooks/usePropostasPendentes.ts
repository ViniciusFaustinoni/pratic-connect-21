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
  // Endereço de INSTALAÇÃO (vindo da tabela `instalacoes`, não do snapshot da vistoria)
  endereco_logradouro?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_uf?: string | null;
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
  /**
   * Timestamp usado para o "tempo de espera" exibido na lista.
   * É o mais recente entre: assinatura, última atualização do contrato,
   * criação da vistoria, conclusão da instalação e criação do agendamento.
   * Reflete o tempo na fila atual (não o tempo desde a assinatura).
   */
  tempo_referencia: string | null;
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
  /** True quando o Cadastro já aprovou a proposta (flag em contratos.cadastro_aprovado). */
  cadastro_aprovado: boolean;
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
// QUERY: Buscar propostas pendentes (BATCHED — Fase 5)
// Antes: N+1 (~85+ requests por página). Agora: ~14 requests fixas
// independentemente do nº de propostas, usando .in() + Maps em memória.
// ============================================
export function usePropostasPendentes() {
  return useQuery({
    queryKey: ['propostas-pendentes'],
    queryFn: async (): Promise<PropostaPendente[]> => {
      // 1) Contratos assinados (base)
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
          veiculo_id,
          cadastro_aprovado,
          updated_at
        `)
        .eq('status', 'assinado')
        .order('data_assinatura', { ascending: true });

      if (error) throw error;
      const lista = contratos || [];
      if (lista.length === 0) return [];

      // 2) Coletar todos os IDs únicos
      const associadoIds = Array.from(new Set(lista.map(c => c.associado_id).filter(Boolean))) as string[];
      const veiculoIds = Array.from(new Set(lista.map(c => c.veiculo_id).filter(Boolean))) as string[];
      const planoIds = Array.from(new Set(lista.map(c => c.plano_id).filter(Boolean))) as string[];
      const vendedorIds = Array.from(new Set(lista.map(c => c.vendedor_id).filter(Boolean))) as string[];
      const cotacaoIds = Array.from(new Set(lista.map(c => c.cotacao_id).filter(Boolean))) as string[];
      const contratoIds = lista.map(c => c.id);

      // 3) BATCH em paralelo — todas as buscas relacionadas
      const [
        associadosRes,
        veiculosRes,
        planosRes,
        vendedoresRes,
        cotacoesRes,
        documentosRes,
        instalacoesAtivasRes,
        instalacoesConcluidasRes,
        vistoriasRes,
        docsSolicitadosRes,
        agendamentosBaseRes,
        planosCoberturasRes,
      ] = await Promise.all([
        associadoIds.length
          ? supabase.from('associados').select('*').in('id', associadoIds)
          : Promise.resolve({ data: [] as any[] }),
        veiculoIds.length
          ? supabase.from('veiculos').select('id, status, cobertura_total, chassi, renavam, codigo_hinova, sincronizado_hinova').in('id', veiculoIds)
          : Promise.resolve({ data: [] as any[] }),
        planoIds.length
          ? supabase.from('planos').select('id, nome').in('id', planoIds)
          : Promise.resolve({ data: [] as any[] }),
        vendedorIds.length
          ? supabase.from('profiles').select('id, nome').in('id', vendedorIds)
          : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
          ? supabase
              .from('cotacoes')
              .select('id, cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_uf, plano_escolhido_id, vistoria_permite_encaixe, vistoria_data_agendada, vistoria_horario_agendado, vistoria_periodo, vistoria_completa_data_agendada, vistoria_completa_horario_agendado, vistoria_completa_periodo, tipo_vistoria, veiculo_blindado, cenario_adesao')
              .in('id', cotacaoIds)
          : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
          ? supabase
              .from('contratos_documentos')
              .select('id, cotacao_id, tipo, arquivo_nome, arquivo_url, status, created_at')
              .in('cotacao_id', cotacaoIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('instalacoes')
          .select('id, contrato_id, veiculo_id, data_agendada, periodo, hora_agendada, permite_encaixe, logradouro, numero, bairro, cidade, uf, status, created_at')
          .in('contrato_id', contratoIds)
          .not('status', 'in', '(cancelada,concluida)')
          .order('created_at', { ascending: false }),
        supabase
          .from('instalacoes')
          .select('id, contrato_id, veiculo_id, status, concluida_em, rastreador_id, instalador_id, assinatura_cliente_url')
          .in('contrato_id', contratoIds)
          .eq('status', 'concluida')
          .order('concluida_em', { ascending: false }),
        supabase
          .from('vistorias')
          .select('id, contrato_id, cotacao_id, status, modalidade, observacoes, km_atual, video_360_url, created_at')
          .or(`contrato_id.in.(${contratoIds.join(',')})${cotacaoIds.length ? `,cotacao_id.in.(${cotacaoIds.join(',')})` : ''}`)
          .order('created_at', { ascending: false }),
        associadoIds.length
          ? supabase
              .from('documentos_solicitados')
              .select(`
                id,
                associado_id,
                tipo_documento,
                descricao,
                status,
                enviado_em,
                solicitado_em,
                created_at,
                observacao_solicitacao,
                observacao_cliente,
                documento:documentos(id, arquivo_url, nome_arquivo, status)
              `)
              .in('associado_id', associadoIds)
              .in('status', ['enviado', 'pendente'])
          : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
          ? supabase
              .from('agendamentos_base')
              .select(`id, cotacao_id, data_agendada, horario, status, atendido_por_profile:profiles!agendamentos_base_atendido_por_fkey(nome)`)
              .in('cotacao_id', cotacaoIds)
              .in('status', ['agendado', 'realizado'])
              .order('data_agendada', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        planoIds.length
          ? supabase.from('planos_coberturas').select('plano_id, coberturas(nome)').in('plano_id', planoIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // 4) Indexar tudo em Maps para O(1) lookup
      const mAssociado = new Map<string, any>((associadosRes.data || []).map((r: any) => [r.id, r]));
      const mVeiculo = new Map<string, any>((veiculosRes.data || []).map((r: any) => [r.id, r]));
      const mPlano = new Map<string, any>((planosRes.data || []).map((r: any) => [r.id, r]));
      const mVendedor = new Map<string, any>((vendedoresRes.data || []).map((r: any) => [r.id, r]));
      const mCotacao = new Map<string, any>((cotacoesRes.data || []).map((r: any) => [r.id, r]));

      // Documentos por cotacao_id
      const mDocsPorCotacao = new Map<string, DocumentoAnexado[]>();
      for (const d of (documentosRes.data || []) as any[]) {
        const arr = mDocsPorCotacao.get(d.cotacao_id) || [];
        arr.push(d);
        mDocsPorCotacao.set(d.cotacao_id, arr);
      }

      // Instalações ativas (1ª por contrato — já vem ordenado desc)
      const mInstAtiva = new Map<string, any>();
      for (const r of (instalacoesAtivasRes.data || []) as any[]) {
        if (!mInstAtiva.has(r.contrato_id)) mInstAtiva.set(r.contrato_id, r);
      }
      // Instalações concluídas (1ª por contrato, respeitando veiculo_id se houver)
      const mInstConcluida = new Map<string, any>();
      for (const r of (instalacoesConcluidasRes.data || []) as any[]) {
        const key = r.contrato_id;
        if (!mInstConcluida.has(key)) mInstConcluida.set(key, r);
      }

      // Vistorias: 1ª por contrato e 1ª por cotação (ordenadas desc)
      const mVistoriaPorContrato = new Map<string, any>();
      const mVistoriaPorCotacao = new Map<string, any>();
      for (const v of (vistoriasRes.data || []) as any[]) {
        if (v.contrato_id && !mVistoriaPorContrato.has(v.contrato_id)) mVistoriaPorContrato.set(v.contrato_id, v);
        if (v.cotacao_id && !mVistoriaPorCotacao.has(v.cotacao_id)) mVistoriaPorCotacao.set(v.cotacao_id, v);
      }

      // Documentos solicitados agrupados por associado
      const mDocsSolicEnviados = new Map<string, DocumentoSolicitadoEnviado[]>();
      const mDocsSolicPendentes = new Map<string, DocumentoSolicitadoPendente[]>();
      const mTemDocPendente = new Map<string, boolean>();
      for (const d of (docsSolicitadosRes.data || []) as any[]) {
        if (d.status === 'enviado') {
          const arr = mDocsSolicEnviados.get(d.associado_id) || [];
          arr.push(d as DocumentoSolicitadoEnviado);
          mDocsSolicEnviados.set(d.associado_id, arr);
        } else if (d.status === 'pendente' && !d.enviado_em) {
          const arr = mDocsSolicPendentes.get(d.associado_id) || [];
          arr.push(d as DocumentoSolicitadoPendente);
          mDocsSolicPendentes.set(d.associado_id, arr);
          mTemDocPendente.set(d.associado_id, true);
        }
      }

      // Agendamentos base por cotação (1º — desc por data_agendada)
      const mAgendBase = new Map<string, any>();
      for (const a of (agendamentosBaseRes.data || []) as any[]) {
        if (!mAgendBase.has(a.cotacao_id)) mAgendBase.set(a.cotacao_id, a);
      }

      // Plano tem roubo/furto
      const mPlanoRouboFurto = new Map<string, boolean>();
      for (const row of (planosCoberturasRes.data || []) as any[]) {
        const nome = row?.coberturas?.nome || '';
        if (/roubo|furto/i.test(nome)) mPlanoRouboFurto.set(row.plano_id, true);
      }

      // 5) BATCH secundário: precisa de IDs vindos das instalações concluídas + vistorias
      const rastreadorIds = Array.from(new Set(
        Array.from(mInstConcluida.values()).map((i: any) => i.rastreador_id).filter(Boolean)
      )) as string[];
      const instaladorIds = Array.from(new Set(
        Array.from(mInstConcluida.values()).map((i: any) => i.instalador_id).filter(Boolean)
      )) as string[];
      const vistoriaIdsParaFotos = Array.from(new Set([
        ...Array.from(mVistoriaPorContrato.values()).map((v: any) => v.id),
        ...Array.from(mVistoriaPorCotacao.values()).map((v: any) => v.id),
      ].filter(Boolean))) as string[];

      const [rastreadoresRes, instaladoresRes, fotosVistoriaRes, fotosLegadoRes, vistoriaCotacaoVideoRes, servicosRes] = await Promise.all([
        rastreadorIds.length
          ? supabase.from('rastreadores').select('id, imei, codigo, plataforma, plataforma_device_id').in('id', rastreadorIds)
          : Promise.resolve({ data: [] as any[] }),
        instaladorIds.length
          ? supabase.from('profiles').select('id, nome').in('id', instaladorIds)
          : Promise.resolve({ data: [] as any[] }),
        vistoriaIdsParaFotos.length
          ? supabase
              .from('vistoria_fotos')
              .select('id, vistoria_id, tipo, arquivo_url, created_at')
              .in('vistoria_id', vistoriaIdsParaFotos)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
          ? supabase
              .from('cotacoes_vistoria_fotos')
              .select('id, cotacao_id, tipo, arquivo_url, created_at')
              .in('cotacao_id', cotacaoIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
          ? supabase
              .from('vistorias')
              .select('cotacao_id, video_360_url, created_at')
              .in('cotacao_id', cotacaoIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('servicos')
          .select('contrato_id, assinatura_cliente_url, concluida_em')
          .in('contrato_id', contratoIds)
          .not('assinatura_cliente_url', 'is', null)
          .order('concluida_em', { ascending: false }),
      ]);

      const mRastreador = new Map<string, any>((rastreadoresRes.data || []).map((r: any) => [r.id, r]));
      const mInstalador = new Map<string, any>((instaladoresRes.data || []).map((r: any) => [r.id, r]));

      const mFotosPorVistoria = new Map<string, VistoriaFotoInfo[]>();
      for (const f of (fotosVistoriaRes.data || []) as any[]) {
        const arr = mFotosPorVistoria.get(f.vistoria_id) || [];
        arr.push(f as VistoriaFotoInfo);
        mFotosPorVistoria.set(f.vistoria_id, arr);
      }
      const mFotosLegadoPorCotacao = new Map<string, VistoriaFotoInfo[]>();
      for (const f of (fotosLegadoRes.data || []) as any[]) {
        const arr = mFotosLegadoPorCotacao.get(f.cotacao_id) || [];
        arr.push(f as VistoriaFotoInfo);
        mFotosLegadoPorCotacao.set(f.cotacao_id, arr);
      }
      const mVideoPorCotacao = new Map<string, string | null>();
      for (const v of (vistoriaCotacaoVideoRes.data || []) as any[]) {
        if (!mVideoPorCotacao.has(v.cotacao_id)) mVideoPorCotacao.set(v.cotacao_id, v.video_360_url || null);
      }
      const mServicoSig = new Map<string, string>();
      for (const s of (servicosRes.data || []) as any[]) {
        if (!mServicoSig.has(s.contrato_id)) mServicoSig.set(s.contrato_id, s.assinatura_cliente_url);
      }

      // 6) Montar resultado iterando localmente (sem mais I/O)
      const propostas: (PropostaPendente | null)[] = lista.map((contrato) => {
        const associado = contrato.associado_id ? mAssociado.get(contrato.associado_id) : null;
        const veiculoContrato = contrato.veiculo_id ? mVeiculo.get(contrato.veiculo_id) : null;

        // Esconde propostas que não pertencem mais ao Cadastro:
        // 1) Associado já ativo (no SGA) → nada a fazer aqui
        // 2) Instalação concluída → fila de Aprovações do Monitoramento
        // 3) Associado em aguardando_instalacao SEM docs pendentes e SEM vistoria pendente
        //    → já foi para a fila de Instalações/Agendas
        const docsPendentes = contrato.associado_id
          ? !!mTemDocPendente.get(contrato.associado_id)
          : false;
        const vistoriaPendenteAnalise = (() => {
          const v = mVistoriaPorContrato.get(contrato.id) || (contrato.cotacao_id ? mVistoriaPorCotacao.get(contrato.cotacao_id) : null);
          if (!v) return false;
          // status que ainda demandam ação do Cadastro
          return ['pendente', 'em_analise', 'aguardando_aprovacao', 'em_andamento'].includes(v.status);
        })();
        const instalacaoConcluida = mInstConcluida.has(contrato.id);

        // Já sincronizado no SGA Hinova — avaliado por VEÍCULO do contrato
        // (não pelo associado), porque inclusões de veículo herdam um associado
        // que já pode estar 'ativo' por contratos anteriores. Usar o status do
        // associado aqui jogava toda inclusão no limbo (não aparecia em lugar
        // nenhum). A verdade da proposta é o veículo + instalação dela.
        const veiculoJaNoSGA =
          !!(veiculoContrato?.sincronizado_hinova && veiculoContrato?.codigo_hinova);

        // Saída de Propostas Pendentes por tipo de vistoria:
        // - Autovistoria: sai assim que o Cadastro aprova (vai p/ /cadastro/associados)
        // - Não-autovistoria (agendada / agendada_base / null): permanece com badge
        //   "Pendente Vistoria Inicial" até a INSTALAÇÃO ser concluída
        const cadastroAprovado = (contrato as any).cadastro_aprovado === true;
        const tipoVistoriaAtual = (contrato.cotacao_id ? mCotacao.get(contrato.cotacao_id)?.tipo_vistoria : null) || null;
        const isAutovistoria = tipoVistoriaAtual === 'autovistoria';
        const autovistoriaJaAprovadaPeloCadastro = cadastroAprovado && isAutovistoria;

        const propostaJaConcluida =
          instalacaoConcluida ||
          veiculoJaNoSGA ||
          autovistoriaJaAprovadaPeloCadastro;
        if (propostaJaConcluida) return null;

        const plano = contrato.plano_id ? mPlano.get(contrato.plano_id) : null;
        const vendedor = contrato.vendedor_id ? mVendedor.get(contrato.vendedor_id) : null;
        const cotacao = contrato.cotacao_id ? mCotacao.get(contrato.cotacao_id) : null;

        const documentos: DocumentoAnexado[] = contrato.cotacao_id
          ? (mDocsPorCotacao.get(contrato.cotacao_id) || [])
          : [];

        // Endereço, plano-nome e instalação agendada vindos da cotação
        let enderecoCompleto: string | null = null;
        let planoNome: string | null = null;
        let instalacaoAgendada: InstalacaoAgendadaInfo | null = null;
        let tipoVistoriaCotacao: 'autovistoria' | 'agendada' | 'agendada_base' | null = null;
        let veiculoBlindadoCot: boolean | null = null;
        let cenarioAdesaoCot: string | null = null;

        if (cotacao) {
          tipoVistoriaCotacao = (cotacao.tipo_vistoria as any) || null;
          veiculoBlindadoCot = cotacao.veiculo_blindado ?? null;
          cenarioAdesaoCot = cotacao.cenario_adesao ?? null;
          if (cotacao.cliente_logradouro) {
            enderecoCompleto = `${cotacao.cliente_logradouro}, ${cotacao.cliente_numero || 'S/N'} - ${cotacao.cliente_bairro || ''}, ${cotacao.cliente_cidade || ''} - ${cotacao.cliente_uf || ''}`;
          }
          if (cotacao.plano_escolhido_id) {
            planoNome = mPlano.get(cotacao.plano_escolhido_id)?.nome || null;
          }
          // Prioriza vistoria_completa_* (fluxo público de rota / autovistoria),
          // cai para vistoria_* (presencial simples). Mantém o item visível na
          // fila enquanto o agendamento existir, mesmo antes da materialização.
          const dataAgEff = (cotacao as any).vistoria_completa_data_agendada || cotacao.vistoria_data_agendada;
          const horarioAgEff = (cotacao as any).vistoria_completa_horario_agendado
            || (cotacao as any).vistoria_completa_periodo
            || cotacao.vistoria_horario_agendado
            || (cotacao as any).vistoria_periodo;
          if (dataAgEff) {
            instalacaoAgendada = {
              data: dataAgEff,
              horario: horarioAgEff || '---',
              permite_encaixe: cotacao.vistoria_permite_encaixe || false,
            };
          }
        }

        // Sobrescrever com instalação ATIVA (verdade)
        const instAtiva = mInstAtiva.get(contrato.id);
        if (instAtiva) {
          instalacaoAgendada = {
            data: instAtiva.data_agendada || instalacaoAgendada?.data || '',
            horario: instAtiva.periodo || instAtiva.hora_agendada || instalacaoAgendada?.horario || '---',
            permite_encaixe: instAtiva.permite_encaixe ?? instalacaoAgendada?.permite_encaixe ?? false,
            endereco_logradouro: instAtiva.logradouro,
            endereco_numero: instAtiva.numero,
            endereco_bairro: instAtiva.bairro,
            endereco_cidade: instAtiva.cidade,
            endereco_uf: instAtiva.uf,
          };
        }

        const temDocumentoPendente = contrato.associado_id ? !!mTemDocPendente.get(contrato.associado_id) : false;

        // Vistoria — primeiro por contrato (nova), depois fallback legado por cotação
        let vistoria: VistoriaInfo | null = null;
        const vistoriaData = mVistoriaPorContrato.get(contrato.id);
        if (vistoriaData?.id) {
          const fotos = mFotosPorVistoria.get(vistoriaData.id) || [];
          if (fotos.length > 0) {
            vistoria = {
              id: vistoriaData.id,
              status: vistoriaData.status || 'pendente',
              tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
              modalidade: vistoriaData.modalidade || undefined,
              fotos,
              observacoes: vistoriaData.observacoes,
              km_atual: vistoriaData.km_atual,
              video_360_url: vistoriaData.video_360_url,
            };
          }
        }
        if (!vistoria && contrato.cotacao_id) {
          const fotosLegado = mFotosLegadoPorCotacao.get(contrato.cotacao_id) || [];
          if (fotosLegado.length > 0) {
            const isAuto = cotacao?.tipo_vistoria === 'autovistoria';
            vistoria = {
              id: contrato.cotacao_id,
              status: 'pendente',
              tipo: isAuto ? 'autovistoria' : 'agendada',
              modalidade: isAuto ? 'autovistoria' : 'presencial',
              fotos: fotosLegado,
              video_360_url: mVideoPorCotacao.get(contrato.cotacao_id) || null,
            };
          }
        }

        const documentosSolicitadosEnviados = contrato.associado_id
          ? (mDocsSolicEnviados.get(contrato.associado_id) || [])
          : [];
        const documentosSolicitadosPendentes = contrato.associado_id
          ? (mDocsSolicPendentes.get(contrato.associado_id) || [])
          : [];

        // Instalação concluída
        let instalacaoInfo: InstalacaoInfo | null = null;
        const instConc = mInstConcluida.get(contrato.id);
        // Restringir ao veículo do contrato se aplicável
        const instConcOk = instConc && (!contrato.veiculo_id || instConc.veiculo_id === contrato.veiculo_id);
        if (instConcOk) {
          const rastreador = instConc.rastreador_id ? mRastreador.get(instConc.rastreador_id) : null;
          const instalador = instConc.instalador_id ? mInstalador.get(instConc.instalador_id) : null;
          let assinaturaUrl: string | null = instConc.assinatura_cliente_url || null;
          if (!assinaturaUrl && vistoria?.id) {
            const fotoAss = (mFotosPorVistoria.get(vistoria.id) || []).find(f => f.tipo === 'assinatura_cliente');
            if (fotoAss?.arquivo_url) assinaturaUrl = fotoAss.arquivo_url;
          }
          if (!assinaturaUrl) {
            assinaturaUrl = mServicoSig.get(contrato.id) || null;
          }
          instalacaoInfo = {
            id: instConc.id,
            status: instConc.status,
            concluida_em: instConc.concluida_em,
            rastreador_imei: rastreador?.imei || null,
            rastreador_codigo: rastreador?.codigo || null,
            rastreador_id: rastreador?.id || null,
            rastreador_plataforma: rastreador?.plataforma || null,
            rastreador_ativado: !!rastreador?.plataforma_device_id,
            instalador_nome: instalador?.nome || null,
            assinatura_cliente_url: assinaturaUrl,
          };
        }

        const temAutovistoria = !!(vistoria && vistoria.fotos && vistoria.fotos.length > 0);

        // Agendamento base
        let vistoriaBaseInfo: VistoriaBaseInfo | null = null;
        const agend = contrato.cotacao_id ? mAgendBase.get(contrato.cotacao_id) : null;
        if (agend) {
          vistoriaBaseInfo = {
            id: agend.id,
            data_agendada: agend.data_agendada,
            horario: agend.horario,
            status: agend.status,
            atendido_por_nome: (agend.atendido_por_profile as any)?.nome || null,
          };
        }
        const temVistoriaBaseRealizada = vistoriaBaseInfo?.status === 'realizado';
        const temVistoriaBaseAgendada = vistoriaBaseInfo?.status === 'agendado';
        const temInstalacaoAgendada = !!instalacaoAgendada;

        const temQualquerEtapa =
          instalacaoInfo ||
          temAutovistoria ||
          temVistoriaBaseRealizada ||
          temVistoriaBaseAgendada ||
          temInstalacaoAgendada;
        if (!temQualquerEtapa) return null;

        let tipoEtapaAnalise: TipoEtapaAnalise;
        if (instalacaoInfo) tipoEtapaAnalise = 'instalacao_concluida';
        else if (temAutovistoria || temVistoriaBaseRealizada) tipoEtapaAnalise = 'vistoria_concluida';
        else tipoEtapaAnalise = 'agendamento_confirmado';

        const planoTemRouboFurto = contrato.plano_id ? !!mPlanoRouboFurto.get(contrato.plano_id) : false;

        // Tempo de referência = mais recente entre marcos relevantes.
        // Garante que ações posteriores (cliente concluiu link, agendou, vistoria, etc.)
        // "zerem" o tempo de espera exibido — não usar só data_assinatura.
        const candidatosTempo: (string | null | undefined)[] = [
          contrato.data_assinatura,
          (contrato as any).updated_at,
          vistoriaData?.created_at,
          instConc?.concluida_em,
          instAtiva?.created_at,
          agend?.data_agendada,
        ];
        const tempoReferencia = candidatosTempo
          .filter((d): d is string => !!d)
          .map(d => new Date(d).getTime())
          .reduce<number | null>((max, t) => (max === null || t > max ? t : max), null);

        return {
          ...contrato,
          cadastro_aprovado: (contrato as any).cadastro_aprovado ?? false,
          tipo_etapa_analise: tipoEtapaAnalise,
          tempo_referencia: tempoReferencia ? new Date(tempoReferencia).toISOString() : contrato.data_assinatura,
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
          veiculo_id: (contrato as any).veiculo_id || null,
          veiculo_cobertura_total: veiculoContrato?.cobertura_total ?? null,
          contrato_link_token: (contrato as any).link_token || null,
          veiculo_renavam: veiculoContrato?.renavam || null,
          veiculo_chassi: veiculoContrato?.chassi || null,
          veiculo_blindado: veiculoBlindadoCot,
          cenario_adesao: cenarioAdesaoCot,
          plano_tem_roubo_furto: planoTemRouboFurto,
        } as PropostaPendente;
      });

      return propostas.filter((p): p is PropostaPendente => p !== null);
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
          updated_at,
          cadastro_aprovado
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

      // Sobreescrever com dados REAIS da instalação ativa
      {
        const { data: instAtiva } = await supabase
          .from('instalacoes')
          .select('data_agendada, periodo, hora_agendada, permite_encaixe, logradouro, numero, bairro, cidade, uf, status, created_at')
          .eq('contrato_id', contrato.id)
          .not('status', 'in', '(cancelada,concluida)')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (instAtiva) {
          instalacaoAgendada = {
            data: instAtiva.data_agendada || instalacaoAgendada?.data || '',
            horario: instAtiva.periodo || instAtiva.hora_agendada || instalacaoAgendada?.horario || '---',
            permite_encaixe: instAtiva.permite_encaixe ?? instalacaoAgendada?.permite_encaixe ?? false,
            endereco_logradouro: instAtiva.logradouro,
            endereco_numero: instAtiva.numero,
            endereco_bairro: instAtiva.bairro,
            endereco_cidade: instAtiva.cidade,
            endereco_uf: instAtiva.uf,
          };
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
        cadastro_aprovado: (contrato as any).cadastro_aprovado ?? false,
        tipo_etapa_analise: tipoEtapaAnaliseSingle,
        tempo_referencia: (contrato as any).updated_at || (contrato as any).data_assinatura || null,
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
        contrato_link_token: (contrato as any).link_token || null,
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
