// Background work compartilhado executado quando o Cadastro da Troca de
// Titularidade é aprovado (manualmente em `aprovar-troca-cadastro` OU
// automaticamente em `vincular-cotacao-troca` quando o termo já está assinado).
//
// Tarefas:
//   1) Snapshot da análise prévia (base local + SGA)
//   2) Atribuição automática do vendedor à cotação (prioridade alta)
//   3) Notificação WhatsApp ao vendedor
//
// Idempotente — pode rodar mais de uma vez sem efeitos colaterais.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface SolicitacaoMin {
  id: string;
  cotacao_id: string | null;
  veiculo_id: string | null;
  criado_por: string | null;
  novo_titular_dados: { nome?: string; cpf?: string } | null;
}

export async function runPosCadastroBackground(admin: SupabaseClient, sol: SolicitacaoMin) {
  const novoTitular = sol.novo_titular_dados || {};
  const cpfNovoLimpo = (novoTitular.cpf || '').replace(/\D/g, '');

  // --- 1) Análise prévia (base local + SGA)
  try {
    const analisePrevia: Record<string, unknown> = { gerado_em: new Date().toISOString() };
    if (cpfNovoLimpo.length === 11) {
      const { data: assocLocal } = await admin
        .from('associados')
        .select('id, nome, cpf, email, telefone, status, created_at')
        .eq('cpf', cpfNovoLimpo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      analisePrevia.base_local = assocLocal
        ? { encontrado: true, associado: assocLocal }
        : { encontrado: false };
      try {
        const { data: sgaResp, error: sgaErr } = await admin.functions.invoke(
          'sga-buscar-associado-completo',
          { body: { cpf: cpfNovoLimpo } },
        );
        if (sgaErr) throw sgaErr;
        analisePrevia.sga = sgaResp ?? { encontrado: false };
      } catch (sgaCatch) {
        analisePrevia.sga = { erro: sgaCatch instanceof Error ? sgaCatch.message : 'falha SGA' };
      }
    } else {
      analisePrevia.base_local = { erro: 'CPF do novo titular inválido/ausente' };
      analisePrevia.sga = { erro: 'CPF do novo titular inválido/ausente' };
    }
    await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        analise_previa_resultado: analisePrevia,
        analise_previa_em: new Date().toISOString(),
      })
      .eq('id', sol.id);
  } catch (anaErr) {
    console.warn('[troca-pos-cadastro-bg] análise prévia falhou:', anaErr);
  }

  // --- 2/3) Vendedor + WhatsApp
  try {
    if (!sol.cotacao_id) return;
    let vendedorAuthUserId: string | null = null;
    let vendedorAtribuido: { profile_id: string; nome: string; telefone: string | null } | null = null;

    if (sol.criado_por) {
      const { data: profCriador } = await admin
        .from('profiles')
        .select('id, user_id, tipo, nome, telefone')
        .eq('user_id', sol.criado_por)
        .maybeSingle();
      if (profCriador && ['vendedor', 'agencia', 'consultor_externo'].includes(profCriador.tipo || '')) {
        vendedorAuthUserId = profCriador.user_id;
        vendedorAtribuido = { profile_id: profCriador.id, nome: profCriador.nome, telefone: profCriador.telefone };
      }
    }

    if (!vendedorAuthUserId && sol.veiculo_id) {
      const { data: contratoAntigo } = await admin
        .from('contratos')
        .select('vendedor_id')
        .eq('veiculo_id', sol.veiculo_id)
        .not('vendedor_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (contratoAntigo?.vendedor_id) {
        const { data: profVend } = await admin
          .from('profiles')
          .select('id, user_id, nome, telefone')
          .eq('id', contratoAntigo.vendedor_id)
          .maybeSingle();
        if (profVend?.user_id) {
          vendedorAuthUserId = profVend.user_id;
          vendedorAtribuido = { profile_id: profVend.id, nome: profVend.nome, telefone: profVend.telefone };
        }
      }
    }

    const { data: cotAtual } = await admin
      .from('cotacoes')
      .select('id, numero, vendedor_id')
      .eq('id', sol.cotacao_id)
      .maybeSingle();

    const updateCot: Record<string, unknown> = {
      prioridade: 'alta',
      origem_troca_titularidade: true,
    };
    if (vendedorAuthUserId && !cotAtual?.vendedor_id) {
      updateCot.vendedor_id = vendedorAuthUserId;
    }
    await admin.from('cotacoes').update(updateCot).eq('id', sol.cotacao_id);

    if (vendedorAtribuido?.telefone) {
      const numero = (cotAtual?.numero || sol.cotacao_id.slice(0, 8)).toString();
      const novoNome = (novoTitular.nome || 'novo titular');
      const primeiroNomeVendedor = (vendedorAtribuido.nome || 'Consultor').trim().split(/\s+/)[0];
      try {
        await admin.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: vendedorAtribuido.telefone,
            mensagem:
              `🔁 *Troca de titularidade — cadastro aprovado*\n\n` +
              `Cotação *${numero}* foi liberada e marcada como *PRIORIDADE ALTA*.\n` +
              `Novo titular: ${novoNome}\n\n` +
              `A placa já está liberada para fechamento. Acesse o sistema para dar continuidade.`,
            template_name: 'sinistro_atualizado',
            template_params: [
              primeiroNomeVendedor,
              `Cotação ${numero} liberada`,
              `Troca de titularidade aprovada (PRIORIDADE ALTA). Novo titular: ${novoNome}. Acesse o sistema para fechamento.`,
            ],
          },
        });
      } catch (waCatch) {
        console.warn('[troca-pos-cadastro-bg] whatsapp falhou:', waCatch);
      }
    }
  } catch (notifErr) {
    console.warn('[troca-pos-cadastro-bg] notificação vendedor falhou:', notifErr);
  }
}

export function runPosCadastroBackgroundFireAndForget(admin: SupabaseClient, sol: SolicitacaoMin) {
  // @ts-ignore - EdgeRuntime global é disponibilizado pelo Supabase Edge
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(runPosCadastroBackground(admin, sol));
  } else {
    runPosCadastroBackground(admin, sol).catch((e) =>
      console.warn('[troca-pos-cadastro-bg] erro:', e),
    );
  }
}
