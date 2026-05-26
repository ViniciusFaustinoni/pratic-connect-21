## Diagnóstico raiz

PostgREST aplica teto **default de 1000 linhas** por resposta. Em catálogos grandes da gestão comercial, qualquer `.select('*')` sem `.range()` corta o resultado silenciosamente. Filtros client-side rodam SÓ no que foi baixado — itens além da posição 1000 viram invisíveis.

**Tamanhos atuais (motivo do bug):**

| Tabela                     | Linhas |
|----------------------------|-------:|
| `coberturas`               |  2.887 |
| `planos_coberturas`        |  2.263 |
| `benefits`                 |  1.777 |
| `planos_beneficios`        |  1.334 |
| `marcas_modelos`           | 12.606 |
| `entity_eligibility_rules` | 21.439 |

O benefício *"Rastreador/Monitoramento - até 30 mil"* fica na linha **1030** alfabética de `benefits` → cai fora do corte → some do modal.

## Pontos afetados na Gestão Comercial

Quatro modais com o mesmo padrão (todos passíveis do bug agora):

1. `src/components/admin/planos/PlanBeneficiosList.tsx` — *Atribuir Benefícios Existentes* (lê `benefits` + `planos_beneficios` do plano)
2. `src/components/admin/planos/PlanCoberturasList.tsx` — *Atribuir Coberturas Existentes* (lê `coberturas` + todos os `planos_coberturas`)
3. `src/components/gestao-comercial/VincularBeneficioModal.tsx` — lê `benefits` + `planos_beneficios` global
4. `src/components/diretoria/VincularCoberturaModal.tsx` — lê `coberturas` + `planos_coberturas` global

Bug secundário nos modais 2/3/4: o cálculo de "já vinculados" usa `planos_coberturas`/`planos_beneficios` sem `.range()` → a lista de ids vinculados também é truncada → itens já vinculados aparecem como disponíveis (e a inserção quebra no UNIQUE).

## Correção canônica

Centralizar o fix num helper único e usar nos 4 modais.

### 1) Helper compartilhado `src/lib/supabase/fetchAll.ts` (novo)
- `fetchAll<T>(builder, pageSize = 1000)` faz paginação por `.range()` até esgotar (`data.length < pageSize`).
- Aceita qualquer `PostgrestFilterBuilder` (`.from(...).select(...).eq(...).order(...)`).
- Retorna `T[]` consolidado. Sempre usa `count: 'exact'` opcional para alarme se cruzar limite muito alto (5 chamadas → log).
- Substitui o padrão `supabase.from(x).select('*')` em catálogos grandes.

### 2) Refatorar os 4 modais
- **PlanBeneficiosList** e **PlanCoberturasList**:
  - `fetchAll` para `benefits`/`coberturas` ativos.
  - `fetchAll` para `planos_beneficios`/`planos_coberturas` (lista de ids).
  - **Busca server-side opcional**: quando `assignSearch` tiver ≥ 2 chars, aplicar `.ilike('name'|'nome', '%termo%')` direto na query para evitar baixar 2k linhas a cada digitação. Debounce 300 ms.
  - Mantém filtro client-side só como complemento.
- **VincularBeneficioModal** / **VincularCoberturaModal**:
  - Mesma troca: `fetchAll` na lista de vínculos globais e no catálogo; `.ilike` server-side com debounce.

### 3) Guard de regressão
- ESLint rule custom simples em `eslint.config.js` ou comentário/marcador no helper: qualquer `from('benefits'|'coberturas'|'planos_coberturas'|'planos_beneficios'|'marcas_modelos'|'entity_eligibility_rules').select(...)` sem `.range(`, `.limit(`, `.eq('id'`, `.in('id'`, `.maybeSingle()`, `.single()` ou `count: 'exact', head: true` deve falhar lint.
- Sem inventar AST complexo: regra grep-based no script `scripts/check-supabase-pagination.ts` rodando em CI como parte do build (lista de tabelas-alvo configurável).

### 4) Memória de projeto
- Criar `mem://logic/data/supabase-default-1000-row-cap` documentando: tabelas-alvo, helper canônico `fetchAll`, e a regra "catálogo grande nunca usa `.select('*')` cru".
- Adicionar entrada Core no `mem://index.md`.

## O que NÃO entra neste loop
- `marcas_modelos` (já usa `.range` paginada em `useMarcasModelos`) — só entra no script de guard.
- `entity_eligibility_rules` — usa sempre `.in('plano_id'/'item_id', ...)` nas leituras; varredura confirma. Guard cobre.
- Telas operacionais (cotação, monitoramento, propostas) — não fazem fetch de catálogo cru, lêem por `id`.

## Verificação (manual + automática)
1. Abrir *Atribuir Benefícios Existentes* em qualquer plano, buscar "rastreador" → "Rastreador/Monitoramento - até 30 mil" aparece e vincula.
2. Buscar termos no fim alfabético (ex.: "vidros", "viagem") nos 4 modais → resultados completos.
3. Tentar vincular item já atribuído a outro plano nos modais globais → deve aparecer como já vinculado (não em "disponíveis").
4. Script `check-supabase-pagination.ts` roda no build e falha se alguém reintroduzir `.select` cru nas tabelas-alvo.

## Risco
Baixo. Sem mudança de schema, sem migração, sem mexer em fluxo de cotação/contrato. Helper é puro client-side. Busca server-side reduz tráfego (hoje baixa 2k+ linhas a cada abertura).
