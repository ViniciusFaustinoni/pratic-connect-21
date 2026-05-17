import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ==============================
// Query: Instalações aguardando aprovação do monitoramento
// ==============================
export function useInstalacoesAguardandoAprovacao() {
  return useQuery({
    queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'],
    queryFn: async () => {
      // Buscar serviços de instalação concluídos
      const { data: servicos, error } = await (supabase as any)
        .from('servicos')
        .select(`
          id,
          tipo,
          modalidade,
          status,
          data_agendada,
          concluida_em,
          profissional_id,
          veiculo_id,
          associado_id,
          contrato_id,
          instalacao_origem_id,
          vistoria_origem_id,
          observacoes,
          decisao_instalador,
          profissional:profissional_id(nome),
          veiculo:veiculo_id(placa, marca, modelo, ano_modelo, combustivel, valor_fipe, cobertura_roubo_furto, cobertura_total),
          associado:associado_id(nome, telefone, email, cpf, status),
          instalacao:instalacao_origem_id(contrato:contrato_id(cadastro_aprovado)),
          vistoria:vistoria_origem_id(contrato:contrato_id(cadastro_aprovado))
        `)
        .in('tipo', ['instalacao', 'vistoria_entrada'])
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: true });

      if (error) throw error;

      // Resolver cadastro_aprovado via vistoria_origem_id (sem FK declarado → query manual)
      const vistoriaIds = Array.from(
        new Set((servicos || [])
          .filter((s: any) => s.vistoria_origem_id && !s.instalacao?.contrato)
          .map((s: any) => s.vistoria_origem_id))
      );
      const vistoriaContratoMap = new Map<string, boolean>();
      if (vistoriaIds.length > 0) {
        const { data: vistorias } = await supabase
          .from('vistorias')
          .select('id, contrato_id, contratos:contrato_id(cadastro_aprovado)')
          .in('id', vistoriaIds as string[]);
        (vistorias || []).forEach((v: any) => {
          vistoriaContratoMap.set(v.id, v.contratos?.cadastro_aprovado === true);
        });
      }

      // Gate do Cadastro: Monitoramento só recebe após aprovação manual do Cadastro.
      const aprovados = (servicos || []).filter((s: any) => {
        const v = s.veiculo;
        if (!v || v.cobertura_total === true) return false;
        const cadastroAprovado =
          s.instalacao?.contrato?.cadastro_aprovado === true ||
          (s.vistoria_origem_id && vistoriaContratoMap.get(s.vistoria_origem_id) === true);
        return cadastroAprovado;
      });

      // DEDUPE DEFENSIVO (regra canônica autovistoria acima da FIPE):
      // Se o contrato já tem uma instalação TÉCNICA (tipo='instalacao' OU modalidade≠'autovistoria')
      // concluida na fila, suprime qualquer vistoria_entrada de autovistoria do mesmo contrato.
      // Evita duplicatas e impede que autovistoria opcional acima-FIPE apareça como aprovação final.
      const contratosComInstalacaoTecnica = new Set<string>();
      for (const s of aprovados) {
        const isAuto = (s.modalidade || '').toLowerCase() === 'autovistoria';
        if (!isAuto && s.contrato_id) contratosComInstalacaoTecnica.add(s.contrato_id);
      }

      // Buscar rastreadores vinculados para evitar listar autovistoria de veículo
      // que ainda EXIGE instalação física de rastreador (FIPE≥30k carro / 9k moto / diesel).
      // Nesses casos, Monitoramento não deve aprovar — fluxo correto é instalação técnica primeiro.
      const veiculoIds = Array.from(new Set(aprovados.map((s: any) => s.veiculo_id).filter(Boolean)));
      const veiculosComRastreador = new Set<string>();
      if (veiculoIds.length > 0) {
        const { data: rastreadoresVinc } = await supabase
          .from('rastreadores')
          .select('veiculo_id')
          .in('veiculo_id', veiculoIds as string[])
          .not('veiculo_id', 'is', null);
        (rastreadoresVinc || []).forEach((r: any) => {
          if (r.veiculo_id) veiculosComRastreador.add(r.veiculo_id);
        });
      }

      const FIPE_MIN_CARRO = 30000;
      const FIPE_MIN_MOTO = 9000;
      const exigeRastreador = (v: any): boolean => {
        if (!v) return false;
        const comb = String(v.combustivel || '').toLowerCase();
        if (comb.includes('diesel')) return true;
        const fipe = Number(v.valor_fipe) || 0;
        const isMoto = String(v.modelo || '').toLowerCase().includes('moto')
          || String(v.marca || '').toLowerCase().match(/honda|yamaha|suzuki|kawasaki|bmw motorrad|harley/);
        const limite = isMoto ? FIPE_MIN_MOTO : FIPE_MIN_CARRO;
        return fipe >= limite;
      };

      const pendentes = aprovados.filter((s: any) => {
        const isAuto = (s.modalidade || '').toLowerCase() === 'autovistoria';
        if (isAuto && s.contrato_id && contratosComInstalacaoTecnica.has(s.contrato_id)) return false;
        // GUARD CANÔNICO: autovistoria de veículo que exige rastreador não promove ativação.
        // Só entra na fila quando rastreador físico está vinculado (instalação concluída).
        if (isAuto && exigeRastreador(s.veiculo) && !veiculosComRastreador.has(s.veiculo_id)) return false;
        return true;
      });

      return pendentes;
    },
    refetchInterval: 60_000, // Fase 4
    refetchIntervalInBackground: false,
  });
}

// ==============================
// Stats
// ==============================
export function useAprovacaoMonitoramentoStats() {
  return useQuery({
    queryKey: ['aprovacao-monitoramento-stats'],
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();

      // Aguardando = servicos concluidos com veículo sem cobertura_total
      const { data: pendentes } = await (supabase as any)
        .from('servicos')
        .select('id, tipo, modalidade, veiculo_id, veiculo:veiculo_id(combustivel, valor_fipe, marca, modelo, cobertura_roubo_furto, cobertura_total), instalacao:instalacao_origem_id(contrato:contrato_id(cadastro_aprovado)), vistoria:vistoria_origem_id(contrato:contrato_id(cadastro_aprovado))')
        .in('tipo', ['instalacao', 'vistoria_entrada'])
        .eq('status', 'concluida');

      const candidatos = (pendentes || []).filter((s: any) =>
        s.veiculo?.cobertura_total !== true &&
        (s.instalacao?.contrato?.cadastro_aprovado === true ||
         s.vistoria?.contrato?.cadastro_aprovado === true)
      );

      // Mesmo guard do hook principal: autovistoria de veículo que exige rastreador
      // sem rastreador vinculado não conta como aguardando.
      const veiculoIds = Array.from(new Set(candidatos.map((s: any) => s.veiculo_id).filter(Boolean)));
      const comRastreador = new Set<string>();
      if (veiculoIds.length > 0) {
        const { data: rs } = await supabase
          .from('rastreadores')
          .select('veiculo_id')
          .in('veiculo_id', veiculoIds as string[])
          .not('veiculo_id', 'is', null);
        (rs || []).forEach((r: any) => r.veiculo_id && comRastreador.add(r.veiculo_id));
      }
      const exigeRast = (v: any): boolean => {
        if (!v) return false;
        const comb = String(v.combustivel || '').toLowerCase();
        if (comb.includes('diesel')) return true;
        const fipe = Number(v.valor_fipe) || 0;
        const isMoto = String(v.modelo || '').toLowerCase().includes('moto')
          || !!String(v.marca || '').toLowerCase().match(/honda|yamaha|suzuki|kawasaki|bmw motorrad|harley/);
        return fipe >= (isMoto ? 9000 : 30000);
      };
      const aguardando = candidatos.filter((s: any) => {
        const isAuto = String(s.modalidade || '').toLowerCase() === 'autovistoria';
        if (isAuto && exigeRast(s.veiculo) && !comRastreador.has(s.veiculo_id)) return false;
        return true;
      }).length;

      // Aprovados hoje = histórico com tipo aprovação do monitoramento hoje
      const { count: aprovadosHoje } = await supabase
        .from('associados_historico')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'protecao_360_aprovada_monitoramento')
        .gte('created_at', hojeISO);

      // Reprovados hoje
      const { count: reprovadosHoje } = await supabase
        .from('associados_historico')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'protecao_360_reprovada_monitoramento')
        .gte('created_at', hojeISO);

      return {
        aguardando,
        aprovadosHoje: aprovadosHoje || 0,
        reprovadosHoje: reprovadosHoje || 0,
      };
    },
    refetchInterval: 60_000, // Fase 4
    refetchIntervalInBackground: false,
  });
}

// ==============================
// Mutation: Aprovar instalação (ativa Proteção 360 + notifica)
// ==============================
interface AprovarData {
  servicoId: string;
  veiculoId: string;
  associadoId: string;
  observacoes?: string;
}

export function useAprovarInstalacaoMonitoramento() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: AprovarData) => {
      const agora = new Date().toISOString();

      // 0a. Pré-validar campos obrigatórios ANTES de tocar em qualquer status
      const { data: validacao, error: valErr } = await supabase.rpc(
        'fn_validar_campos_ativacao',
        { _associado_id: data.associadoId } as any,
      );
      if (valErr) throw valErr;
      const faltando = (validacao as any)?.faltando ?? (validacao as any)?.campos_faltando ?? [];
      if (Array.isArray(faltando) && faltando.length > 0) {
        // Erro estruturado: a UI consegue abrir o dialog de correção em vez de só toast
        const err: any = new Error(
          `Não é possível aprovar: campos obrigatórios faltando — ${faltando.join(', ')}`,
        );
        err.code = 'campos_obrigatorios_faltando';
        err.camposFaltando = faltando;
        throw err;
      }

      // 0b. Bloquear se associado já está em estado terminal
      const { data: assocAtual } = await supabase
        .from('associados')
        .select('status')
        .eq('id', data.associadoId)
        .maybeSingle();
      if (assocAtual && ['cancelado','cancelamento_solicitado','recusado','inadimplente_terminal'].includes(String(assocAtual.status))) {
        throw new Error(`Associado está em "${assocAtual.status}" — não pode ser aprovado.`);
      }

      // 0c. Marcar o serviço como APROVADO (encerra fase "Em Análise" em Serviços de Campo)
      const { error: servicoError } = await supabase
        .from('servicos')
        .update({
          status: 'aprovada',
          analisado_em: agora,
          analisado_por: profile?.id ?? null,
          observacoes_analise: data.observacoes ?? null,
          updated_at: agora,
        } as any)
        .eq('id', data.servicoId);

      if (servicoError) throw servicoError;

      // 1. Buscar cotação/contrato vinculados à instalação (para passar ao orquestrador)
      const { data: servicoData } = await supabase
        .from('servicos')
        .select('instalacao_origem_id')
        .eq('id', data.servicoId)
        .single();

      let cotacaoId: string | null = null;
      let contratoId: string | null = null;
      if (servicoData?.instalacao_origem_id) {
        const { data: instalacao } = await supabase
          .from('instalacoes')
          .select('cotacao_id, contrato_id')
          .eq('id', servicoData.instalacao_origem_id)
          .single();
        cotacaoId = instalacao?.cotacao_id ?? null;
        contratoId = instalacao?.contrato_id ?? null;
      }

      // 2. Ativação atômica via edge function única (lock + CAS + log)
      const { data: ativacao, error: ativacaoError } = await supabase.functions.invoke('ativar-associado', {
        body: {
          associado_id: data.associadoId,
          veiculo_id: data.veiculoId,
          contrato_id: contratoId,
          cotacao_id: cotacaoId,
          servico_id: data.servicoId,
          source: 'hook:useAprovacaoMonitoramento',
          actor_id: profile?.id ?? null,
          ativar_cobertura_total: true,
          ativar_cobertura_roubo_furto: true,
          allowed_from: ['assinado', 'aguardando_instalacao', 'pendente', 'em_analise', 'documentacao_pendente', 'aprovado'],
          metadata: { observacoes: data.observacoes ?? null },
        },
      });

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

      // 4. Garantir ativação no SGA via fila com retry (idempotente)
      // force_resync_media=true: o sync inicial roda na aprovação cadastral, ANTES das fotos
      // de vistoria existirem. Sem essa flag, o guard de idempotência pula o reenvio aqui e
      // as fotos NUNCA chegam à Hinova. Reaproveita códigos existentes (busca por CPF/placa).
      await supabase.rpc('enqueue_integration', {
        _integration: 'sga',
        _operation: 'hinova_sync',
        _payload: {
          veiculo_id: data.veiculoId,
          associado_id: data.associadoId,
          status_sga_destino: 'ativo',
          force_resync_media: true,
          etapa_origem: 'aprovacao_monitoramento',
          motivo_decisao: 'Reenvio de fotos pós-vistoria após aprovação do monitoramento',
        },
        _correlation_id: `sga:hinova:${data.veiculoId}:aprovacao_monitoramento:${Date.now()}`,
        _max_attempts: 5,
        _delay_seconds: 0,
        _created_by: profile?.id ?? null,
      });

      // 5. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'protecao_360_aprovada_monitoramento',
        descricao: `Proteção 360 aprovada pelo monitoramento${data.observacoes ? ` — ${data.observacoes}` : ''}`,
        dados_novos: {
          servico_id: data.servicoId,
          veiculo_id: data.veiculoId,
          aprovado_por: profile?.id,
        },
        usuario_id: profile?.id,
      });

      // 6. Enviar notificação de cobertura total ativada
      try {
        const { data: veiculoInfo } = await supabase
          .from('veiculos')
          .select('placa, marca, modelo')
          .eq('id', data.veiculoId)
          .single();

        await supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'cobertura_total_ativada',
            associado_id: data.associadoId,
            dados: {
              placa: veiculoInfo?.placa || '',
              marca: veiculoInfo?.marca || '',
              modelo: veiculoInfo?.modelo || '',
            },
          },
        });
      } catch (err) {
        console.warn('[aprovar-monitoramento] Erro ao notificar (não crítico):', err);
      }

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-campo'] });
      toast.success('Proteção 360 ativada com sucesso! Associado notificado.');
    },
    onError: (error: any) => {
      console.error('Erro ao aprovar instalação:', error);
      const msg = error?.message || error?.error_description || 'Erro ao aprovar instalação';
      toast.error(msg);
    },
  });
}

// ==============================
// Mutation: Reprovar instalação
// ==============================
interface ReprovarData {
  servicoId: string;
  veiculoId: string;
  associadoId: string;
  motivo: string;
}

export function useReprovarInstalacaoMonitoramento() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: ReprovarData) => {
      const agora = new Date().toISOString();

      // 1. Marcar serviço como reprovado
      const { error: servicoError } = await supabase
        .from('servicos')
        .update({
          status: 'reprovada',
          analisado_em: agora,
          analisado_por: profile?.id ?? null,
          motivo_reprovacao: data.motivo,
          observacoes: `Reprovado pelo monitoramento: ${data.motivo}`,
          updated_at: agora,
        } as any)
        .eq('id', data.servicoId);

      if (servicoError) throw servicoError;

      // 2. Refletir reprovação no veículo/associado para a tela pública e impedir ativação
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({
          status: 'recusado',
          cobertura_total: false,
          motivo_recusa_veiculo: `Monitoramento: ${data.motivo}`,
          updated_at: agora,
        })
        .eq('id', data.veiculoId);

      if (veiculoError) throw veiculoError;

      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'recusado',
          updated_at: agora,
        })
        .eq('id', data.associadoId);

      if (associadoError) throw associadoError;

      // 3. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'protecao_360_reprovada_monitoramento',
        descricao: `Proteção 360 reprovada pelo monitoramento — ${data.motivo}`,
        dados_novos: {
          servico_id: data.servicoId,
          veiculo_id: data.veiculoId,
          motivo: data.motivo,
          reprovado_por: profile?.id,
        },
        usuario_id: profile?.id,
      });

      // 4. Cancelar contrato vinculado para impedir cobrança recorrente
      const { data: contratoVinculado } = await supabase
        .from('contratos')
        .select('id')
        .eq('veiculo_id', data.veiculoId)
        .in('status', ['assinado', 'ativo'])
        .maybeSingle();
      if (contratoVinculado?.id) {
        await supabase
          .from('contratos')
          .update({ status: 'cancelado', updated_at: agora })
          .eq('id', contratoVinculado.id);
      }

      // 5. Enfileirar desativação nas integrações (com retry automático)
      const { data: instalacaoConcluida } = await supabase
        .from('instalacoes')
        .select('rastreador_id')
        .eq('veiculo_id', data.veiculoId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (instalacaoConcluida?.rastreador_id) {
        const { data: rastr } = await supabase
          .from('rastreadores')
          .select('imei, plataforma')
          .eq('id', instalacaoConcluida.rastreador_id)
          .maybeSingle();

        if (rastr?.imei) {
          if (rastr.plataforma === 'rede_veiculos') {
            await supabase.rpc('enqueue_integration', {
              _integration: 'rede',
              _operation: 'desvincular_cliente',
              _payload: { imei: rastr.imei, veiculoId: data.veiculoId, associadoId: data.associadoId, motivo: 'reprovacao_monitoramento' },
              _correlation_id: `rede:desvincular:${data.veiculoId}`,
              _max_attempts: 5,
              _delay_seconds: 0,
              _created_by: profile?.id ?? null,
            });
          }
          // Softruck: não há função de desativar mapeada — registrar para revisão
        }
      }

      // SGA: cancelar associado se já estava sincronizado
      const { data: veicSga } = await supabase
        .from('veiculos')
        .select('sincronizado_hinova')
        .eq('id', data.veiculoId)
        .maybeSingle();
      if (veicSga?.sincronizado_hinova) {
        await supabase.rpc('enqueue_integration', {
          _integration: 'sga',
          _operation: 'hinova_sync',
          _payload: { veiculo_id: data.veiculoId, associado_id: data.associadoId, status_sga_destino: 'cancelado', motivo_decisao: `Reprovação monitoramento: ${data.motivo}` },
          _correlation_id: `sga:hinova:${data.veiculoId}:cancelado`,
          _max_attempts: 5,
          _delay_seconds: 0,
          _created_by: profile?.id ?? null,
        });
      }

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-campo'] });
      toast.success('Instalação reprovada. Coordenador será notificado.');
    },
    onError: (error: any) => {
      console.error('Erro ao reprovar instalação:', error);
      const msg = error?.message || error?.error_description || 'Erro ao reprovar instalação';
      toast.error(msg);
    },
  });
}
