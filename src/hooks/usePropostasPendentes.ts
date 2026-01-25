import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

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
  instalador_nome: string | null;
  assinatura_cliente_url: string | null;
}

// Informações da instalação agendada (antes da execução)
export interface InstalacaoAgendadaInfo {
  data: string;
  horario: string;
  permite_encaixe: boolean;
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
  dia_vencimento: number | null;
  associado_id: string | null;
  cotacao_id: string | null;
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
  instalacao_agendada: InstalacaoAgendadaInfo | null; // NOVO: Dados do agendamento (pré-instalação)
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
          vendedor_id
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
        .select('id, status, modalidade')
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
          };
        }
      }

      // 2. Fallback: buscar em cotacoes_vistoria_fotos (legado, apenas se tiver cotacao_id)
      if (!vistoria && contrato.cotacao_id) {
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
            fotos: fotosLegado as VistoriaFotoInfo[],
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
        // Buscar dados do rastreador instalado (com IMEI)
        let rastreadorImei: string | null = null;
        let rastreadorCodigo: string | null = null;
        
        if (instalacaoData.rastreador_id) {
          const { data: rastreador } = await supabase
            .from('rastreadores')
            .select('imei, codigo')
            .eq('id', instalacaoData.rastreador_id)
            .single();
          
          if (rastreador) {
            rastreadorImei = rastreador.imei;
            rastreadorCodigo = rastreador.codigo;
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
          instalador_nome: instaladorNome,
          assinatura_cliente_url: assinaturaUrl,
        };
      }

      // REGRA ATUALIZADA: Incluir propostas que tenham:
      // - Instalação concluída (fluxo normal)
      // - OU Autovistoria concluída com fotos (aguardando aprovação para roubo/furto)
      const temAutovistoria = vistoria && vistoria.fotos && vistoria.fotos.length > 0;
      if (!instalacaoInfo && !temAutovistoria) {
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
          } as PropostaPendente;
        })
      );

      // Filtrar propostas nulas (sem instalação concluída nem autovistoria)
      return propostasComRelacoes.filter((p): p is PropostaPendente => p !== null);
    },
    staleTime: 30000,
    refetchInterval: 30000, // Atualização automática a cada 30 segundos
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
        .select('id, status, modalidade')
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
          };
        }
      }

      // 2. Fallback: buscar em cotacoes_vistoria_fotos (legado, apenas se tiver cotacao_id)
      if (!vistoria && contrato.cotacao_id) {
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
        // Buscar dados do rastreador instalado (com IMEI)
        let rastreadorImei: string | null = null;
        let rastreadorCodigo: string | null = null;
        
        if (instalacaoData.rastreador_id) {
          const { data: rastreador } = await supabase
            .from('rastreadores')
            .select('imei, codigo')
            .eq('id', instalacaoData.rastreador_id)
            .single();
          
          if (rastreador) {
            rastreadorImei = rastreador.imei;
            rastreadorCodigo = rastreador.codigo;
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
          instalador_nome: instaladorNome,
          assinatura_cliente_url: assinaturaUrl,
        };
      }
      
      // NOVO FALLBACK: Se não encontrou instalação concluída MAS há autovistoria,
      // buscar assinatura diretamente em servicos pelo contrato
      if (!instalacaoInfo && vistoria?.id) {
        const { data: servicoAssinaturaData } = await supabase
          .from('servicos')
          .select('assinatura_cliente_url, concluida_em')
          .eq('contrato_id', contrato.id)
          .not('assinatura_cliente_url', 'is', null)
          .order('concluida_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (servicoAssinaturaData?.assinatura_cliente_url) {
          // Criar instalacaoInfo mínimo para exibir a assinatura
          instalacaoInfo = {
            id: vistoria.id,
            status: 'concluida',
            concluida_em: servicoAssinaturaData.concluida_em,
            rastreador_imei: null,
            rastreador_codigo: null,
            instalador_nome: null,
            assinatura_cliente_url: servicoAssinaturaData.assinatura_cliente_url,
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

        // Contar apenas propostas prontas para análise
        aguardando = contratosAssinados.filter(contrato => {
          // Tem instalação concluída?
          if (contratosComInstalacao.has(contrato.id)) return true;
          // Tem autovistoria com fotos?
          if (contrato.cotacao_id && cotacoesComFotos.has(contrato.cotacao_id)) return true;
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

      // 4. Buscar veículo do associado ANTES de verificar instalação ativa
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo')
        .eq('associado_id', associadoId)
        .limit(1);

      // Segundo: Verificar se já existe instalação ATIVA para o mesmo veículo
      // (isso cobre casos de contratos duplicados ou reprocessamento)
      const veiculoIdDoContrato = (contrato as any).veiculo_id || (veiculos && veiculos[0]?.id);
      let jaTemInstalacaoAtiva = false;

      if (veiculoIdDoContrato) {
        const { data: instalacaoAtiva } = await supabase
          .from('instalacoes')
          .select('id, status, contrato_id')
          .eq('veiculo_id', veiculoIdDoContrato)
          .in('status', ['agendada', 'em_rota', 'em_andamento'])
          .maybeSingle();
        
        jaTemInstalacaoAtiva = !!instalacaoAtiva;
        
        // Se a instalação ativa é de outro contrato, logar para debugging
        if (instalacaoAtiva && instalacaoAtiva.contrato_id !== contratoId) {
          console.warn(`Veículo ${veiculoIdDoContrato} já tem instalação ativa do contrato ${instalacaoAtiva.contrato_id}. Usando instalação existente.`);
        }
      }
      
      // 5. Definir status do associado baseado na instalação
      // Se instalação JÁ concluída: 'em_analise' (aguardando ativação do rastreador)
      // Se instalação ativa existe (agendada/em_rota/em_andamento): 'aguardando_instalacao'
      // Se NÃO existe instalação: 'aguardando_instalacao' (será criada)
      const statusAssociado = jaTemInstalacaoConcluida 
        ? 'em_analise' 
        : 'aguardando_instalacao';

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
      if (veiculos && veiculos.length > 0) {
        const veiculoId = veiculos[0].id;
        
        // Status do veículo depende se instalação foi concluída
        const statusVeiculo = jaTemInstalacaoConcluida ? 'em_analise' : 'instalacao_pendente';
        
        const { error: veiculoError } = await supabase
          .from('veiculos')
          .update({
            status: statusVeiculo,
            cobertura_roubo_furto: true,
            cobertura_total: false,
          })
          .eq('id', veiculoId);

        if (veiculoError) {
          console.error('Erro ao atualizar veículo:', veiculoError);
        }

        // Criar INSTALAÇÃO APENAS se:
        // - NÃO existir instalação concluída para este contrato
        // - NÃO existir instalação ativa para este veículo (evita duplicatas)
        if (!jaTemInstalacaoConcluida && !jaTemInstalacaoAtiva) {
          const associadoData = contrato.associado as any;
          const dataAgendada = new Date().toISOString().split('T')[0];
          const { error: instalacaoError } = await supabase
            .from('instalacoes')
            .insert({
              associado_id: associadoId,
              veiculo_id: veiculoId,
              contrato_id: contratoId,
              status: 'agendada',
              data_agendada: dataAgendada,
              periodo: 'manha',
              logradouro: associadoData?.logradouro || null,
              numero: associadoData?.numero || null,
              bairro: associadoData?.bairro || null,
              cidade: associadoData?.cidade || null,
              uf: associadoData?.uf || null,
              cep: associadoData?.cep || null,
            } as any);
          
          if (instalacaoError) {
            console.error('Erro ao criar instalação:', instalacaoError);
            throw new Error(`Falha ao criar instalação: ${instalacaoError.message}`);
          }
        } else if (jaTemInstalacaoAtiva) {
          console.log(`Instalação já existe para o veículo ${veiculoId}. Aprovação prossegue sem criar nova instalação.`);
        }
      }

      // 7. Registrar histórico com mensagem apropriada
      const mensagemHistorico = jaTemInstalacaoConcluida
        ? 'Proposta aprovada pelo analista de cadastro. Instalação já concluída. Aguardando ativação do rastreador para cobertura total.'
        : 'Proposta aprovada pelo analista de cadastro. Cobertura Roubo/Furto ativada. Aguardando instalação para cobertura total.';
      
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
      if (contrato.cotacao_id) {
        await supabase
          .from('contratos_documentos')
          .update({
            status: 'aprovado',
            updated_at: agora,
          })
          .eq('cotacao_id', contrato.cotacao_id)
          .eq('status', 'pendente');
      }

      // Nota: Cobranças serão geradas em outro momento do fluxo (após instalação ou pelo financeiro)

      const mensagemRetorno = jaTemInstalacaoConcluida
        ? 'Proposta aprovada! Instalação já concluída. Aguardando ativação do rastreador.'
        : 'Proposta aprovada! Cobertura Roubo/Furto ativada. Aguardando instalação para cobertura total.';

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

      // Atualizar contrato (usar 'cancelado' pois 'reprovado' não existe no enum)
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({
          status: 'cancelado',
          motivo_cancelamento: `REPROVADO - ${motivo}: ${justificativa}`,
        })
        .eq('id', contratoId);

      if (contratoError) throw contratoError;

      // Atualizar associado
      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'reprovado' as any,
        })
        .eq('id', associadoId);

      if (associadoError) throw associadoError;

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
      toast.success('Proposta reprovada.');
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (error) => {
      console.error('Erro ao reprovar proposta:', error);
      toast.error('Erro ao reprovar proposta. Tente novamente.');
    },
  });
}
