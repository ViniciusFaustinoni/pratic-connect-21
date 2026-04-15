

## Plano: Corrigir bugs restantes na conversa do Agente IA (Vinicius Faustinoni)

### Logs analisados — O que aconteceu

| Hora | Evento | Resultado |
|------|--------|-----------|
| 10:14:45 | `calcular_cotacao` (FIPE=72122, ano=2014, RJ) | ✅ **8 planos encontrados** — fix anterior funcionou |
| 10:14:53 | Estado salvo: `aguardando_vencimento` | ✅ Correto |
| 10:16:21 | IA pede nome+email E já pergunta vencimento "dia 10 ou dia 20" | ❌ **Hallucinou datas** (deveria ser 20 ou 25) |
| 10:16:22 | `obter_opcoes_vencimento` → [20, 25] | ✅ Retornou correto, mas IA já havia oferecido datas erradas |
| 10:16:53 | Lead responde: "viniciusfaustinoni@gmail.com, Meu nome é Vinicius" | — |
| 10:16:58 | IA chama `salvar_dados_cliente` + `registrar_cotacao` na mesma vez | ❌ **Pulou etapa de perguntar vencimento ao cliente** |
| 10:16:58 | 1º `registrar_cotacao` com `planos_calculados` fabricados pela IA | ❌ `uuid "1"` — IA inventou plano_id |
| 10:16:59 | **ERRO**: `invalid input syntax for type uuid: "1"` | ❌ Inserção falhou |
| 10:17:00 | 2º `registrar_cotacao` (retry) sem planos fabricados → merge restaura 8 planos reais | ✅ Cotação criada |

### 3 Bugs Raiz Identificados

**BUG 1 — IA fabrica `planos_calculados` com IDs falsos**

O schema da tool `registrar_cotacao` expõe `planos_calculados` como parâmetro (linhas 567-578). A IA (Gemini) tenta preenchê-lo com dados inventados (ex: `plano_id: "1"`). O merge code (linhas 734-738) só substitui se o array está vazio, mas se a IA passa um array fabricado, ele é usado e causa erro de UUID.

**Correção:** Remover `planos_calculados` do schema da tool e SEMPRE usar os planos do estado (`dadosCotacao.planos_calculados`). A IA não deve ter opção de passar esses dados.

**BUG 2 — IA oferece datas de vencimento sem chamar a tool primeiro**

Na etapa `aguardando_vencimento` (passo 8 do fluxo), a instrução manda pedir nome+email. Mas a IA combina nome+email+vencimento na mesma mensagem, inventando datas ("dia 10 ou dia 20") antes de chamar `obter_opcoes_vencimento`.

**Correção:** Reforçar no prompt que NUNCA deve mencionar datas de vencimento antes de chamar `obter_opcoes_vencimento`. Adicionar instrução explícita na etapa `aguardando_vencimento`: "NÃO pergunte sobre vencimento nesta etapa."

**BUG 3 — IA pula etapas chamando múltiplas tools na mesma vez**

Quando o lead responde com nome+email, a IA chama `salvar_dados_cliente` + `obter_opcoes_vencimento` + `registrar_cotacao` tudo no mesmo turno, pulando a pergunta ao cliente.

**Correção:** Adicionar guardrail no handler: se `fnName === "registrar_cotacao"` e o estado atual NÃO é `aguardando_vencimento_resposta`, rejeitar a chamada com mensagem de erro instruindo a IA a seguir o fluxo.

### Alterações

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

1. **Remover `planos_calculados` do tool schema** (linhas 567-578) — a IA não pode mais passar esse campo. No handler, SEMPRE pegar do estado:
```typescript
// No handler de registrar_cotacao (linha ~723):
mergedArgs.planos_calculados = dadosCotacao?.planos_calculados || [];
// Ignorar qualquer planos_calculados que a IA tenha passado
```

2. **Reforçar prompt na etapa `aguardando_vencimento`** (linha 489):
```typescript
"aguardando_vencimento": `PRÓXIMO PASSO: Peça APENAS o EMAIL e NOME COMPLETO do cliente. NÃO mencione vencimento, NÃO invente datas. Após receber nome e email, CHAME salvar_dados_cliente IMEDIATAMENTE.`,
```

3. **Guardrail para impedir registrar_cotacao fora de ordem** (antes da linha 721):
```typescript
} else if (fnName === "registrar_cotacao") {
  // Guardrail: só permite se o estado atual permite
  const etapaAtual = dadosCotacao?.etapa;
  if (etapaAtual !== "aguardando_vencimento_resposta" && etapaAtual !== "dados_cliente_coletados") {
    toolResult = { 
      success: false, 
      error: "ERRO: Não é possível registrar cotação agora. Siga o fluxo: primeiro salvar_dados_cliente, depois obter_opcoes_vencimento, aguarde a resposta do cliente, e SÓ ENTÃO registre." 
    };
  } else {
    // ... merge + executar normalmente
  }
```

4. **Adicionar instrução anti-hallucination** no prompt principal (após linha 416):
```
REGRA ABSOLUTA SOBRE VENCIMENTO: NUNCA mencione ou sugira datas de vencimento por conta própria.
Você SÓ pode oferecer datas de vencimento APÓS chamar obter_opcoes_vencimento.
Se o cliente perguntar sobre vencimento antes da hora, diga que vai verificar as opções disponíveis.
```

**Redeploy:** `agente-consultor-ia`

### Resultado Esperado

- A IA nunca mais fabrica `planos_calculados` — sempre usa os do estado
- Datas de vencimento são sempre as corretas (da tool `obter_opcoes_vencimento`)
- A IA não pula etapas — cada passo requer a interação correta
- Erro `uuid "1"` eliminado definitivamente

