

## Plano: Corrigir duplicação de planos que perde regras de elegibilidade

### Problema raiz

A função `applyBulkRuleOverrides` em `src/hooks/usePlansAdmin.ts` (linhas 325-353) usa o campo **`rule_action`** para criar novas regras de override, mas a coluna real na tabela `entity_eligibility_rules` se chama **`rule_mode`**.

Quando o usuário seleciona uma região, tipo de uso ou combustível ao duplicar, o sistema:
1. Filtra as regras clonadas removendo as do tipo sobrescrito
2. Adiciona novas regras com `rule_action: 'include'` (campo inexistente)
3. Insere tudo em batch — **o campo inválido faz a inserção inteira falhar silenciosamente**
4. Resultado: NENHUMA regra é clonada (nem fipe_range, nem região, nada)

Confirmado no banco: "Select One Passeio" tem 37+ regras em suas coberturas. "Select One Passeio - SP" (duplicado) tem **zero**.

### Correção (1 arquivo)

**`src/hooks/usePlansAdmin.ts`** — função `applyBulkRuleOverrides` (linhas 325-353)

Trocar `rule_action: 'include'` por `rule_mode: 'include'` nas 3 ocorrências (regiao, tipoUso, combustivel).

Adicionalmente, adicionar tratamento de erro nos inserts de regras (linhas 433, 439, 497, 577) para logar e lançar erro caso a inserção falhe, evitando falhas silenciosas futuras.

### Resultado
A duplicação de planos clonará corretamente todas as regras de elegibilidade (incluindo fipe_range), e os badges de valor variável aparecerão corretamente no plano duplicado.

