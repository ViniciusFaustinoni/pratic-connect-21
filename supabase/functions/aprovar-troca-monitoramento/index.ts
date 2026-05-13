// Aprovação do Monitoramento: aprova direto, solicita vistoria (com modalidade)
// ou agenda manutenção de rastreador antes da aprovação final.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendMetaTemplate } from '../_shared/send-meta-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Acao = 'aprovar' | 'solicitar_vistoria' | 'agendar_manutencao';
type TipoVistoriaTroca = 'somente_fotos' | 'fotos_com_rastreador';

interface Body {
  solicitacao_id: string;
  acao: Acao;
  observacao?: string | null;
  // solicitar_vistoria
  tipo_vistoria_troca?: TipoVistoriaTroca;
  // agendar_manutencao
  manutencao?: {
    rastreador_id: string;
    data_agendada: string;        // YYYY-MM-DD
    periodo: 'manha' | 'tarde';
    motivo?: string;
    endereco: {
      logradouro: string;
      numero?: string | null;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
      latitude?: number | null;
      longitude?: number | null;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const { solicitacao_id, acao, observacao } = body;
    if (!solicitacao_id || !['aprovar', 'solicitar_vistoria', 'agendar_manutencao'].includes(acao)) {
      return new Response(JSON.stringify({ error: 'parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (acao === 'solicitar_vistoria' && !['somente_fotos', 'fotos_com_rastreador'].includes(String(body.tipo_vistoria_troca))) {
      return new Response(JSON.stringify({ error: 'tipo_vistoria_troca inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (acao === 'agendar_manutencao' && (!body.manutencao?.rastreador_id || !body.manutencao?.data_agendada || !body.manutencao?.periodo)) {
      return new Response(JSON.stringify({ error: 'dados de manutenção incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader }}});
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const profileId = profile?.id || null;

    const { data: solicitacao, error: getErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, veiculo_id, associado_antigo_id, novo_associado_id, novo_titular_dados, cotacao_id, status')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (getErr || !solicitacao) throw new Error('Solicitação não encontrada');
    if (solicitacao.status === 'expirada') {
      throw new Error('Solicitação expirada — não é mais possível agir.');
    }
    if (acao === 'solicitar_vistoria' && solicitacao.status !== 'aguardando_monitoramento') {
      throw new Error('Solicitação não está aguardando monitoramento');
    }
    if (acao === 'agendar_manutencao' && solicitacao.status !== 'aguardando_monitoramento') {
      throw new Error('Manutenção só pode ser agendada com a solicitação em aguardando monitoramento');
    }
    if (acao === 'aprovar' && !['aguardando_monitoramento', 'aguardando_vistoria', 'aguardando_manutencao'].includes(solicitacao.status as string)) {
      throw new Error(`Solicitação no status "${solicitacao.status}" não pode ser aprovada`);
    }

    const baseUpdate = {
      aprovado_monitoramento_por: profileId,
      aprovado_monitoramento_em: new Date().toISOString(),
      observacao_monitoramento: observacao || null,
    };

    // ── helper de notificação ─────────────────────────────────────────────
    const notificarTroca = async (templateName: string, params: string[]) => {
      try {
        const novoTit = (solicitacao.novo_titular_dados || {}) as any;
        const [{ data: assoc }] = await Promise.all([
          solicitacao.associado_antigo_id
            ? admin.from('associados').select('nome, telefone').eq('id', solicitacao.associado_antigo_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (assoc?.telefone) {
          await sendMetaTemplate({
            supabase: admin,
            telefone: assoc.telefone,
            templateName,
            templateParams: params,
            referenciaTipo: 'troca_titularidade',
            referenciaId: solicitacao_id,
            tag: '[aprovar-troca-monitoramento:antigo]',
          });
        }
        if (novoTit?.telefone) {
          await sendMetaTemplate({
            supabase: admin,
            telefone: novoTit.telefone,
            templateName,
            templateParams: params,
            referenciaTipo: 'troca_titularidade',
            referenciaId: solicitacao_id,
            tag: '[aprovar-troca-monitoramento:novo]',
          });
        }
      } catch (waErr) {
        console.warn('[aprovar-troca-monitoramento] whatsapp falhou (não bloqueante):', waErr);
      }
    };

    if (acao === 'aprovar') {
      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({ ...baseUpdate, status: 'liberada_para_assinatura' })
        .eq('id', solicitacao_id);
      if (error) throw error;

      // Ativação + efetivação (mesmo fluxo já existente)
      if (solicitacao.novo_associado_id) {
        try {
          let contratoNovoId: string | null = null;
          if (solicitacao.cotacao_id) {
            const { data: contratoNovo } = await admin
              .from('contratos')
              .select('id')
              .eq('cotacao_id', solicitacao.cotacao_id)
              .eq('associado_id', solicitacao.novo_associado_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            contratoNovoId = contratoNovo?.id || null;
          }
          await fetch(`${SUPABASE_URL}/functions/v1/ativar-associado`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              associado_id: solicitacao.novo_associado_id,
              contrato_id: contratoNovoId,
              cotacao_id: solicitacao.cotacao_id,
              source: 'edge:aprovar-troca-monitoramento',
              actor_id: profileId,
              allowed_from: ['assinado', 'aguardando_instalacao', 'pendente'],
              metadata: { solicitacao_troca_id: solicitacao_id },
            }),
          });
        } catch (ativErr) {
          console.error('[aprovar-troca-monitoramento] erro ao ativar novo associado:', ativErr);
        }
      }

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/efetivar-troca-titularidade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ solicitacao_id, cenario_override: 'B' }),
        });
      } catch (efetErr) {
        console.error('[aprovar-troca-monitoramento] erro ao efetivar troca:', efetErr);
      }
    } else if (acao === 'solicitar_vistoria') {
      // Persiste a modalidade da vistoria escolhida pelo monitoramento e
      // muda a solicitação para aguardando_vistoria. A vistoria em si é
      // executada pelo NOVO titular pelo link público (autovistoria).
      const tipo = body.tipo_vistoria_troca!;
      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          ...baseUpdate,
          status: 'aguardando_vistoria',
          tipo_vistoria_troca: tipo,
          instalar_rastreador: tipo === 'fotos_com_rastreador',
        })
        .eq('id', solicitacao_id);
      if (error) throw error;

      const tipoLabel = tipo === 'fotos_com_rastreador' ? 'Fotos + instalação de rastreador' : 'Somente fotos';
      await notificarTroca('troca_vistoria_agendada', [tipoLabel]);
    } else if (acao === 'agendar_manutencao') {
      // Cria serviço de campo (vistoria_manutencao) com endereço informado.
      const m = body.manutencao!;
      const { data: rast, error: rErr } = await admin
        .from('rastreadores')
        .select('id, codigo, veiculo_id')
        .eq('id', m.rastreador_id)
        .maybeSingle();
      if (rErr || !rast) throw new Error('Rastreador não encontrado');

      // Atualiza status do rastreador para manutenção (alinhado com useCriarManutencao)
      await admin
        .from('rastreadores')
        .update({ status: 'manutencao', updated_at: new Date().toISOString() })
        .eq('id', m.rastreador_id);

      await admin.from('estoque_movimentacoes').insert({
        tipo: 'alteracao_status',
        quantidade: 1,
        status_anterior: 'instalado',
        status_novo: 'manutencao',
        rastreador_id: m.rastreador_id,
        observacoes: m.motivo || 'Manutenção agendada na troca de titularidade',
      });

      const { data: servico, error: sErr } = await admin
        .from('servicos')
        .insert({
          tipo: 'vistoria_manutencao',
          status: 'pendente',
          data_agendada: m.data_agendada,
          periodo: m.periodo,
          rastreador_id: m.rastreador_id,
          veiculo_id: rast.veiculo_id || solicitacao.veiculo_id,
          associado_id: solicitacao.associado_antigo_id,
          local_vistoria: 'cliente',
          observacoes: m.motivo || `Manutenção solicitada pelo monitoramento (troca ${solicitacao_id})`,
          permite_encaixe: true,
          logradouro: m.endereco.logradouro,
          numero: m.endereco.numero || null,
          bairro: m.endereco.bairro,
          cidade: m.endereco.cidade,
          uf: m.endereco.uf,
          cep: m.endereco.cep,
          latitude: m.endereco.latitude || null,
          longitude: m.endereco.longitude || null,
        })
        .select('id')
        .single();
      if (sErr) throw sErr;

      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          ...baseUpdate,
          status: 'aguardando_manutencao',
          tipo_vistoria_troca: 'manutencao',
          servico_manutencao_id: servico.id,
        })
        .eq('id', solicitacao_id);
      if (error) throw error;

      await notificarTroca('troca_manutencao_agendada', [
        new Date(m.data_agendada).toLocaleDateString('pt-BR'),
        m.periodo === 'manha' ? 'manhã' : 'tarde',
      ]);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
