import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { precisaRastreador } from '@/hooks/useConfigRastreador';

type Contrato = Database['public']['Tables']['contratos']['Row'];
type Associado = Database['public']['Tables']['associados']['Row'];
type Plano = Database['public']['Tables']['planos']['Row'];

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

// Informações da instalação e rastreador
export interface InstalacaoInfo {
  id: string;
  status: string;
  concluida_em: string | null;
  rastreador_imei: string | null;
  rastreador_codigo: string | null;
  rastreador_id: string | null;
  rastreador_plataforma: string | null; // 'softruck', 'rede_veiculos', etc
  rastreador_ativado: boolean; // true se plataforma_device_id existe
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

export interface PropostaPendente {
  id: string;
  numero: string | null;
  data_assinatura: string | null;
  valor_mensal: number | null;
  status: string | null;
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
  dia_vencimento: number | null;
  associado_id: string | null;
  cotacao_id: string | null;
  veiculo_id: string | null; // ID do veículo vinculado
  veiculo_cobertura_total: boolean | null; // Se veículo tem cobertura total ativada
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
  instalacao_info: InstalacaoInfo | null; // Dados da instalação concluída
  instalacao_agendada: InstalacaoAgendadaInfo | null; // Dados do agendamento (pré-instalação)
  vistoria_base_info: VistoriaBaseInfo | null; // Dados da vistoria na base
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
          veiculo_cor,
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
          
          if (contrato.cotacao_id) {
            const { data: cotacao } = await supabase
              .from('cotacoes')
              .select('cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_uf, plano_escolhido_id, vistoria_permite_encaixe, vistoria_data_agendada, vistoria_horario_agendado')
              .eq('id', contrato.cotacao_id)
              .maybeSingle();
            
            if (cotacao) {
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
          .eq('status', 'realizado')
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
      
      const temVistoriaBaseRealizada = !!vistoriaBaseInfo;
      
      // Permitir propostas COM autovistoria ou vistoria na base mesmo sem instalação
      // (a instalação será criada pelo cadastro após aprovação)
      if (!instalacaoInfo && !temAutovistoria && !temVistoriaBaseRealizada) {
        return null;
      }

          return {
            ...contrato,
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
            instalacao_info: instalacaoInfo,
            instalacao_agendada: instalacaoAgendada,
            vistoria_base_info: vistoriaBaseInfo,
            veiculo_id: null, // Não disponível na lista resumida
            veiculo_cobertura_total: null, // Não disponível na lista resumida
            veiculo_renavam: null, // Não disponível na lista resumida
            veiculo_chassi: null, // Não disponível na lista resumida
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
          veiculo_cor,
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
      
      if (contrato.cotacao_id) {
        const { data: cotacao } = await supabase
          .from('cotacoes')
          .select(`
            cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_uf, 
            plano_escolhido_id, vistoria_permite_encaixe, 
            vistoria_data_agendada, vistoria_horario_agendado,
            vistoria_completa_data_agendada, vistoria_completa_horario_agendado
          `)
          .eq('id', contrato.cotacao_id)
          .maybeSingle();
        
        if (cotacao) {
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
          .eq('status', 'realizado')
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

      const result: PropostaPendente = {
        ...contrato,
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
        instalacao_info: instalacaoInfo,
        instalacao_agendada: instalacaoAgendada,
        vistoria_base_info: vistoriaBaseInfo,
        veiculo_id: veiculoId,
        veiculo_cobertura_total: veiculoCoberturaTotal,
        veiculo_renavam: veiculoRenavam,
        veiculo_chassi: veiculoChassi,
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
    mutationFn: async (contratoId: string) => {
      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      const agora = new Date().toISOString();

      // 1. Buscar contrato com dados do associado, veículo e STATUS
      const { data: contrato, error: fetchError } = await supabase
        .from('contratos')
        .select(`
          id,
          status,
          associado_id,
          veiculo_id,
          plano_id,
          valor_mensal,
          dia_vencimento,
          cotacao_id,
          associado:associados!fk_contratos_associado (
            id,
            nome,
            dia_vencimento,
            logradouro,
            numero,
            bairro,
            cidade,
            uf,
            cep
          )
        `)
        .eq('id', contratoId)
        .single();

      if (fetchError) throw fetchError;
      if (!contrato?.associado_id) throw new Error('Associado não encontrado');

      // IDEMPOTÊNCIA: Se já está ativo, retornar sucesso sem tentar atualizar
      if (contrato.status === 'ativo') {
        console.log('Contrato já aprovado anteriormente:', contratoId);
        return { 
          contratoId, 
          associadoId: contrato.associado_id,
          jaAprovado: true,
          mensagem: 'Este contrato já foi aprovado anteriormente.'
        };
      }

      // Se não está em status "assinado", não pode ser aprovado
      if (contrato.status !== 'assinado') {
        throw new Error(`Este contrato não pode ser aprovado. Status atual: ${contrato.status}`);
      }

      const associadoId = contrato.associado_id;
      const diaVencimento = contrato.dia_vencimento || (contrato.associado as any)?.dia_vencimento || 15;

      // 2. Atualizar CONTRATO para ativo (contrato ativo, mas associado ainda aguarda instalação)
      // IMPORTANTE: Usar .eq('status', 'assinado') para atomicidade e .maybeSingle() para evitar erro
      const { data: contratoAtualizado, error: contratoError } = await supabase
        .from('contratos')
        .update({
          status: 'ativo',
          data_ativacao: agora,
          aprovado_por: profile.id,
          aprovado_em: agora,
        })
        .eq('id', contratoId)
        .eq('status', 'assinado') // Garante que só atualiza se ainda está assinado
        .select('id, status, aprovado_em, aprovado_por, data_ativacao')
        .maybeSingle();

      if (contratoError) {
        console.error('Erro ao atualizar contrato:', contratoError);
        throw new Error(`Falha ao atualizar contrato: ${contratoError.message}`);
      }
      
      // Se não retornou linha, significa que outro processo já aprovou ou mudou o status
      if (!contratoAtualizado) {
        // Refetch para verificar status atual
        const { data: contratoRefetch } = await supabase
          .from('contratos')
          .select('status')
          .eq('id', contratoId)
          .single();
        
        if (contratoRefetch?.status === 'ativo') {
          // Foi aprovado por outro processo - sucesso
          return { 
            contratoId, 
            associadoId,
            jaAprovado: true,
            mensagem: 'Este contrato já foi aprovado por outro usuário.'
          };
        }
        
        throw new Error(`Não foi possível aprovar o contrato. Status atual: ${contratoRefetch?.status || 'desconhecido'}`);
      }

      // 3. Verificar se já existe instalação para este contrato OU para este veículo
      // Primeiro: Verificar instalação CONCLUÍDA para este contrato
      const { data: instalacaoConcluida } = await supabase
        .from('instalacoes')
        .select('id, status, rastreador_id')
        .eq('contrato_id', contratoId)
        .eq('status', 'concluida')
        .maybeSingle();
      
      const jaTemInstalacaoConcluida = !!instalacaoConcluida;

      // 4. Buscar veículo do contrato (determinístico) ou fallback por associado
      const veiculoIdDoContrato = (contrato as any).veiculo_id;
      let veiculos: Array<{ id: string; placa: string | null; modelo: string | null }> | null = null;
      
      if (veiculoIdDoContrato) {
        const { data } = await supabase
          .from('veiculos')
          .select('id, placa, modelo')
          .eq('id', veiculoIdDoContrato);
        veiculos = data;
      } else {
        const { data } = await supabase
          .from('veiculos')
          .select('id, placa, modelo')
          .eq('associado_id', associadoId)
          .limit(1);
        veiculos = data;
      }

      // Segundo: Verificar se já existe instalação ATIVA para o mesmo veículo
      // (isso cobre casos de contratos duplicados ou reprocessamento)
      const veiculoIdParaInstalacao = veiculoIdDoContrato || (veiculos && veiculos[0]?.id);
      let jaTemInstalacaoAtiva = false;

      if (veiculoIdParaInstalacao) {
        const { data: instalacaoAtiva } = await supabase
          .from('instalacoes')
          .select('id, status, contrato_id')
          .eq('veiculo_id', veiculoIdParaInstalacao)
          .in('status', ['agendada', 'em_rota', 'em_andamento'])
          .maybeSingle();
        
        jaTemInstalacaoAtiva = !!instalacaoAtiva;
        
        // Se a instalação ativa é de outro contrato, logar para debugging
        if (instalacaoAtiva && instalacaoAtiva.contrato_id !== contratoId) {
          console.warn(`Veículo ${veiculoIdParaInstalacao} já tem instalação ativa do contrato ${instalacaoAtiva.contrato_id}. Usando instalação existente.`);
        }
      }
      
      // 5. Definir status do associado como 'ativo' imediatamente na aprovação
      // Isso permite que o cliente crie sua conta no app independente da instalação do rastreador
      // A cobertura_total será liberada posteriormente quando o rastreador for ativado
      const statusAssociado = 'ativo';

      const { data: associadoAtualizado, error: associadoError } = await supabase
        .from('associados')
        .update({
          status: statusAssociado,
          data_adesao: agora.split('T')[0],
          aprovado_por: profile.id,
          aprovado_em: agora,
        })
        .eq('id', associadoId)
        .select('id, status')
        .single();

      if (associadoError) {
        console.error('Erro ao atualizar associado:', associadoError);
        throw new Error(`Falha ao atualizar associado: ${associadoError.message}`);
      }
      
      // Validar que a atualização realmente ocorreu
      if (!associadoAtualizado || associadoAtualizado.status !== statusAssociado) {
        console.error('Associado não foi atualizado corretamente:', associadoAtualizado);
        throw new Error('Sem permissão para atualizar associado (RLS) ou associado não encontrado');
      }

      // 6. Atualizar VEÍCULO e criar instalação SE NECESSÁRIO
      let protecao360SemRastreador = false;
      if (veiculos && veiculos.length > 0) {
        const veiculoId = veiculos[0].id;
        
        // Buscar valor_fipe do veículo para verificar se precisa de rastreador
        const { data: veiculoFipeData } = await supabase
          .from('veiculos')
          .select('valor_fipe')
          .eq('id', veiculoId)
          .single();
        
        const valorFipe = veiculoFipeData?.valor_fipe || 0;
        
        // Buscar limites de FIPE para rastreador da configuração
        let fipeMinRastreador = 30000;
        let fipeMinRastreadorMoto = 9000;
        const { data: configRastreador } = await supabase
          .from('configuracoes')
          .select('chave, valor')
          .in('chave', ['operacional_fipe_minimo_rastreador', 'operacional_fipe_minimo_rastreador_moto']);
        
        if (configRastreador) {
          for (const cfg of configRastreador) {
            if (cfg.chave === 'operacional_fipe_minimo_rastreador') fipeMinRastreador = Number(cfg.valor) || 30000;
            if (cfg.chave === 'operacional_fipe_minimo_rastreador_moto') fipeMinRastreadorMoto = Number(cfg.valor) || 9000;
          }
        }
        
        const veiculoPrecisaRastreador = precisaRastreador(valorFipe, fipeMinRastreador, 'automovel', fipeMinRastreadorMoto);
        
        // Status do veículo depende se instalação foi concluída OU se não precisa de rastreador
        // Veículos sem rastreador recebem proteção 360° direto pela autovistoria completa
        const ativarProtecao360 = jaTemInstalacaoConcluida || !veiculoPrecisaRastreador;
        const statusVeiculo = ativarProtecao360 ? 'ativo' : 'instalacao_pendente';
        const coberturaTotal = ativarProtecao360;
        
        if (!veiculoPrecisaRastreador) {
          protecao360SemRastreador = true;
          console.log(`[useAprovarProposta] Veículo FIPE R$${valorFipe} < limite R$${fipeMinRastreador} — Proteção 360° ativada sem rastreador`);
        }
        
        const { error: veiculoError } = await supabase
          .from('veiculos')
          .update({
            status: statusVeiculo,
            cobertura_roubo_furto: true,
            cobertura_total: coberturaTotal,
          })
          .eq('id', veiculoId);

        if (veiculoError) {
          console.error('Erro ao atualizar veículo:', veiculoError);
        }

        // Se instalação já foi concluída, ativar rastreador na plataforma e criar acesso do associado
        if (jaTemInstalacaoConcluida && instalacaoConcluida?.rastreador_id) {
          try {
            // Buscar dados do rastreador para ativação
            const { data: rastreadorData } = await supabase
              .from('rastreadores')
              .select('imei, plataforma')
              .eq('id', instalacaoConcluida.rastreador_id)
              .single();
            
            if (rastreadorData?.imei) {
              const { data: associadoEmail } = await supabase
                .from('associados')
                .select('email')
                .eq('id', associadoId)
                .single();

              // Ativar na plataforma do rastreador
              if (rastreadorData.plataforma === 'softruck') {
                console.log('[useAprovarProposta] Ativando rastreador na Softruck...');
                await supabase.functions.invoke('softruck-ativar-dispositivo', {
                  body: {
                    imei: rastreadorData.imei,
                    veiculoId: veiculoId,
                    associadoId: associadoId,
                    associadoEmail: associadoEmail?.email,
                  },
                });
              } else if (rastreadorData.plataforma === 'rede_veiculos') {
                console.log('[useAprovarProposta] Ativando rastreador na Rede Veículos...');
                await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
                  body: {
                    imei: rastreadorData.imei,
                    veiculoId: veiculoId,
                    associadoId: associadoId,
                  },
                });
              }
              
              // Criar acesso do associado
              console.log('[useAprovarProposta] Criando acesso do associado...');
              await supabase.functions.invoke('ativar-associado', {
                body: {
                  veiculo_id: veiculoId,
                  rastreador_id: instalacaoConcluida.rastreador_id,
                  associado_id: associadoId,
                },
              });
              
              console.log('[useAprovarProposta] Cobertura total ativada - instalação já concluída');

              // Notificar associado sobre Proteção 360º
              const { data: veiculoInfo } = await supabase
                .from('veiculos')
                .select('placa, marca, modelo')
                .eq('id', veiculoId)
                .single();

              supabase.functions.invoke('notificar-cliente', {
                body: {
                  tipo: 'cobertura_total_ativada',
                  associado_id: associadoId,
                  dados: {
                    placa: veiculoInfo?.placa || '',
                    marca: veiculoInfo?.marca || '',
                    modelo: veiculoInfo?.modelo || '',
                  },
                },
              }).catch(err => console.warn('[useAprovarProposta] Erro ao notificar cobertura 360 (não crítico):', err));
            }
          } catch (ativacaoError) {
            console.warn('[useAprovarProposta] Erro na ativação automática:', ativacaoError);
            // Não lançar erro - a ativação pode ser feita manualmente depois
          }
        }

        // Criar INSTALAÇÃO APENAS se:
        // - NÃO existir instalação concluída para este contrato
        // - NÃO existir instalação ativa para este veículo (evita duplicatas)
        // - Veículo PRECISA de rastreador (FIPE >= limite)
        if (!jaTemInstalacaoConcluida && !jaTemInstalacaoAtiva && veiculoPrecisaRastreador) {
          const associadoData = contrato.associado as any;
          
          // Buscar preferências de agendamento preenchidas pelo cliente na cotação
          let dataAgendada = new Date().toISOString().split('T')[0];
          let periodoPreferido = 'manha';
          let enderecoLogradouro = associadoData?.logradouro || null;
          let enderecoNumero = associadoData?.numero || null;
          let enderecoBairro = associadoData?.bairro || null;
          let enderecoCidade = associadoData?.cidade || null;
          let enderecoUf = associadoData?.uf || null;
          let enderecoCep = associadoData?.cep || null;
          let permiteEncaixe = false;
          
          if (contrato.cotacao_id) {
            try {
              const { data: cotacaoDados } = await supabase
                .from('cotacoes')
                .select('vistoria_completa_data_agendada, vistoria_completa_horario_agendado, vistoria_completa_periodo, vistoria_completa_endereco_cep, vistoria_completa_endereco_logradouro, vistoria_completa_endereco_numero, vistoria_completa_endereco_bairro, vistoria_completa_endereco_cidade, vistoria_completa_endereco_estado, vistoria_permite_encaixe')
                .eq('id', contrato.cotacao_id)
                .single();
              
              if (cotacaoDados?.vistoria_completa_data_agendada) {
                dataAgendada = cotacaoDados.vistoria_completa_data_agendada;
                periodoPreferido = cotacaoDados.vistoria_completa_periodo || cotacaoDados.vistoria_completa_horario_agendado || 'manha';
                console.log(`[useAprovarProposta] Usando preferências do cliente: data=${dataAgendada}, periodo=${periodoPreferido}`);
              }
              if (cotacaoDados?.vistoria_completa_endereco_logradouro) {
                enderecoLogradouro = cotacaoDados.vistoria_completa_endereco_logradouro;
                enderecoNumero = cotacaoDados.vistoria_completa_endereco_numero || null;
                enderecoBairro = cotacaoDados.vistoria_completa_endereco_bairro || null;
                enderecoCidade = cotacaoDados.vistoria_completa_endereco_cidade || null;
                enderecoUf = cotacaoDados.vistoria_completa_endereco_estado || null;
                enderecoCep = cotacaoDados.vistoria_completa_endereco_cep || null;
                console.log(`[useAprovarProposta] Usando endereço do cliente: ${enderecoLogradouro}, ${enderecoCidade}`);
              }
              if (cotacaoDados?.vistoria_permite_encaixe) {
                permiteEncaixe = true;
              }
            } catch (cotErr) {
              console.warn('[useAprovarProposta] Erro ao buscar preferências da cotação, usando fallback:', cotErr);
            }
          }
          
          // GEOCODIFICAR endereço antes de criar instalação para atribuição automática funcionar
          let endereco_latitude: number | null = null;
          let endereco_longitude: number | null = null;
          
          if (enderecoLogradouro && enderecoCidade) {
            try {
              console.log('[Aprovação] Geocodificando endereço...');
              const { data: geoResult, error: geoError } = await supabase.functions.invoke('geocode-endereco', {
                body: {
                  logradouro: enderecoLogradouro,
                  numero: enderecoNumero,
                  bairro: enderecoBairro,
                  cidade: enderecoCidade,
                  uf: enderecoUf,
                  cep: enderecoCep,
                }
              });
              
              if (!geoError && geoResult?.latitude && geoResult?.longitude) {
                endereco_latitude = geoResult.latitude;
                endereco_longitude = geoResult.longitude;
                console.log(`[Aprovação] Geocodificação OK: (${endereco_latitude}, ${endereco_longitude})`);
              } else {
                console.warn('[Aprovação] Geocodificação retornou sem coordenadas:', geoResult);
              }
            } catch (geoError) {
              console.warn('[Aprovação] Geocodificação falhou, continuando sem coordenadas:', geoError);
            }
          }
          
          const { error: instalacaoError } = await supabase
            .from('instalacoes')
            .insert({
              associado_id: associadoId,
              veiculo_id: veiculoId,
              contrato_id: contratoId,
              cotacao_id: contrato.cotacao_id || null,
              status: 'agendada',
              data_agendada: dataAgendada,
              periodo: ['manha', 'tarde'].includes(periodoPreferido) ? periodoPreferido : 'manha',
              logradouro: enderecoLogradouro,
              numero: enderecoNumero,
              bairro: enderecoBairro,
              cidade: enderecoCidade,
              uf: enderecoUf,
              cep: enderecoCep,
              endereco_latitude,
              endereco_longitude,
              local_vistoria: 'cliente',
              permite_encaixe: permiteEncaixe,
            } as any);
          
          if (instalacaoError) {
            console.error('Erro ao criar instalação:', instalacaoError);
            throw new Error(`Falha ao criar instalação: ${instalacaoError.message}`);
          }
          
          console.log(`[useAprovarProposta] Instalação criada com preferências do cliente: data=${dataAgendada}, periodo=${periodoPreferido}`);
        } else if (jaTemInstalacaoAtiva) {
          console.log(`Instalação já existe para o veículo ${veiculoId}. Aprovação prossegue sem criar nova instalação.`);
        } else if (!veiculoPrecisaRastreador) {
          console.log(`[useAprovarProposta] Veículo não precisa de rastreador (FIPE R$${valorFipe}). Proteção 360° ativada diretamente.`);
          
          // Notificar associado sobre Proteção 360° (sem rastreador)
          const { data: veiculoInfo360 } = await supabase
            .from('veiculos')
            .select('placa, marca, modelo')
            .eq('id', veiculoId)
            .single();

          supabase.functions.invoke('notificar-cliente', {
            body: {
              tipo: 'cobertura_total_ativada',
              associado_id: associadoId,
              dados: {
                placa: veiculoInfo360?.placa || '',
                marca: veiculoInfo360?.marca || '',
                modelo: veiculoInfo360?.modelo || '',
              },
            },
          }).catch(err => console.warn('[useAprovarProposta] Erro ao notificar cobertura 360 sem rastreador (não crítico):', err));
        }

        // Criar acesso do associado mesmo sem instalação concluída (roubo/furto)
        if (!jaTemInstalacaoConcluida) {
          try {
            console.log('[useAprovarProposta] Criando acesso do associado (sem instalação concluída)...');
            await supabase.functions.invoke('ativar-associado', {
              body: {
                associado_id: associadoId,
                veiculo_id: veiculoId,
              },
            });
            console.log('[useAprovarProposta] Acesso do associado criado com sucesso');
          } catch (ativacaoError) {
            console.warn('[useAprovarProposta] Erro ao criar acesso (não crítico):', ativacaoError);
          }
        }
      }

      // 7. Registrar histórico com mensagem apropriada
      // Determinar se proteção 360° foi ativada nesta aprovação
      const protecao360Ativada = jaTemInstalacaoConcluida || (!jaTemInstalacaoConcluida && !jaTemInstalacaoAtiva && veiculos && veiculos.length > 0 && (() => {
        // Veículo sem necessidade de rastreador teve cobertura_total ativada acima
        // Verificar consultando o veículo atualizado
        return false; // será determinado abaixo
      })());
      
      const mensagemHistorico = jaTemInstalacaoConcluida
        ? 'Proposta aprovada pelo analista de cadastro. Instalação já concluída. Proteção 360º ativada.'
        : 'Proposta aprovada pelo analista de cadastro. Cobertura ativada.';
      
      await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          contrato_id: contratoId,
          tipo: 'status_alterado',
          descricao: mensagemHistorico,
          usuario_id: profile.id,
        });

      // 8. CONCLUIR DOCUMENTAÇÃO: Aprovação da proposta implica aprovação de todos os documentos relacionados
      // Atualizar documentos do associado (tabela 'documentos')
      await supabase
        .from('documentos')
        .update({
          status: 'aprovado',
          analista_id: profile.id,
          data_analise: agora,
          motivo_reprovacao: null,
        })
        .eq('associado_id', associadoId)
        .in('status', ['pendente', 'em_analise']);

      // Atualizar documentos solicitados que foram enviados
      await supabase
        .from('documentos_solicitados')
        .update({
          status: 'aprovado',
          updated_at: agora,
        })
        .eq('associado_id', associadoId)
        .eq('status', 'enviado');

      // Atualizar anexos da cotação (tabela 'contratos_documentos')
      // Incluir 'pendente' e 'processando' para garantir que todos sejam aprovados
      if (contrato.cotacao_id) {
        await supabase
          .from('contratos_documentos')
          .update({
            status: 'aprovado',
            updated_at: agora,
          })
          .eq('cotacao_id', contrato.cotacao_id)
          .in('status', ['pendente', 'processando']);
      }

      // Nota: Cobranças serão geradas em outro momento do fluxo (após instalação ou pelo financeiro)

      // 9. NOTIFICAR CLIENTE VIA WHATSAPP - Enviar link para criar conta no app
      const { data: contratoComLink } = await supabase
        .from('contratos')
        .select('link_token')
        .eq('id', contratoId)
        .single();

      // NOTA: A mensagem WhatsApp de boas-vindas já é enviada pela edge function 'ativar-associado'
      // usando o template 'cadastro_aprovado_botao'. Não duplicar o envio aqui.
      if (contratoComLink?.link_token) {
        console.log('[useAprovarProposta] WhatsApp de boas-vindas será enviado via ativar-associado (sem duplicidade)');
      }

      // 10. ENVIAR AUTOMATICAMENTE PARA SGA HINOVA
      // Executar sincronização em background (não bloqueia fluxo principal)
      try {
        const { data: veiculoParaSGA } = await supabase
          .from('veiculos')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('sincronizado_hinova', false)
          .limit(1)
          .maybeSingle();

        if (veiculoParaSGA?.id) {
          console.log('[useAprovarProposta] Iniciando envio automático para SGA...');
          const { data: sgaResult, error: sgaError } = await supabase.functions.invoke('sga-hinova-sync', {
            body: { 
              veiculo_id: veiculoParaSGA.id, 
              associado_id: associadoId 
            }
          });
          
          if (sgaError) {
            console.warn('[useAprovarProposta] Erro no envio SGA (não crítico):', sgaError);
          } else if (sgaResult?.success) {
            console.log('[useAprovarProposta] Enviado para SGA com sucesso:', sgaResult);
          } else {
            console.warn('[useAprovarProposta] SGA retornou falha:', sgaResult?.error);
          }
        }
      } catch (sgaErr) {
        console.warn('[useAprovarProposta] Erro ao enviar para SGA (não crítico):', sgaErr);
      }

      const mensagemRetorno = jaTemInstalacaoConcluida
        ? 'Proposta aprovada! Instalação já concluída. Proteção 360º ativada.'
        : 'Proposta aprovada! Cobertura Roubo/Furto ativada. Aguardando instalação para Proteção 360º.';

      return {
        contratoId, 
        associadoId,
        mensagem: mensagemRetorno
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

      // 4. NOVO: Enviar notificação via WhatsApp com link de acompanhamento
      try {
        // Buscar link_token do contrato para incluir na mensagem
        const { data: contratoComLink } = await supabase
          .from('contratos')
          .select('link_token')
          .eq('id', contratoId)
          .single();

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

        // Gerar link de acompanhamento
        const linkAcompanhamento = contratoComLink?.link_token 
          ? `${window.location.origin}/acompanhar/${contratoComLink.link_token}`
          : null;

        await supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'documentos_solicitados',
            associado_id: associadoId,
            dados: {
              documentos: docsFormatados,
              observacoes: observacoes ? `📝 Obs: ${observacoes}` : '',
              link_acompanhamento: linkAcompanhamento || 'Acesse pelo link enviado anteriormente',
            },
          },
        });
        console.log('[useSolicitarDocumentos] Notificação WhatsApp enviada com link:', linkAcompanhamento);
      } catch (notifError) {
        console.warn('[useSolicitarDocumentos] Erro ao enviar notificação (não crítico):', notifError);
        // Não falhar por causa da notificação
      }

      return { contratoId, associadoId };
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
