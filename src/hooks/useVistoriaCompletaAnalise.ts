import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface InstalacaoCompleta {
  id: string;
  status: string;
  data_agendada: string | null;
  periodo: string | null;
  concluida_em: string | null;
  observacoes: string | null;
  contrato_id: string | null;
  cotacao_id: string | null;
  associados: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    cpf: string;
    status: string;
  } | null;
  veiculos: {
    id: string;
    placa: string;
    marca: string | null;
    modelo: string | null;
    ano_modelo: number | null;
    cor: string | null;
    chassi: string | null;
    cobertura_total: boolean | null;
    cobertura_roubo_furto: boolean | null;
    status: string;
  } | null;
  rastreadores: {
    id: string;
    imei: string;
    codigo: string | null;
    numero_serie: string | null;
    plataforma: string | null;
    status: string;
    plataforma_device_id: string | null;
    plataforma_veiculo_id: string | null;
  } | null;
  instalador: {
    id: string;
    nome: string;
  } | null;
}

interface AtivarRastreadorParams {
  instalacaoId: string;
  veiculoId: string;
  associadoId: string;
  rastreadorId: string;
  imei: string;
}

export interface FotoVistoriaItem {
  id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

/**
 * Hook para buscar dados de uma instalação completa para análise
 */
export function useInstalacaoParaAnalise(instalacaoId: string | undefined) {
  return useQuery({
    queryKey: ['instalacao-analise', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return null;

      const { data, error } = await supabase
        .from('instalacoes')
        .select(`
          id,
          status,
          data_agendada,
          periodo,
          concluida_em,
          observacoes,
          contrato_id,
          cotacao_id,
          associados (
            id, nome, email, telefone, cpf, status
          ),
          veiculos (
            id, placa, marca, modelo, ano_modelo, cor, chassi,
            cobertura_total, cobertura_roubo_furto, status
          ),
          rastreadores (
            id, imei, codigo, numero_serie, plataforma, status,
            plataforma_device_id, plataforma_veiculo_id
          ),
          instalador:profiles!instalacoes_instalador_id_fkey (id, nome)
        `)
        .eq('id', instalacaoId)
        .single();

      if (error) throw error;
      return data as InstalacaoCompleta;
    },
    enabled: !!instalacaoId,
  });
}

/**
 * Hook para buscar instalações aguardando ativação de rastreador
 */
export function useInstalacoesAguardandoAtivacao() {
  return useQuery({
    queryKey: ['instalacoes-aguardando-ativacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instalacoes')
        .select(`
          id,
          status,
          concluida_em,
          associados!inner (id, nome, telefone, status),
          veiculos!inner (
            id, placa, marca, modelo,
            cobertura_total, cobertura_roubo_furto, status
          ),
          rastreadores (id, imei, codigo, plataforma, status, plataforma_device_id)
        `)
        .eq('status', 'concluida')
        .eq('veiculos.cobertura_roubo_furto', true)
        .eq('veiculos.cobertura_total', false)
        // Esconde itens já ativados (SGA/local). Se associado já é 'ativo' OU
        // veículo já é 'ativo' OU rastreador já tem device ativo na plataforma,
        // não há mais o que aprovar nesta fila.
        .neq('associados.status', 'ativo')
        .neq('veiculos.status', 'ativo')
        .order('concluida_em', { ascending: false });

      if (error) throw error;

      // Defesa extra no client: ocultar quando rastreador já ativado na plataforma
      const filtrado = (data || []).filter((row: any) => {
        const r = row?.rastreadores;
        if (r && r.plataforma_device_id) return false;
        return true;
      });

      return filtrado;
    },
  });
}

/**
 * Hook para ativar rastreador na plataforma (Softruck, etc)
 */
export function useAtivarRastreadorPlataforma() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: AtivarRastreadorParams) => {
      const { instalacaoId, veiculoId, associadoId, rastreadorId, imei } = params;

      const { data: rastreador, error: rastError } = await supabase
        .from('rastreadores')
        .select('plataforma')
        .eq('id', rastreadorId)
        .single();

      if (rastError) throw new Error('Erro ao buscar dados do rastreador');

      const { data: associado } = await supabase
        .from('associados')
        .select('email')
        .eq('id', associadoId)
        .single();

      if (rastreador.plataforma === 'softruck') {
        const { data: result, error } = await supabase.functions.invoke('softruck-ativar-dispositivo', {
          body: {
            imei,
            veiculoId,
            associadoId,
            associadoEmail: associado?.email,
          },
        });

        if (error) throw error;
        if (!result.success) throw new Error(result.error || 'Erro ao ativar na Softruck');
      } else if (rastreador.plataforma === 'rede_veiculos') {
        // Vincular cliente+veículo+equipamento e ativar na Rede Veículos
        // Isso cria o cliente na plataforma e dispara o envio de login/senha por e-mail
        const { data: result, error } = await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
          body: {
            imei,
            veiculoId,
            associadoId,
          },
        });

        if (error) throw error;
        if (!result?.success) throw new Error(result?.error || 'Erro ao vincular na Rede Veículos');
      } else {
        console.warn('[ativar-rastreador] Plataforma sem integração de ativação:', rastreador.plataforma);
      }

      // Ativação atômica via edge function única (lock + CAS + log + auditoria)
      const { data: ativacao, error: ativacaoError } = await supabase.functions.invoke('ativar-associado', {
        body: {
          associado_id: associadoId,
          veiculo_id: veiculoId,
          instalacao_id: instalacaoId,
          source: 'hook:useVistoriaCompletaAnalise',
          actor_id: profile?.id ?? null,
          ativar_cobertura_total: true,
          allowed_from: ['assinado', 'aguardando_instalacao', 'pendente', 'em_analise', 'documentacao_pendente', 'aprovado'],
          metadata: { rastreador_id: rastreadorId, imei, plataforma: rastreador.plataforma },
        },
      });

      // Em non-2xx o supabase-js coloca o body em error.context — extrair mensagem real
      if (ativacaoError) {
        let detailMsg = ativacaoError.message;
        try {
          const ctx = (ativacaoError as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error === 'transicao_invalida') {
              detailMsg = `Não é possível ativar: status atual do associado é "${body.from_status}". Conclua a aprovação cadastral antes de ativar.`;
            } else if (body?.error === 'campos_obrigatorios_faltando') {
              detailMsg = `Campos obrigatórios faltando: ${(body.campos_faltando || []).join(', ')}`;
            } else if (body?.mensagem || body?.error) {
              detailMsg = body.mensagem || body.error;
            }
          }
        } catch { /* ignore */ }
        throw new Error(detailMsg);
      }
      if (ativacao && ativacao.success === false && !ativacao.idempotente) {
        throw new Error(ativacao.error === 'campos_obrigatorios_faltando'
          ? `Campos obrigatórios faltando: ${(ativacao.campos_faltando || []).join(', ')}`
          : ativacao.mensagem || ativacao.error || 'Falha na ativação');
      }

      try {
        const { data: veiculoInfo } = await supabase
          .from('veiculos')
          .select('placa, marca, modelo')
          .eq('id', veiculoId)
          .single();

        supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'cobertura_total_ativada',
            associado_id: associadoId,
            dados: { placa: veiculoInfo?.placa || '', marca: veiculoInfo?.marca || '', modelo: veiculoInfo?.modelo || '' },
          },
        }).catch(err => console.warn('[ativar-rastreador] Erro ao notificar associado (não crítico):', err));
      } catch (notifError) {
        console.warn('[ativar-rastreador] Erro ao preparar notificação (não crítico):', notifError);
      }

      await supabase.from('associados_historico').insert({
        associado_id: associadoId,
        tipo: 'ativacao',
        descricao: `Rastreador ativado manualmente na plataforma ${rastreador.plataforma}. Proteção 360º liberada.`,
        dados_novos: {
          instalacao_id: instalacaoId,
          rastreador_id: rastreadorId,
          imei,
          plataforma: rastreador.plataforma,
          ativado_por: profile?.id,
        },
        usuario_id: profile?.id,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacao-analise'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-ativacao'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      toast.success('Rastreador ativado com sucesso! Proteção 360º liberada.');
    },
    onError: (error) => {
      console.error('Erro ao ativar rastreador:', error);
      toast.error(`Erro ao ativar rastreador: ${error.message}`);
    },
  });
}

/**
 * Hook para buscar dados da vistoria/instalação do instalador
 */
function useInstaladorData(instalacaoId: string | undefined) {
  // 1. Buscar serviço vinculado à instalação (tem vistoria_origem_id)
  const servico = useQuery({
    queryKey: ['servico-instalacao-dados', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return null;
      const { data, error } = await supabase
        .from('servicos')
        .select('id, checklist_data, quilometragem, assinatura_cliente_url, decisao_instalador, ressalvas_instalador, observacoes, km_atual, vistoria_origem_id')
        .eq('instalacao_origem_id', instalacaoId)
        .eq('tipo', 'instalacao')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!instalacaoId,
  });

  // 2. Buscar vistoria: primeiro via servico.vistoria_origem_id, fallback para vistorias.instalacao_id
  const vistoriaOrigemId = servico.data?.vistoria_origem_id;
  const vistoria = useQuery({
    queryKey: ['vistoria-instalacao', instalacaoId, vistoriaOrigemId],
    queryFn: async () => {
      if (!instalacaoId) return null;

      // Caminho principal: via servico.vistoria_origem_id
      if (vistoriaOrigemId) {
        const { data, error } = await supabase
          .from('vistorias')
          .select('id, video_360_url, km_atual, observacoes, status, modalidade, vistoriador_id')
          .eq('id', vistoriaOrigemId)
          .maybeSingle();
        if (!error && data) return data;
      }

      // Fallback: busca antiga por instalacao_id
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, video_360_url, km_atual, observacoes, status, modalidade, vistoriador_id')
        .eq('instalacao_id', instalacaoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!instalacaoId && !servico.isLoading,
  });

  // 3. Buscar fotos da vistoria encontrada
  const fotos = useQuery({
    queryKey: ['vistoria-fotos-instalacao', vistoria.data?.id],
    queryFn: async () => {
      if (!vistoria.data?.id) return [];
      const { data, error } = await supabase
        .from('vistoria_fotos')
        .select('id, arquivo_url, tipo, created_at')
        .eq('vistoria_id', vistoria.data.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vistoria.data?.id,
  });

  const rastreadorExpanded = useQuery({
    queryKey: ['rastreador-instalacao-local', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return null;
      const { data: inst } = await supabase
        .from('instalacoes')
        .select('rastreador_id')
        .eq('id', instalacaoId)
        .single();
      if (!inst?.rastreador_id) return null;
      const { data, error } = await supabase
        .from('rastreadores')
        .select('local_instalacao, descricao_instalacao, foto_local_instalacao_url')
        .eq('id', inst.rastreador_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!instalacaoId,
  });

  // Buscar nome do vistoriador/instalador
  const vistoriadorNome = useQuery({
    queryKey: ['vistoriador-nome', vistoria.data?.vistoriador_id],
    queryFn: async () => {
      if (!vistoria.data?.vistoriador_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', vistoria.data.vistoriador_id)
        .single();
      return data?.nome || null;
    },
    enabled: !!vistoria.data?.vistoriador_id,
  });

  return {
    vistoria: vistoria.data,
    fotos: (fotos.data || []) as FotoVistoriaItem[],
    servico: servico.data,
    rastreadorLocal: rastreadorExpanded.data,
    vistoriadorNome: vistoriadorNome.data,
    isLoadingInstaladorData: vistoria.isLoading || fotos.isLoading || servico.isLoading || rastreadorExpanded.isLoading,
  };
}

/**
 * Hook para buscar fotos/vídeo da autovistoria do associado
 */
function useAutovistoriaData(contratoId: string | null | undefined, cotacaoId: string | null | undefined) {
  return useQuery({
    queryKey: ['autovistoria-dados', contratoId, cotacaoId],
    queryFn: async (): Promise<{
      fotos: FotoVistoriaItem[];
      video360Url: string | null;
      associadoNome: string | null;
      origem: string;
    }> => {
      // 1. Buscar vistoria de autovistoria via contrato_id
      if (contratoId) {
        const { data: vistoriaContrato } = await supabase
          .from('vistorias')
          .select('id, video_360_url, modalidade, associado_id')
          .eq('contrato_id', contratoId)
          .neq('modalidade', 'presencial')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (vistoriaContrato?.id) {
          const { data: fotos } = await supabase
            .from('vistoria_fotos')
            .select('id, arquivo_url, tipo, created_at')
            .eq('vistoria_id', vistoriaContrato.id)
            .order('created_at', { ascending: true });

          // Buscar nome do associado
          let associadoNome: string | null = null;
          if (vistoriaContrato.associado_id) {
            const { data: assoc } = await supabase
              .from('associados')
              .select('nome')
              .eq('id', vistoriaContrato.associado_id)
              .single();
            associadoNome = assoc?.nome || null;
          }

          if (fotos && fotos.length > 0) {
            return {
              fotos: fotos as FotoVistoriaItem[],
              video360Url: vistoriaContrato.video_360_url,
              associadoNome,
              origem: 'vistoria_fotos',
            };
          }
        }
      }

      // 2. Buscar vistoria de autovistoria via cotacao_id
      if (cotacaoId) {
        const { data: vistoriaCotacao } = await supabase
          .from('vistorias')
          .select('id, video_360_url, modalidade, associado_id')
          .eq('cotacao_id', cotacaoId)
          .neq('modalidade', 'presencial')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (vistoriaCotacao?.id) {
          const { data: fotos } = await supabase
            .from('vistoria_fotos')
            .select('id, arquivo_url, tipo, created_at')
            .eq('vistoria_id', vistoriaCotacao.id)
            .order('created_at', { ascending: true });

          let associadoNome: string | null = null;
          if (vistoriaCotacao.associado_id) {
            const { data: assoc } = await supabase
              .from('associados')
              .select('nome')
              .eq('id', vistoriaCotacao.associado_id)
              .single();
            associadoNome = assoc?.nome || null;
          }

          if (fotos && fotos.length > 0) {
            return {
              fotos: fotos as FotoVistoriaItem[],
              video360Url: vistoriaCotacao.video_360_url,
              associadoNome,
              origem: 'vistoria_fotos',
            };
          }
        }

        // 3. Fallback: cotacoes_vistoria_fotos (legado)
        const { data: fotosLegado } = await supabase
          .from('cotacoes_vistoria_fotos')
          .select('id, tipo, arquivo_url, created_at')
          .eq('cotacao_id', cotacaoId)
          .order('created_at', { ascending: true });

        if (fotosLegado && fotosLegado.length > 0) {
          return {
            fotos: fotosLegado as FotoVistoriaItem[],
            video360Url: null,
            associadoNome: null,
            origem: 'cotacoes_vistoria_fotos',
          };
        }
      }

      return { fotos: [], video360Url: null, associadoNome: null, origem: 'nenhum' };
    },
    enabled: !!(contratoId || cotacaoId),
  });
}

/**
 * Hook unificado para análise de vistoria completa
 */
export function useVistoriaCompletaAnalise(instalacaoId: string | undefined) {
  const instalacao = useInstalacaoParaAnalise(instalacaoId);
  const ativarMutation = useAtivarRastreadorPlataforma();
  const instaladorData = useInstaladorData(instalacaoId);
  const autovistoriaData = useAutovistoriaData(
    instalacao.data?.contrato_id,
    instalacao.data?.cotacao_id,
  );

  const podeAtivar =
    instalacao.data?.status === 'concluida' &&
    instalacao.data?.rastreadores &&
    instalacao.data?.veiculos?.cobertura_roubo_furto === true &&
    instalacao.data?.veiculos?.cobertura_total !== true;

  const ativarRastreador = async () => {
    if (!instalacao.data || !instalacao.data.rastreadores) {
      toast.error('Dados incompletos para ativação');
      return;
    }

    await ativarMutation.mutateAsync({
      instalacaoId: instalacao.data.id,
      veiculoId: instalacao.data.veiculos!.id,
      associadoId: instalacao.data.associados!.id,
      rastreadorId: instalacao.data.rastreadores.id,
      imei: instalacao.data.rastreadores.imei,
    });
  };

  return {
    instalacao: instalacao.data,
    isLoading: instalacao.isLoading,
    error: instalacao.error,
    podeAtivar,
    ativarRastreador,
    isAtivando: ativarMutation.isPending,
    // Dados do instalador
    vistoria: instaladorData.vistoria,
    fotosVistoria: instaladorData.fotos,
    servico: instaladorData.servico,
    rastreadorLocal: instaladorData.rastreadorLocal,
    vistoriadorNome: instaladorData.vistoriadorNome,
    isLoadingInstaladorData: instaladorData.isLoadingInstaladorData,
    // Dados da autovistoria do associado
    autovistoria: {
      fotos: (autovistoriaData.data?.fotos || []) as FotoVistoriaItem[],
      video360Url: autovistoriaData.data?.video360Url || null,
      associadoNome: autovistoriaData.data?.associadoNome || null,
    },
    isLoadingAutovistoria: autovistoriaData.isLoading,
  };
}
