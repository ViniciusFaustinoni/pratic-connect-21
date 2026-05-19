## Diagnóstico da lógica atual

**O que o `autentique-webhook` faz hoje quando o termo de cancelamento é assinado** (`supabase/functions/autentique-webhook/index.ts`, linhas 303-360):

1. Acha a solicitação pelo `termo_cancelamento_autentique_id`
2. Grava `termo_cancelamento_assinado_em`
3. Muda `status` para `aguardando_cadastro`
4. Marca o veículo `em_troca_titularidade=true` + suspende cobertura

**O que ele NÃO faz e é o bug:** se a solicitação foi criada **sem** `cotacao_id` (caminho padrão do fluxo "cotação on-demand"), o webhook não preenche esse vínculo. O hook público `useSolicitacaoTrocaPublicaPorCotacao` filtra por `cotacao_id`, então a tela do novo titular nunca recebe o gatilho — fica para sempre em "Aguardando o titular anterior assinar".

**Reprodução com o caso KOU6D37:**

| Solicitação | Assinada? | `cotacao_id`? | Resultado |
|---|---|---|---|
| `fa05536d` | ✅ 17:24:14 | ❌ NULL | Webhook fez tudo certo, **mas o link público da cotação não enxerga** |
| `fd102c0e` | ❌ | ✅ `08e38c77` | Existe só porque o operador criou uma segunda tentativa quando a primeira não destravou |

A duplicata só nasceu porque a primeira não destravou. Resolvendo a raiz, ela deixa de existir nos próximos casos.

## Correção (única alteração, na raiz)

### 1. Edge `autentique-webhook` — ao detectar assinatura do termo de cancelamento, garantir vínculo `cotacao_id` ↔ `solicitacao_id`

Imediatamente após o `UPDATE solicitacoes_troca_titularidade SET status='aguardando_cadastro'`, executar:

```ts
// Se a solicitação não tem cotacao_id, tenta achar a cotação canônica
// já criada para essa troca e vinculá-la.
if (!solTroca.cotacao_id) {
  const { data: cotacaoAlvo } = await supabase
    .from('cotacoes')
    .select('id, dados_extras, status_contratacao')
    .eq('origem_troca_titularidade', true)
    .contains('dados_extras', { veiculo_origem_id: solVeic.veiculo_id })
    .not('status_contratacao', 'in', '("cancelada","expirada")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cotacaoAlvo) {
    // 1) Vincular a cotação à solicitação assinada
    await supabase.from('solicitacoes_troca_titularidade')
      .update({ cotacao_id: cotacaoAlvo.id })
      .eq('id', solTroca.id);

    // 2) Atualizar dados_extras.solicitacao_troca_id da cotação para apontar
    //    para a solicitação que de fato foi assinada (consistência com o hook
    //    público quando ele cair no fallback por solicitacao_id).
    const novosExtras = {
      ...(cotacaoAlvo.dados_extras as Record<string, unknown> || {}),
      solicitacao_troca_id: solTroca.id,
    };
    await supabase.from('cotacoes')
      .update({ dados_extras: novosExtras })
      .eq('id', cotacaoAlvo.id);
  }
}
```

Critério da busca: `origem_troca_titularidade=true` + `dados_extras.veiculo_origem_id = veiculo_id` da solicitação + status não terminal. É a chave que une as duas (mesmo veículo em troca, cotação ativa do novo titular).

### 2. Edge `vincular-cotacao-troca` — quando o operador cria a cotação on-demand, escolher a solicitação **assinada** se houver

Mudança análoga e simétrica: se há múltiplas solicitações vivas para o mesmo veículo, dar prioridade para a que já tem `termo_cancelamento_assinado_em` — em vez de pegar a mais recente cegamente. Isso impede que uma criação tardia roube a cotação para uma solicitação não-assinada.

### Por que isso cobre o caso KOU6D37 sem eu mexer nos dados

Hoje o trigger no webhook **já rodou** lá no 17:24:14 e gravou `status=aguardando_cadastro` + assinatura. O que faltou foi o vínculo da cotação. Com a edge corrigida e re-disparada (basta reenviar manualmente o webhook do Autentique para o documento `9a7a02…` pelo painel do Autentique, ou eu chamar a edge `autentique-webhook` com o payload mínimo para reprocessar), `fa05536d` ganha `cotacao_id='08e38c77'` automaticamente e a tela do novo titular avança para "Em análise pelo Cadastro".

A solicitação duplicada `fd102c0e` segue `cancelada` (já está) — não precisa apagar, ela só não participa mais.

## Resultado

- **Próximos casos:** assinatura do termo → webhook vincula cotação → link público avança sozinho. Nenhum operador precisa apertar nada.
- **Caso atual KOU6D37:** após o deploy, basta reenviar o evento de assinatura do Autentique (ou eu rodar uma chamada única à `autentique-webhook` simulando o `signature.accepted` daquele documento) — a própria lógica corrigida vincula a cotação. Sem `UPDATE` direto em registros.

## Arquivos a editar

- `supabase/functions/autentique-webhook/index.ts` — adicionar o bloco de auto-vinculação após o UPDATE de assinatura da troca (~linha 332).
- `supabase/functions/vincular-cotacao-troca/index.ts` — preferir solicitação assinada quando houver ambiguidade.

Nenhuma migração SQL. Nenhuma alteração de schema. Nenhuma alteração de frontend.
