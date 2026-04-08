

## Plano: Regra Geral de Filtros — Linha, Plano, Coberturas/Benefícios

### Problema Atual
O motor de cotação em `usePlanosCotacao.ts` (linhas 327-359) aplica uma política "tudo ou nada": se **qualquer** cobertura ou benefício falhar na elegibilidade, o plano inteiro é descartado. Isso está errado.

Além disso, o plano tem regras próprias de elegibilidade (`entity_type = 'plano'`) que podem bloquear planos indevidamente. Segundo a nova regra, planos não devem ter restrições próprias.

### Nova Regra (Hierarquia)

```text
Linha
├── tipo de veículo (carro/moto)
├── ano de fabricação
└── marca/modelo (inclusiva/exclusiva com status)
    → Se NÃO passa → toda a linha é descartada (todos os planos)

Plano
└── SEM restrições próprias
    → Nunca descarta por regra de plano

Coberturas / Benefícios
├── FIPE (min/max + faixas de valor)
├── Região
├── Tipo de Placa
├── Combustível
└── Tipo de Uso
    → Se NÃO passa → remove o item do plano, mas mantém o plano
    → Preço recalculado sem os itens removidos
```

### Mudanças no Código

**Arquivo: `src/hooks/usePlanosCotacao.ts`**

1. **Remover verificação de regras do PLANO** (linhas 321-325)
   - Deletar o bloco que faz `checkAllRules(planoRules, vehicleCtx)` e descarta o plano
   - Planos não terão mais restrições próprias

2. **Mudar coberturas de "bloqueia plano" para "remove item"** (linhas 346-359)
   - Em vez de `planoReprovado = true; break;`, filtrar a cobertura fora da lista
   - Manter o plano, apenas sem aquela cobertura
   - Não somar o valor dessa cobertura no preço

3. **Mudar benefícios de "bloqueia plano" para "remove item"** (linhas 331-344)
   - Mesmo tratamento: filtrar o benefício fora da lista
   - Não somar o valor desse benefício no preço

4. **Alimentar `coberturasRemovidas`** (atualmente sempre `[]` na linha 499)
   - Popular com os nomes dos itens removidos por inelegibilidade
   - Isso permite que o UI mostre quais itens não estão incluídos

5. **Recalcular preço apenas com itens elegíveis**
   - `somaCoberturas` e `somaBeneficios` devem iterar apenas sobre os itens que passaram na elegibilidade
   - Se o plano ficar com 0 itens e preço 0, continuar oculto (comportamento já existente na linha 398)

### Fluxo Revisado (Pseudocódigo)

```text
para cada plano:
  1. Verificar regras da LINHA → se falhar, descartar plano
  2. (sem verificação de regras do plano)
  3. Para cada cobertura:
     - Verificar regras da cobertura (exceto fipe_range)
     - Se falhar → adicionar a coberturasRemovidas, não somar preço
     - Se passar → somar preço normalmente
  4. Para cada benefício:
     - Verificar regras do benefício (exceto fipe_range)
     - Se falhar → adicionar a coberturasRemovidas, não somar preço
     - Se passar → somar preço normalmente
  5. Se valorMensal == 0 → ocultar plano
  6. Montar coberturas[] apenas com os nomes dos itens elegíveis
```

### Arquivos Alterados
- `src/hooks/usePlanosCotacao.ts` — reestruturar lógica de elegibilidade

### Não Alterado
- `useEntityEligibilityRules.ts` — motor de regras permanece igual
- Tabelas do banco — nenhuma migração
- UI dos cards de plano — já suporta `coberturasRemovidas`
- Regras da Linha — lógica já funciona corretamente
- Cadastro de regras no admin

