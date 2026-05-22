
# Tipo de veículo derivado da elegibilidade de linhas — congelado na cotação

## Pré-checagem (já validada)

| Slug da linha | `vehicle_type` | Planos ativos |
|---|---|---|
| advanced (+2 cópias) | `motorcycle` | 12 cada |
| proteção-veicular (+ cópias) / especial | `car` | 15–37 |

A Diretoria mantém `vehicle_type` em Gestão Comercial. **Nenhuma** regra `entity_eligibility_rules` precisa mudar — `vehicle_type` é lido direto da linha. Mudanças futuras (nova linha de moto, descontinuar Advanced) refletem automaticamente sem deploy.

## Como derivar o tipo a partir da elegibilidade (sem circularidade)

O cotador hoje filtra planos usando `vehicleCtx.categoriaVeiculo`, que vem de heurística externa — circular. Inverto:

```text
para cada plano ativo:
  rodar checkAllRules IGNORANDO a regra `categoria_veiculo`
  (deixa todas as outras: FIPE, ano, região, marca_modelo, uso, combustível, placa)
  se passou → marcar candidato com vehicle_type da linha do plano
```

Decisão a partir dos candidatos:

| Candidatos | Decisão |
|---|---|
| Só `motorcycle` | `tipo = 'moto'` |
| Só `car` | `tipo = 'carro'` |
| Misto (FIPE/ano cabe nos dois) | **bloqueia** com modal "Confirme: este veículo é carro ou moto?" — escolha do operador vira o tipo |
| Nenhum | **bloqueia** com mensagem "Nenhuma linha de produto elegível para este veículo. Verifique os dados ou contate a Gestão Comercial." |

O caso "misto" é raro porque na prática as faixas FIPE de planos moto (≤ ~R$80k) e carro (≥ ~R$15k) só se sobrepõem em FIPEs intermediárias sem outras restrições. Quando acontece, pedimos confirmação humana — sem heurística silenciosa.

## Arquitetura

```text
src/lib/veiculo/resolverTipoPorElegibilidade.ts   (FONTE ÚNICA)
   resolve({ planos, regras, product_lines, vehicleCtx })
     → { tipo: 'carro'|'moto', motivo: 'unanime_moto'|'unanime_carro'|'operador_resolveu' }
     → ou { bloqueio: 'nenhuma_linha' | 'ambiguo', candidatos }
                  │
                  ▼
   Cotador / CotacaoFormDialog
   - chama resolver no mesmo useMemo que calcula planos
   - se bloqueio='ambiguo' → abre modal "Carro ou Moto?"
   - se bloqueio='nenhuma_linha' → modal bloqueante com link p/ Gestão Comercial
   - tipo segue no estado da cotação; muda quando placa/marca/modelo/FIPE mudar
                  │
                  ▼  (ao salvar cotação)
   cotacoes.tipo_veiculo (NOT NULL via guard) + tipo_veiculo_motivo
                  │
                  ▼
   contrato-gerar copia → contratos.tipo_veiculo
                  │
                  ▼
   Consumidores LEEM (não recomputam):
   1. usePlanosCotacao (origem; segue calculando)
   2. vistoriaConfigCompleta.getFotosByTipoVeiculo ← tipo do snapshot
   3. autentique-create ← contratos.tipo_veiculo (remove fallback "primeira marca")
   4. contrato-gerar ← cotacoes.tipo_veiculo (sem detectarCategoriaVeiculo)
   5. RealizarVistoriaDialog ← contratos.tipo_veiculo
```

## Detalhes técnicos

### Schema
```sql
ALTER TABLE cotacoes
  ADD COLUMN tipo_veiculo text CHECK (tipo_veiculo IN ('carro','moto')),
  ADD COLUMN tipo_veiculo_motivo text;  -- 'unanime_moto'|'unanime_carro'|'operador_resolveu'

ALTER TABLE contratos
  ADD COLUMN tipo_veiculo text CHECK (tipo_veiculo IN ('carro','moto'));
```
Nascem NULL (sem backfill, conforme escopo).

### Guards DB (barreira final)
Trigger BEFORE INSERT/UPDATE em `cotacoes`: quando `status` sai de `rascunho`, exige `tipo_veiculo IS NOT NULL`.
Trigger BEFORE INSERT em `contratos`: exige `tipo_veiculo IS NOT NULL` quando `cotacao_id` aponta para cotação com `tipo_veiculo` preenchido (permite legados sem snapshot continuarem entrando).

### Resolver
- Reaproveita `useAllEligibilityRules`, `checkAllRules`, `findModelEligibility` que já existem em `useEntityEligibilityRules.ts`.
- Adiciona uma flag `ignoreCategoriaVeiculoRule` em `checkAllRules` ou aplica `.filter(r => r.rule_type !== 'categoria_veiculo')` antes da chamada.
- Retorna o conjunto `candidatos: { planoId, vehicleType: 'motorcycle'|'car' }[]` para alimentar o modal de desambiguação.

### Modal de bloqueio
Componente `<BloqueioTipoVeiculoModal>` com dois modos:
- `ambiguo`: lista de "planos compatíveis se for carro" vs "se for moto" + dois botões grandes ("É um carro" / "É uma moto"). Escolha persiste em estado local e dispara recálculo (forçando o `vehicleCtx.categoriaVeiculo`).
- `nenhuma_linha`: mensagem + botão "Abrir Gestão Comercial" → rota das linhas/regras.

Reaproveito no `RealizarVistoriaDialog` para contratos legados sem snapshot (idem fallback).

### Consumidores — diff resumido

| Arquivo | Mudança |
|---|---|
| `src/hooks/useDetectarTipoVeiculo.ts` | Vira wrapper deprecated: se `cotacaoId` for passado, lê snapshot; senão chama resolver de elegibilidade. Remove `marcas_exclusivas_moto`, `MOTO_KEYWORDS`, fallback `'carro'`. |
| `src/hooks/usePlanosCotacao.ts` | `buildVehicleContext` passa a aceitar `categoriaOverride` do resolver/modal em vez de `tipoVeiculo` cego. Exporta `candidatosTipoVeiculo` para o modal. |
| `src/components/cotacoes/CotacaoFormDialog.tsx` + `Cotador.tsx` | Bloqueio do botão "Salvar" enquanto resolver não devolve tipo definido; integra modal de desambiguação; grava `tipo_veiculo` + `tipo_veiculo_motivo` no payload. |
| `src/data/vistoriaConfigCompleta.ts::detectarTipoVeiculo` | Aceita `tipoSnapshot?: 'carro'\|'moto'` como primeiro argumento; quando presente retorna direto, lógica antiga removida. |
| `supabase/functions/contrato-gerar/index.ts` | Lê `cotacoes.tipo_veiculo` e copia. Se ausente (legado), roda resolver server-side; se bloqueio → erro 409. Remove `detectarCategoriaVeiculo`. |
| `supabase/functions/autentique-create/index.ts` | Lê `contratos.tipo_veiculo`. Remove o bloco `.from('marcas_modelos').eq('marca').limit(1)` + fallback "primeira linha". |
| `src/components/.../RealizarVistoriaDialog.tsx` | Lê `contratos.tipo_veiculo`. Para legado ausente, modal de desambiguação. |

Resolver canônico vive em frontend e edge (`src/lib/veiculo/resolverTipoPorElegibilidade.ts` + `supabase/functions/_shared/resolver-tipo-por-elegibilidade.ts`) — mesma assinatura, mesmos critérios, alimentados pelo mesmo SELECT em `entity_eligibility_rules` + `product_lines`.

### Memória
- Atualizar `mem://logic/operations/vehicle-type-detection-source` → "derivado de `product_lines.vehicle_type` via resolver de elegibilidade; congelado em `cotacoes.tipo_veiculo`/`contratos.tipo_veiculo`."
- Substituir `mem://logic/operations/catalogo-marcas-modelos-divergente` (override por keyword some — `marcas_modelos` deixa de ser fonte de tipo).
- Adicionar Core: "Tipo de veículo é decidido pela elegibilidade de linhas (`product_lines.vehicle_type`) na cotação e congelado; consumidores leem, não recomputam."

## Fora deste turno (confirmado pelo usuário)
Backfill, listagem retroativa, correção da Fernanda (HMCZ80) e Luiz Fernando — fora.

## Ordem de execução
1. Migração DB (colunas + guards desativados).
2. Resolver canônico (frontend + edge shared).
3. Refator dos 5 consumidores + modais.
4. Ligar guards DB.
5. Atualizar memórias.
6. Verificar no preview: criar cotação de Honda PCX e de Honda Civic, conferir tipo persistido + modal de ambiguidade se aparecer.
