# Correção: liberação manual de modelo não aplica no plano Advanced

## Auditoria de impacto (executada agora)

A auditoria do banco confirmou que o bug de truncamento já contaminou massivamente as regras existentes. Top entradas suspeitas (modelo curto sem espaço que engloba múltiplas variantes):

| Linha | Marca | Modelo gravado | Variantes FIPE englobadas hoje |
|---|---|---|---|
| ESPECIAL / SELECT (todas regiões) | VOLKSWAGEN | GOL | **107** |
| SELECT / ESPECIAL (todas regiões) | FIAT | PALIO | 100 |
| ESPECIAL (todas regiões) | FORD | RANGER | 100 |
| SELECT / ESPECIAL (todas regiões) | CHEVROLET | S10 | 93 |
| SELECT (todas regiões) | TOYOTA | HILUX | 77 |
| FIAT | UNO | 72 | |
| FIAT | STRADA | 64 | |
| MITSUBISHI | PAJERO | 62 | |
| CHEVROLET | CORSA | 60 | |
| FORD | FIESTA | 59 | |
| HYUNDAI | HB20 | 58 | |
| AUDI | A4 | 57 | |
| ... | ... | ... | ... |

São ~150 entradas distintas afetadas em todas as linhas (ADVANCED, SELECT, ESPECIAL, LANÇAMENTO) e todas as regiões (Nacional, SP, Lagos).

**Conclusão da auditoria**: muitas dessas entradas representam efetivamente a intenção original (ex.: "GOL" cobrindo todas as variantes de Gol provavelmente é o desejado pelo Diretor). Por isso, **não é seguro reescrever automaticamente** — o que vou fazer é apenas o que foi aprovado: deduplicar exatas e deixar as decisões de granularidade para o operador via UI.

A query SQL de auditoria fica embutida no comentário da migration para o Diretor poder reexecutar a qualquer momento.

## Implementação

### 1. `src/components/admin/planos/VeiculosAceitosEditor.tsx`

- Substituir linha 93 — preservar nome completo:
  ```ts
  const modeloBase = isWildcard ? '' : modeloSelecionado.trim().toUpperCase();
  ```
- Adicionar validações em `handleAdd` antes do salvamento:
  - **Duplicata exata** (mesma marca + modelo + ano_min + ano_max): bloqueia com `toast.error("Esta combinação já está cadastrada.")` e aborta.
  - **Englobada por existente** (já existe entrada cujo modelo é prefixo do novo, mesma marca, anos compatíveis): mostra `AlertDialog` "Esta entrada já é coberta pela regra '{X}' existente. Deseja adicionar mesmo assim?".
  - **Engloba existentes** (a nova entrada é prefixo de uma ou mais existentes, mesma marca): mostra `AlertDialog` listando as específicas e pergunta "Deseja substituir as entradas mais específicas pela nova entrada genérica?". Se confirmar, faz a remoção das englobadas + adição da nova em uma única chamada `updateRule`.

### 2. `src/hooks/usePlanosCotacao.ts`

Refatoração das linhas 285-328. Justificativa do `checkAllRules` legado existente: ele cobre regras genéricas (ano_range, regiao, etc.) — **deve continuar rodando**, apenas precisamos garantir que `marca_modelo` seja tirada da lista `linhaRules` ANTES de passar pelo `checkAllRules`, e tratar `marca_modelo` separadamente para ambos os modos (`include` e `exclude`).

Comportamento final:

```ts
// Sempre remover marca_modelo de linhaRules antes do checkAllRules genérico
let linhaRules = allEligibilityRules.filter(
  r => r.entity_type === 'linha' && r.entity_id === productLineId && r.is_active
);
const linhaMarcaModeloRule = linhaRules.find(r => r.rule_type === 'marca_modelo');
linhaRules = linhaRules.filter(r => r.rule_type !== 'marca_modelo');
if (planoHasAnoRangeRules) {
  linhaRules = linhaRules.filter(r => r.rule_type !== 'ano_range');
}
if (linhaRules.length > 0 && !checkAllRules(linhaRules, vehicleCtx)) {
  negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '',
    motivo: 'Bloqueado por regra da linha' });
  continue;
}

// marca_modelo da linha: tratamento único e dedicado
if (linhaMarcaModeloRule && !planoHasMarcaModeloRules) {
  const isInclude = linhaMarcaModeloRule.rule_mode === 'include';
  const match = findModelEligibility(linhaMarcaModeloRule, vehicleCtx);
  const veicLabel = `${vehicleCtx.marca || ''} ${vehicleCtx.modelo || ''}`.trim();
  if (isInclude) {
    if (!match) {
      negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '',
        motivo: `Modelo ${veicLabel} não está liberado na linha ${plProductLine?.name || linha}` });
      continue;
    }
    if (match.status === 'negado') {
      negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '',
        motivo: `Modelo ${veicLabel} negado na linha ${plProductLine?.name || linha}` });
      continue;
    }
    linhaElegibilidadeStatus = match.status === 'aceito' ? 'aprovado' : match.status;
    coberturaFipeOverride = match.coberturaFipe;
  } else { // exclude / blacklist
    if (match) {
      negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '',
        motivo: `Modelo ${veicLabel} bloqueado na linha ${plProductLine?.name || linha}` });
      continue;
    }
  }
}
```

### 3. `supabase/migrations/<ts>_dedupe_marca_modelo_rules.sql`

Função plpgsql `dedupe_marca_modelo_rules()` que:

1. Cria tabela de log `entity_eligibility_rules_dedupe_log` (rule_id, original_config jsonb, new_config jsonb, removed_count int, conflicts jsonb, executed_at).
2. Para cada regra ativa `marca_modelo`:
   - `SELECT … FOR UPDATE` na linha.
   - Itera `rule_config->'modelos'`, agrupa por `(marca, modelo, ano_min, ano_max)`.
   - Critério de desempate: se houver status diferentes no mesmo grupo, mantém o mais restritivo na ordem `negado > limitado > aceito`. Se igual, mantém a primeira aparição (estável).
   - Registra conflitos no campo `conflicts` do log.
   - Atualiza `rule_config` com a lista deduplicada.
3. A migration registra a função e a executa uma vez via `SELECT dedupe_marca_modelo_rules();`.
4. Comentário no topo da migration com a query SQL de auditoria de truncamentos prováveis (a mesma usada agora) para o Diretor reexecutar quando quiser.

## Comunicação operacional (passa a constar no plan.md)

Após o deploy, comunicar à equipe:
- Liberações de modelos a partir de agora respeitam o nome completo (`SHI 175` libera apenas SHI 175, não outras variantes).
- Entradas legadas curtas (ex.: `GOL`, `S10`) **continuam funcionando como antes** (englobam todas as variantes que começam com esse prefixo) — não foram alteradas. Para tornar uma delas mais restritiva, o operador precisa removê-la e re-cadastrar a variante específica.
- Se um associado relatar "moto/carro sumiu da cotação", verificar se o modelo está cadastrado com o nome certo na linha correspondente; agora o sistema mostra motivo claro em "Planos negados".

## Arquivos

- `src/components/admin/planos/VeiculosAceitosEditor.tsx` — fix do truncamento + UX duplicatas/englobamento.
- `src/hooks/usePlanosCotacao.ts` — refactor do matching marca_modelo + motivos claros em "negados".
- `supabase/migrations/<ts>_dedupe_marca_modelo_rules.sql` — função+log+execução.

## Validação manual após o deploy

1. Linha ADVANCED → aba Veículos aceitos → remover entradas duplicadas SHINERAY/SHI → adicionar `SHI 175` → confirmar no banco que `modelo === "SHI 175"`.
2. Cotação Rápida: SHINERAY SHI 175 / 2025 / Gasolina + FIPE → planos ADVANCED aparecem.
3. Modelo não liberado (ex.: SHI 100) → aparece em "Planos negados" com motivo `"Modelo SHINERAY SHI 100 não está liberado na linha ADVANCED"`.
4. Tentar cadastrar duplicata exata → bloqueado com toast.
5. Tentar cadastrar entrada englobada por existente → AlertDialog de aviso.
6. Tentar cadastrar entrada que engloba outras → AlertDialog de substituição.
7. Migration: verificar `entity_eligibility_rules_dedupe_log` para conferir o que foi consolidado.
