## Bug: edição de faixas FIPE descarta valores ao alterar min/max/intervalo

### Causa raiz

Em `src/components/gestao-comercial/EligibilityConfigSection.tsx`, o estado `fipeValoresFaixa` é um `Record<number, string>` indexado pela **posição da faixa** (0, 1, 2…), não pelo **range de FIPE**.

Quando o usuário muda o mínimo de 0 para 30.000 (intervalo 5.000), a lista de faixas é recalculada e o índice 0 passa de "0–5k" para "30k–35k". Como os valores continuam atrelados aos índices, o valor que pertencia à faixa 0–5k aparece agora em 30k–35k, e as últimas faixas (índices acima do novo total) somem.

Mesma mecânica afeta `max` (reduz `numFaixas`, perde as últimas) e `intervalo` (recompõe completamente as faixas, índices ficam sem relação com os ranges antigos).

### Correção

Trocar a chave do mapa de valores: em vez de `índice`, usar o **range absoluto** (`de` em reais — `${de}` é suficiente e estável). Assim cada valor fica colado à faixa de FIPE a que pertence; mudar min/max/intervalo não move valor entre faixas.

Regras aplicadas naturalmente pelo novo formato:
- Faixas que permanecem dentro do novo range mantêm o valor original (mesmo `de` → mesma chave).
- Faixas fora do novo range somem da UI; seus valores ficam órfãos no map e **não** são persistidos no save (loop só lê chaves que correspondem às faixas geradas).
- Faixas novas aparecem com valor vazio (chave inexistente → `''`).
- Mudar o intervalo zera as faixas cujos `de` não casam exatamente com a nova grade; faixas cujo `de` coincide com a grade nova preservam valor.

### Arquivo único alterado

`src/components/gestao-comercial/EligibilityConfigSection.tsx`

1. **Tipo do estado** (linha 33): `fipeValoresFaixa: Record<string, string>` — chave passa a ser o `de` em string.
2. **Carregamento de `fipe_range`** (linhas 80–91): substituir o cálculo de `relativeIndex` por `valMap[String(f.de)] = String(f.valor)`.
3. **`useMemo` que monta `faixas`** (linhas 217–230): cada item passa a expor a chave `de` (já existe) — usar `String(f.de)` como chave do map.
4. **Render dos inputs** (linhas 287–305): `value={state.fipeValoresFaixa[String(f.de)] || ''}` e `onChange` grava em `[String(f.de)]`.
5. **Save** (linhas 142–146): no loop, `const de = min + i * intervalo;` → `valor: parseFloat(state.fipeValoresFaixa[String(de)] || '0') || 0`.
6. **Reset ao alternar `variaComFipe`** (linha 259): manter `fipeValoresFaixa: {}` ao desligar (já faz). Ao ligar, manter vazio.
7. **Limpeza opcional (não obrigatória)**: após salvar, poderíamos descartar chaves órfãs do map em memória, mas como o save já só lê as chaves válidas, não há vazamento persistido — manter como está mantém o "undo" quando o usuário aumenta o range de novo na mesma sessão (melhor UX, comportamento esperado pelo enunciado não veta).

### Fora de escopo

- Estrutura de persistência (`entity_eligibility_rules.rule_config.faixas`) permanece igual: array de `{de, ate, valor}`.
- Nenhuma migração de dados — registros antigos continuam compatíveis pois o load passa a indexar pelo `de` real do payload.
- Nenhuma outra tela é afetada (`fipeValoresFaixa` é interno ao componente).

### Validação manual

1. Abrir cobertura com faixas 0–180k preenchidas, alterar mínimo para 30.000 → faixas 30k–35k em diante mantêm valores; faixas removidas somem.
2. Alterar máximo para 80.000 → faixas acima somem; valores restantes intactos.
3. Alterar intervalo de 5.000 para 10.000 → faixas cujo `de` coincide (0, 10k, 20k…) preservam valor; demais ficam vazias.
4. Voltar mínimo de 30.000 para 0 na mesma sessão → faixas 0–30k voltam vazias (esperado: usuário preenche).
5. Salvar e reabrir → valores persistidos batem com o que está na UI.