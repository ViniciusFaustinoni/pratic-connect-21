

## Plano: Corrigir motor de cotação do Agente IA + análise completa da conversa

### Recriação da Conversa (Vinicius Faustinoni - 15/04/2026)

**Contexto:** Contato resetado em 14/04 às 20:18. Nova conversa iniciada após o reset.

| # | Hora | Direção | Mensagem |
|---|------|---------|----------|
| 1 | 20:21 | IA → | Olá! Sou o Vinicius... consigo liberar a ADESÃO TOTALMENTE GRATUITA... informe a placa do seu veículo. |
| 2 | 20:21 | IA → | Localizei os dados: Toyota Corolla Xei Flex, ano 2013/2014. O veículo é usado para aplicativo? Em qual região? |
| 3 | ~09:55 | Lead → | RJ particular |
| 4 | 09:56 | IA → | (Internamente: `calcular_cotacao` FIPE=72122 regiao=rj combustivel=flex. **Retornou 0 planos.**) "Vou preparar sua cotação... Adesão GRATUITA! Informe nome e e-mail." |
| 5 | ~09:56 | Lead → | Vinícius Faustinoni / viniciusfaustinoni@gmail.com |
| 6 | 09:56 | IA → | (salvar_dados_cliente + obter_opcoes_vencimento → [20,25]) "Qual dia de vencimento: 20 ou 25?" |
| 7 | ~09:56 | Lead → | 20 |
| 8 | 09:56 | IA → | (registrar_cotacao → cotação criada com `planos_comparacao: []`) "Sua cotação está pronta!" |
| 9 | 09:57 | IA → | "📦 **0 opção(ões) de plano disponíveis**" + link da cotação |
| 10 | 09:57 | IA → | "Pode conferir todos os detalhes e valores dos planos pelo link..." |

### Problemas Identificados

**1. BUG CRÍTICO: Motor de cotação do agente retorna 0 planos**

A raiz do problema está na função `checkAllRulesServer()` no edge function. O **frontend** separa a avaliação de `marca_modelo` e `ano_range` da verificação principal da linha, mas o **edge function não faz isso**.

Fluxo no **frontend** (`usePlanosCotacao.ts`, linhas 288-318):
```
1. Remove regras marca_modelo e ano_range das linhaRules
2. Avalia as linhaRules restantes com checkAllRules()
3. Avalia marca_modelo separadamente com findModelEligibility()
   → Se retorna null (modelo não listado), NÃO bloqueia
   → Só bloqueia se status === 'negado'
```

Fluxo no **edge function** (`index.ts`, linhas 1218-1225):
```
1. NÃO remove marca_modelo/ano_range das linhaRules
2. Avalia TODAS as linhaRules com checkAllRulesServer()
   → marca_modelo include rule: findModelEligibilityServer retorna null
   → null → !isInclude → false → BLOQUEIA A LINHA INTEIRA
```

Para Toyota Corolla 2014:
- A linha ESPECIAL tem uma regra `marca_modelo include` que lista Corolla com `ano_max: 2004`. O modelo 2014 não encontra match → `null` → bloqueado
- A linha SELECT não tem regra `marca_modelo` na linha, então deveria passar. Mas os planos SELECT têm regras próprias de `regiao`, `tipo_uso`, `combustivel` que são avaliadas corretamente

O problema concreto: a linha ESPECIAL bloqueia indevidamente o Corolla 2014 porque trata "modelo não listado" como "negado", quando deveria tratar como "aceito" (o modelo está na faixa de ano geral da linha).

**2. Agente não passou `ano` para calcular_cotacao**

O tool call enviou `{"combustivel":"flex","modelo":"Corolla Xei Flex","regiao":"rj","marca":"Toyota","placa":"LTB4J74","uso_app":false,"valor_fipe":72122}` — sem `ano`. O código faz fallback para `new Date().getFullYear()` = 2026, mas isso não é o ano correto do veículo (2014). Embora neste caso não cause o bug principal, pode afetar regras de `ano_range`.

**3. Agente prosseguiu com cotação mesmo com 0 planos**

Quando `calcular_cotacao` retornou `success: false`, o agente deveria ter informado o lead e NÃO prosseguido para pedir nome/email/vencimento. Mas o estado foi salvo como `aguardando_vencimento` no handler (linhas 702-714), e o fluxo continuou normalmente. A IA narrou "vou preparar sua cotação" ignorando o erro.

**4. Cotação registrada com `planos_comparacao: []`**

A cotação foi criada e o link enviado, mas sem nenhum plano. O lead abre o link e não vê nada útil.

### Correções Necessárias

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

**Correção 1 — Alinhar checkAllRulesServer com o frontend (CRÍTICA)**

Na função `executarCalculoCotacao`, antes de chamar `checkAllRulesServer(linhaRules, vehicleCtx)`, filtrar regras de `marca_modelo` e `ano_range` da mesma forma que o frontend faz:

```typescript
// Antes de avaliar linhaRules:
const planoHasMarcaModelo = planoRules.some(r => r.rule_type === 'marca_modelo');
const planoHasAnoRange = planoRules.some(r => r.rule_type === 'ano_range');

let linhaRulesFiltered = linhaRules;
if (planoHasMarcaModelo) {
  linhaRulesFiltered = linhaRulesFiltered.filter(r => r.rule_type !== 'marca_modelo');
}
if (planoHasAnoRange) {
  linhaRulesFiltered = linhaRulesFiltered.filter(r => r.rule_type !== 'ano_range');
}

// Avaliar regras genéricas da linha (sem marca_modelo)
if (!checkAllRulesServer(linhaRulesFiltered, vehicleCtx)) continue;

// Avaliar marca_modelo separadamente (se não sobrescrita pelo plano)
if (!planoHasMarcaModelo) {
  const linhaMarcaModeloRule = linhaRules.find(r => r.rule_type === 'marca_modelo');
  if (linhaMarcaModeloRule) {
    const match = findModelEligibilityServer(linhaMarcaModeloRule.rule_config, vehicleCtx);
    if (match && match.status === 'negado') continue; // Só bloqueia se explicitamente negado
    // null = modelo não listado = aceito (passa pela regra geral de ano)
  }
}
```

**Correção 2 — Forçar `ano` no tool call de calcular_cotacao**

Quando `calcular_cotacao` é chamada, fazer merge com o `ano` do `dadosCotacao` (que foi persistido pela `consultar_placa`):

```typescript
} else if (fnName === "calcular_cotacao") {
  // Merge ano do estado se a IA não passou
  if (!args.ano && dadosCotacao?.ano) args.ano = dadosCotacao.ano;
  toolResult = await executarCalculoCotacao(supabase, args);
```

**Correção 3 — Bloquear fluxo quando 0 planos**

Quando `calcular_cotacao` retorna `success: false`, NÃO atualizar o estado para `aguardando_vencimento`. Manter o estado atual e deixar a IA informar o lead:

```typescript
} else if (fnName === "calcular_cotacao") {
  if (!args.ano && dadosCotacao?.ano) args.ano = dadosCotacao.ano;
  toolResult = await executarCalculoCotacao(supabase, args);
  if (toolResult.success && toolResult.planos?.length > 0) {
    // Só avança se encontrou planos
    const novoEstado = { ... };
    await supabase.from("agente_ia_contatos").update({ dados_cotacao: novoEstado }).eq("id", contato.id);
    dadosCotacao = novoEstado;
  }
  // Se não achou planos, toolResult já contém mensagem de erro — IA deve reagir
}
```

**Correção 4 — Incluir `ano` como required no tool schema**

Na definição da tool `calcular_cotacao`, adicionar `ano` ao array `required`:
```typescript
required: ["valor_fipe", "regiao", "ano"],
```

**Redeploy:** `agente-consultor-ia`

### Resultado Esperado

- Toyota Corolla 2014 (FIPE R$ 72.122) em RJ deve retornar os planos SELECT (Basic, Exclusive, One) que são os mesmos mostrados pelo painel
- A IA não prossegue com pedido de nome/email/vencimento se não houver planos
- O campo `ano` é sempre passado corretamente para o motor de cotação
- Paridade total entre o motor do frontend e do agente IA

