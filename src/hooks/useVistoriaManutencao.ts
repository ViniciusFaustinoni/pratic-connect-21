/**
 * Hooks para gerenciamento de Vistorias de Manutenção de Rastreadores
 * 
 * Este hook gerencia o workflow completo de manutenção operacional de campo,
 * integrando com a tabela unificada de serviços.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  MotivoManutencao, 
  LocalTipoManutencao, 
  ResultadoManutencao,
  VistoriaManutencao,
  ManutencaoMetricas,
  ManutencaoFiltros,
  AbrirManutencaoParams,
  AgendarManutencaoParams,
  RegistrarResultadoParams,
  MarcarNaoCompareceuParams,
} from '@/types/vistoriaManutencao';

// ============================================
// QUERY: LISTAR VISTORIAS DE MANUTENÇÃO
// ============================================

/**
 * Hook para listar vistorias de manutenção com filtros
 */
export function useVistoriasManutencao(filtros?: ManutencaoFiltros) {
  return useQuery({
    queryKey: ['vistorias-manutencao', filtros],
    queryFn: async () => {
      let query = supabase
        .from('servicos')
        .select(`
          id,
          protocolo,
          tipo,
          status,
          data_agendada,
          periodo,
          motivo_manutencao,
          motivo_detalhe,
          local_tipo_manutencao,
          protecao_suspensa,
          data_suspensao,
          rastreador_substituto_id,
          resultado_manutencao,
          logradouro,
          numero,
          bairro,
          cidade,
          uf,
          cep,
          latitude,
          longitude,
          observacoes,
          observacoes_analise,
          created_at,
          updated_at,
          concluida_em,
          associado_id,
          veiculo_id,
          rastreador_id,
          profissional_id,
          associado:associados(id, nome, telefone, whatsapp, cpf, email),
          veiculo:veiculos(id, placa, marca, modelo, cor, ano_fabricacao),
          rastreador:rastreadores!servicos_rastreador_id_fkey(id, codigo, imei, plataforma),
          profissional:profiles!servicos_profissional_id_fkey(id, nome, telefone)
        `)
        .eq('tipo', 'vistoria_manutencao')
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filtros?.status) {
        if (Array.isArray(filtros.status)) {
          query = query.in('status', filtros.status as any);
        } else {
          query = query.eq('status', filtros.status as any);
        }
      }

      if (filtros?.motivo) {
        if (Array.isArray(filtros.motivo)) {
          query = query.in('motivo_manutencao', filtros.motivo as any);
        } else {
          query = query.eq('motivo_manutencao', filtros.motivo as any);
        }
      }

      if (filtros?.localTipo) {
        if (Array.isArray(filtros.localTipo)) {
          query = query.in('local_tipo_manutencao', filtros.localTipo);
        } else {
          query = query.eq('local_tipo_manutencao', filtros.localTipo);
        }
      }

      if (filtros?.profissionalId) {
        query = query.eq('profissional_id', filtros.profissionalId);
      }

      if (filtros?.dataInicio) {
        query = query.gte('data_agendada', filtros.dataInicio);
      }

      if (filtros?.dataFim) {
        query = query.lte('data_agendada', filtros.dataFim);
      }

      if (filtros?.protecaoSuspensa !== undefined) {
        query = query.eq('protecao_suspensa', filtros.protecaoSuspensa);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useVistoriasManutencao] Erro:', error);
        throw error;
      }

      // Filtrar por busca textual se necessário
      let resultado = data || [];
      
      if (filtros?.busca) {
        const termo = filtros.busca.toLowerCase();
        resultado = resultado.filter((item: any) => {
          const nomeAssociado = item.associado?.nome?.toLowerCase() || '';
          const placaVeiculo = item.veiculo?.placa?.toLowerCase() || '';
          const codigoRastreador = item.rastreador?.codigo?.toLowerCase() || '';
          const protocolo = item.protocolo?.toLowerCase() || '';
          
          return (
            nomeAssociado.includes(termo) ||
            placaVeiculo.includes(termo) ||
            codigoRastreador.includes(termo) ||
            protocolo.includes(termo)
          );
        });
      }

      return resultado as VistoriaManutencao[];
    },
  });
}

// ============================================
// QUERY: MÉTRICAS
// ============================================

/**
 * Hook para obter métricas de vistorias de manutenção
 */
export function useVistoriasManutencaoMetricas() {
  return useQuery({
    queryKey: ['vistorias-manutencao-metricas'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('servicos')
        .select('status, protecao_suspensa, concluida_em')
        .eq('tipo', 'vistoria_manutencao');

      if (error) {
        console.error('[useVistoriasManutencaoMetricas] Erro:', error);
        throw error;
      }

      const metricas: ManutencaoMetricas = {
        pendentes: 0,
        agendadas: 0,
        emAndamento: 0,
        naoCompareceu: 0,
        concluidasHoje: 0,
        total: data?.length || 0,
      };

      (data || []).forEach((item: any) => {
        switch (item.status) {
          case 'pendente':
            metricas.pendentes++;
            break;
          case 'agendada':
            metricas.agendadas++;
            break;
          case 'em_rota':
          case 'em_andamento':
            metricas.emAndamento++;
            break;
          case 'nao_compareceu':
            metricas.naoCompareceu++;
            break;
          case 'concluida':
          case 'aprovada':
            if (item.concluida_em?.startsWith(hoje)) {
              metricas.concluidasHoje++;
            }
            break;
        }
      });

      return metricas;
    },
    refetchInterval: 30000,
  });
}

// ============================================
// QUERY: DETALHE
// ============================================

/**
 * Hook para buscar uma vistoria de manutenção específica
 */
export function useVistoriaManutencaoDetalhe(id: string | undefined) {
  return useQuery({
    queryKey: ['vistoria-manutencao', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('servicos')
        .select(`
          *,
          associado:associados(id, nome, telefone, whatsapp, cpf, email),
          veiculo:veiculos(id, placa, marca, modelo, cor, ano_fabricacao),
          rastreador:rastreadores!servicos_rastreador_id_fkey(id, codigo, imei, plataforma, ultima_comunicacao),
          profissional:profiles!servicos_profissional_id_fkey(id, nome, telefone)
        `)
        .eq('id', id)
        .eq('tipo', 'vistoria_manutencao')
        .single();

      if (error) throw error;
      return data as VistoriaManutencao;
    },
    enabled: !!id,
  });
}

// ============================================
// MUTATION: ABRIR MANUTENÇÃO
// ============================================

/**
 * Hook para abrir uma nova vistoria de manutenção
 * 
 * Fluxo:
 * 1. Busca dados do rastreador (veiculo, associado)
 * 2. Atualiza rastreador.status = 'manutencao'
 * 3. Cria serviço com tipo = 'vistoria_manutencao' e status = 'pendente'
 */
export function useAbrirVistoriaManutencao() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: AbrirManutencaoParams) => {
      // 1. Buscar dados do rastreador
      const { data: rastreador, error: rastreadorError } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          veiculo_id,
          plataforma,
          veiculo:veiculos(
            id,
            associado_id,
            placa,
            associado:associados(
              id,
              nome,
              telefone,
              logradouro,
              numero,
              bairro,
              cidade,
              uf,
              cep,
              endereco_latitude,
              endereco_longitude
            )
          )
        `)
        .eq('id', params.rastreadorId)
        .single();

      if (rastreadorError) {
        console.error('[useAbrirVistoriaManutencao] Erro ao buscar rastreador:', rastreadorError);
        throw new Error('Erro ao buscar informações do rastreador');
      }

      // 2. Atualizar status do rastreador para manutenção
      const { error: updateError } = await supabase
        .from('rastreadores')
        .update({ 
          status: 'manutencao',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.rastreadorId);

      if (updateError) {
        console.error('[useAbrirVistoriaManutencao] Erro ao atualizar status:', updateError);
        throw new Error('Erro ao atualizar status do rastreador');
      }

      // 3. Registrar movimentação de estoque
      const { error: movError } = await supabase.from('estoque_movimentacoes').insert({
        tipo: 'alteracao_status',
        quantidade: 1,
        status_anterior: 'instalado',
        status_novo: 'manutencao',
        rastreador_id: params.rastreadorId,
        observacoes: `Manutenção aberta: ${params.motivo}${params.motivoDetalhe ? ` - ${params.motivoDetalhe}` : ''}`,
      });

      if (movError) {
        console.error('[useAbrirVistoriaManutencao] Erro ao registrar movimentação:', movError);
      }

      // 4. Criar serviço de manutenção
      const veiculo = rastreador.veiculo as any;
      const associado = veiculo?.associado;

      const servicoData = {
        tipo: 'vistoria_manutencao' as const,
        status: 'pendente' as const,
        data_agendada: new Date().toISOString().split('T')[0],
        periodo: 'manha' as const,
        rastreador_id: params.rastreadorId,
        veiculo_id: veiculo?.id || null,
        associado_id: associado?.id || null,
        local_vistoria: 'cliente',
        permite_encaixe: true,
        // Campos específicos de manutenção
        motivo_manutencao: params.motivo,
        motivo_detalhe: params.motivoDetalhe || null,
        observacoes: `Manutenção: ${params.motivo}`,
        // Endereço do associado (para quando for agendada como rota)
        logradouro: associado?.logradouro || null,
        numero: associado?.numero || null,
        bairro: associado?.bairro || null,
        cidade: associado?.cidade || null,
        uf: associado?.uf || null,
        cep: associado?.cep || null,
        latitude: associado?.endereco_latitude || null,
        longitude: associado?.endereco_longitude || null,
      };

      const { data: servico, error: servicoError } = await supabase
        .from('servicos')
        .insert(servicoData)
        .select('id, protocolo')
        .single();

      if (servicoError) {
        console.error('[useAbrirVistoriaManutencao] Erro ao criar serviço:', servicoError);
        throw new Error('Erro ao criar agendamento de manutenção');
      }

      return {
        servicoId: servico.id,
        protocolo: servico.protocolo,
        rastreadorCodigo: rastreador.codigo,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      
      toast.success('Manutenção aberta com sucesso!', {
        description: `Protocolo: ${data.protocolo || 'Gerado'}`,
      });
    },
    onError: (error: Error) => {
      console.error('[useAbrirVistoriaManutencao] Erro:', error);
      toast.error(error.message || 'Erro ao abrir manutenção');
    },
  });
}

// ============================================
// MUTATION: AGENDAR MANUTENÇÃO
// ============================================

/**
 * Hook para agendar uma vistoria de manutenção pendente
 */
export function useAgendarVistoriaManutencao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AgendarManutencaoParams) => {
      const updateData: Record<string, any> = {
        status: 'agendada',
        data_agendada: params.dataAgendada,
        periodo: params.periodo,
        local_tipo_manutencao: params.localTipo,
        profissional_id: params.profissionalId,
        permite_encaixe: params.permiteEncaixe ?? false,
        updated_at: new Date().toISOString(),
      };

      // Se tipo rota e tem endereço específico
      if (params.localTipo === 'rota' && params.localEndereco) {
        updateData.observacoes = params.localEndereco;
      }

      const { error } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', params.servicoId);

      if (error) {
        console.error('[useAgendarVistoriaManutencao] Erro:', error);
        throw new Error('Erro ao agendar manutenção');
      }

      // TODO: Se notificarWhatsApp, disparar notificação via n8n
      if (params.notificarWhatsApp) {
        console.log('[useAgendarVistoriaManutencao] Notificação WhatsApp pendente');
      }

      return { servicoId: params.servicoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      
      toast.success('Manutenção agendada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('[useAgendarVistoriaManutencao] Erro:', error);
      toast.error(error.message || 'Erro ao agendar manutenção');
    },
  });
}

// ============================================
// MUTATION: REGISTRAR RESULTADO
// ============================================

/**
 * Hook para registrar o resultado de uma manutenção
 * 
 * Cenários:
 * A) Problema resolvido: rastreador volta para 'instalado'
 * B) Substituição: rastreador antigo vai para 'retorno_base' ou 'baixado', novo vai para 'instalado'
 * C) Não resolvido: reagenda ou cancela a manutenção
 */
export function useRegistrarResultadoManutencao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RegistrarResultadoParams) => {
      // Buscar dados do serviço
      const { data: servico, error: servicoError } = await supabase
        .from('servicos')
        .select('rastreador_id, veiculo_id')
        .eq('id', params.servicoId)
        .single();

      if (servicoError || !servico) {
        throw new Error('Erro ao buscar dados do serviço');
      }

      const rastreadorAntigoId = servico.rastreador_id;
      const veiculoId = servico.veiculo_id;

      if (params.resultado === 'resolvido') {
        // Cenário A: Problema resolvido
        
        // 1. Atualizar rastreador para 'instalado'
        if (rastreadorAntigoId) {
          const { error: updateError } = await supabase
            .from('rastreadores')
            .update({ 
              status: 'instalado',
              updated_at: new Date().toISOString()
            })
            .eq('id', rastreadorAntigoId);

          if (updateError) {
            console.error('[useRegistrarResultadoManutencao] Erro ao atualizar rastreador:', updateError);
            throw new Error('Erro ao atualizar status do rastreador');
          }

          // Registrar movimentação
          await supabase.from('estoque_movimentacoes').insert({
            tipo: 'alteracao_status',
            quantidade: 1,
            status_anterior: 'manutencao',
            status_novo: 'instalado',
            rastreador_id: rastreadorAntigoId,
            observacoes: 'Manutenção concluída - problema resolvido',
          });
        }

        // Upload de fotos se houver
        let fotosUrls: any[] = [];
        if (params.fotos && params.fotos.length > 0) {
          for (let i = 0; i < params.fotos.length; i++) {
            const foto = params.fotos[i];
            const categoria = params.fotosCategorias?.[i] || 'geral';
            const timestamp = Date.now();
            const path = `manutencao/${params.servicoId}/${timestamp}_${i}.jpg`;
            
            const { error: uploadError } = await supabase.storage
              .from('vistorias')
              .upload(path, foto);
            
            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('vistorias')
                .getPublicUrl(path);
              
              fotosUrls.push({
                url: urlData.publicUrl,
                categoria,
                uploaded_at: new Date().toISOString(),
              });
            }
          }
        }

        // 2. Atualizar serviço
        const updateData: Record<string, any> = {
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          resultado_manutencao: 'resolvido',
          observacoes_analise: params.descricao,
          updated_at: new Date().toISOString(),
        };

        if (params.checklistManutencao) {
          updateData.checklist_manutencao = params.checklistManutencao;
        }

        if (fotosUrls.length > 0) {
          updateData.fotos_manutencao = fotosUrls;
        }

        const { error: servicoUpdateError } = await supabase
          .from('servicos')
          .update(updateData)
          .eq('id', params.servicoId);

        if (servicoUpdateError) {
          throw new Error('Erro ao concluir serviço');
        }

      } else if (params.resultado === 'substituicao') {
        // Cenário B: Substituição de rastreador
        
        if (!params.rastreadorNovoId) {
          throw new Error('Selecione o rastreador substituto');
        }

        const destino = params.destinoRastreadorAntigo || 'baixado';

        // 1. Atualizar rastreador antigo conforme destino
        if (rastreadorAntigoId) {
          const statusNovo = destino === 'retorno_base' ? 'retorno_base' : 'baixado';
          
          const { error: atualizarAntigoError } = await supabase
            .from('rastreadores')
            .update({ 
              status: statusNovo,
              veiculo_id: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', rastreadorAntigoId);

          if (atualizarAntigoError) {
            console.error('[useRegistrarResultadoManutencao] Erro ao atualizar rastreador antigo:', atualizarAntigoError);
            throw new Error('Erro ao atualizar rastreador antigo');
          }

          // Registrar movimentação
          await supabase.from('estoque_movimentacoes').insert({
            tipo: destino === 'retorno_base' ? 'retorno_base' : 'baixa_substituicao',
            quantidade: 1,
            status_anterior: 'manutencao',
            status_novo: statusNovo,
            rastreador_id: rastreadorAntigoId,
            observacoes: destino === 'retorno_base' 
              ? 'Enviado para triagem na base após substituição'
              : 'Baixado por substituição em manutenção',
          });

          // Se for retorno_base, criar registro de manutenção interna
          if (destino === 'retorno_base') {
            await supabase.from('rastreador_manutencao_interna').insert({
              rastreador_id: rastreadorAntigoId,
              servico_origem_id: params.servicoId,
              etapa: 'aguardando_triagem',
              diagnostico_inicial: params.descricao,
            });
          }
        }

        // 2. INSTALAR novo rastreador no mesmo veículo
        const updateNovoData: Record<string, any> = {
          status: 'instalado',
          veiculo_id: veiculoId,
          updated_at: new Date().toISOString(),
        };

        if (params.idPlataforma) {
          updateNovoData.id_plataforma = params.idPlataforma;
        }

        const { error: instalarError } = await supabase
          .from('rastreadores')
          .update(updateNovoData)
          .eq('id', params.rastreadorNovoId);

        if (instalarError) {
          console.error('[useRegistrarResultadoManutencao] Erro ao instalar novo:', instalarError);
          throw new Error('Erro ao instalar novo rastreador');
        }

        // Registrar movimentação de instalação
        await supabase.from('estoque_movimentacoes').insert({
          tipo: 'instalacao_substituicao',
          quantidade: 1,
          status_anterior: 'estoque',
          status_novo: 'instalado',
          rastreador_id: params.rastreadorNovoId,
          veiculo_id: veiculoId,
          observacoes: 'Instalado em substituição',
        });

        // 3. Atualizar serviço
        const { error: servicoUpdateError } = await supabase
          .from('servicos')
          .update({
            status: 'concluida',
            concluida_em: new Date().toISOString(),
            resultado_manutencao: 'substituicao',
            rastreador_substituto_id: params.rastreadorNovoId,
            rastreador_destino_pos_substituicao: destino,
            observacoes_analise: params.descricao,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.servicoId);

        if (servicoUpdateError) {
          throw new Error('Erro ao concluir serviço');
        }

      } else if (params.resultado === 'nao_resolvido') {
        // Cenário C: Não resolvido
        
        const acao = params.acaoNaoResolvido || 'reagendar';

        if (acao === 'reagendar') {
          // Reagendar: serviço volta para pendente
          const { error: servicoUpdateError } = await supabase
            .from('servicos')
            .update({
              status: 'pendente',
              observacoes_analise: `Não resolvido: ${params.descricao}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', params.servicoId);

          if (servicoUpdateError) {
            throw new Error('Erro ao reagendar serviço');
          }

        } else {
          // Cancelar: rastreador volta para instalado
          if (rastreadorAntigoId) {
            const { error: updateError } = await supabase
              .from('rastreadores')
              .update({ 
                status: 'instalado',
                updated_at: new Date().toISOString()
              })
              .eq('id', rastreadorAntigoId);

            if (updateError) {
              throw new Error('Erro ao atualizar rastreador');
            }

            await supabase.from('estoque_movimentacoes').insert({
              tipo: 'alteracao_status',
              quantidade: 1,
              status_anterior: 'manutencao',
              status_novo: 'instalado',
              rastreador_id: rastreadorAntigoId,
              observacoes: 'Manutenção cancelada - não resolvido',
            });
          }

          const { error: servicoUpdateError } = await supabase
            .from('servicos')
            .update({
              status: 'cancelada',
              observacoes_analise: `Cancelado - Não resolvido: ${params.descricao}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', params.servicoId);

          if (servicoUpdateError) {
            throw new Error('Erro ao cancelar serviço');
          }
        }
      }

      return { servicoId: params.servicoId, resultado: params.resultado, acao: params.acaoNaoResolvido };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna'] });
      
      let msg = 'Manutenção concluída com sucesso!';
      if (data.resultado === 'substituicao') {
        msg = 'Manutenção concluída com substituição!';
      } else if (data.resultado === 'nao_resolvido') {
        msg = data.acao === 'reagendar' 
          ? 'Manutenção reagendada'
          : 'Manutenção cancelada';
      }
      
      toast.success(msg);
    },
    onError: (error: Error) => {
      console.error('[useRegistrarResultadoManutencao] Erro:', error);
      toast.error(error.message || 'Erro ao registrar resultado');
    },
  });
}

// ============================================
// MUTATION: MARCAR NÃO COMPARECEU
// ============================================

/**
 * Hook para marcar que o associado não compareceu (apenas tipo BASE)
 * Suspende a proteção conforme regulamento 5.12
 */
export function useMarcarNaoCompareceu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MarcarNaoCompareceuParams) => {
      const { error } = await supabase
        .from('servicos')
        .update({
          status: 'nao_compareceu' as any,
          observacoes_analise: params.observacao || 'Associado não compareceu',
          updated_at: new Date().toISOString(),
          // NÃO suspender proteção ainda - coordenador/diretor decide
        })
        .eq('id', params.servicoId);

      if (error) {
        console.error('[useMarcarNaoCompareceu] Erro:', error);
        throw new Error('Erro ao marcar não comparecimento');
      }

      return { servicoId: params.servicoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      
      toast.info('Não comparecimento registrado', {
        description: 'O coordenador/diretor poderá reagendar ou cancelar com suspensão.',
      });
    },
    onError: (error: Error) => {
      console.error('[useMarcarNaoCompareceu] Erro:', error);
      toast.error(error.message || 'Erro ao marcar não comparecimento');
    },
  });
}

// ============================================
// MUTATION: REAGENDAR PÓS-AUSÊNCIA
// ============================================

/**
 * Hook para reagendar uma manutenção após não comparecimento
 */
export function useReagendarPosAusencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (servicoId: string) => {
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'pendente',
          data_agendada: null,
          periodo: null,
          profissional_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', servicoId);
      
      if (error) {
        console.error('[useReagendarPosAusencia] Erro:', error);
        throw new Error('Erro ao reagendar manutenção');
      }

      return { servicoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      
      toast.success('Manutenção reagendada', {
        description: 'Voltou para fila de agendamento.',
      });
    },
    onError: (error: Error) => {
      console.error('[useReagendarPosAusencia] Erro:', error);
      toast.error(error.message || 'Erro ao reagendar');
    },
  });
}

// ============================================
// MUTATION: CANCELAR MANUTENÇÃO
// ============================================

/**
 * Hook para cancelar uma vistoria de manutenção
 */
export function useCancelarVistoriaManutencao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, motivo, suspenderProtecao }: { 
      servicoId: string; 
      motivo?: string;
      suspenderProtecao?: boolean;
    }) => {
      // Buscar rastreador_id do serviço
      const { data: servico } = await supabase
        .from('servicos')
        .select('rastreador_id')
        .eq('id', servicoId)
        .single();

      // Cancelar serviço
      const updateData: Record<string, any> = {
        status: 'cancelada',
        observacoes_analise: motivo || 'Cancelado',
        updated_at: new Date().toISOString(),
      };
      
      // Se deve suspender proteção (quando vem do status nao_compareceu)
      if (suspenderProtecao) {
        updateData.protecao_suspensa = true;
        updateData.data_suspensao = new Date().toISOString();
      }

      const { error } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', servicoId);

      if (error) {
        throw new Error('Erro ao cancelar manutenção');
      }

      // Se tinha rastreador, voltar para 'instalado' (cancelamento não é baixa)
      if (servico?.rastreador_id) {
        await supabase
          .from('rastreadores')
          .update({ 
            status: 'instalado',
            updated_at: new Date().toISOString()
          })
          .eq('id', servico.rastreador_id);

        // Registrar movimentação
        await supabase.from('estoque_movimentacoes').insert({
          tipo: 'alteracao_status',
          quantidade: 1,
          status_anterior: 'manutencao',
          status_novo: 'instalado',
          rastreador_id: servico.rastreador_id,
          observacoes: 'Manutenção cancelada - rastreador retornou ao status instalado',
        });
      }

      return { servicoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      
      toast.success('Manutenção cancelada');
    },
    onError: (error: Error) => {
      console.error('[useCancelarVistoriaManutencao] Erro:', error);
      toast.error(error.message || 'Erro ao cancelar');
    },
  });
}

// ============================================
// QUERY: RASTREADORES DISPONÍVEIS PARA SUBSTITUIÇÃO
// ============================================

/**
 * Hook para listar rastreadores disponíveis para substituição
 * Apenas rastreadores com status = 'estoque'
 */
export function useRastreadoresParaSubstituicao() {
  return useQuery({
    queryKey: ['rastreadores-para-substituicao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, numero_serie, imei, plataforma')
        .eq('status', 'estoque')
        .order('codigo', { ascending: true });

      if (error) {
        console.error('[useRastreadoresParaSubstituicao] Erro:', error);
        throw error;
      }

      return data || [];
    },
  });
}

// ============================================
// QUERY: RASTREADORES INSTALADOS PARA ABRIR MANUTENÇÃO
// ============================================

/**
 * Hook para listar rastreadores instalados (para abrir manutenção)
 */
export function useRastreadoresInstalados(busca?: string) {
  return useQuery({
    queryKey: ['rastreadores-instalados', busca],
    queryFn: async () => {
      let query = supabase
        .from('rastreadores')
        .select(`
          id, 
          codigo, 
          numero_serie, 
          imei, 
          plataforma,
          ultima_comunicacao,
          veiculo:veiculos(
            id,
            placa,
            marca,
            modelo,
            associado:associados(id, nome, telefone)
          )
        `)
        .eq('status', 'instalado')
        .not('veiculo_id', 'is', null)
        .order('codigo', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('[useRastreadoresInstalados] Erro:', error);
        throw error;
      }

      let resultado = data || [];

      // Filtrar por busca se necessário
      if (busca) {
        const termo = busca.toLowerCase();
        resultado = resultado.filter((item: any) => {
          const codigo = item.codigo?.toLowerCase() || '';
          const imei = item.imei?.toLowerCase() || '';
          const placa = item.veiculo?.placa?.toLowerCase() || '';
          const nome = item.veiculo?.associado?.nome?.toLowerCase() || '';
          
          return (
            codigo.includes(termo) ||
            imei.includes(termo) ||
            placa.includes(termo) ||
            nome.includes(termo)
          );
        });
      }

      return resultado;
    },
  });
}
