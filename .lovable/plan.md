

## Plano: Corrigir datas de vencimento divergentes entre IA e Painel

### Causa raiz

O tool `obter_opcoes_vencimento` está **registrado no schema de ferramentas** (linha 537) e a função `executarObterOpcoesVencimento()` existe (linha 1324), mas **nunca é chamada no dispatch de ferramentas** (linhas 682-761). Quando a IA invoca a ferramenta, ela cai no `else` (linha 759-760) que retorna `"Ferramenta desconhecida"`. A IA então **inventa datas** em vez de usar as corretas.

Resultado: WhatsApp mostra [10, 20] (alucinação) enquanto o painel mostra [15, 20] (correto para dia 14).

### Correção

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

Adicionar o case `obter_opcoes_vencimento` no dispatch, entre `salvar_dados_cliente` e `gerar_relatorio` (após linha 756):

```typescript
} else if (fnName === "obter_opcoes_vencimento") {
  toolResult = executarObterOpcoesVencimento();
  if (toolResult.success) {
    const novoEstado = {
      ...(dadosCotacao || {}),
      etapa: "aguardando_vencimento_resposta",
      opcoes_vencimento: toolResult.opcoes,
    };
    await supabase.from("agente_ia_contatos")
      .update({ dados_cotacao: novoEstado })
      .eq("id", contato.id);
    dadosCotacao = novoEstado;
  }
```

Adicionar reforço no `toolContent` (após linha 770) para impedir alucinação:

```typescript
if (fnName === "obter_opcoes_vencimento" && toolResult?.success) {
  toolContent = `⚠️ DATAS OFICIAIS DE VENCIMENTO - USE APENAS ESTAS, NÃO INVENTE:\n${toolContent}`;
}
```

### Resultado esperado
- A IA usará as datas calculadas corretamente (mesma lógica do painel)
- As opções ficam persistidas em `dadosCotacao.opcoes_vencimento` para reforço no system prompt
- A etapa muda para `aguardando_vencimento_resposta`, exibindo as datas corretas no próximo passo

