# ERRO 09 — Detecção moto/carro duplicada em 4 lugares

## Diagnóstico atual

A detecção já está **parcialmente** centralizada no banco: `fn_veiculo_precisa_rastreador(_veiculo_id)` (migration `20260523145659`) usa a sequência canônica **`marcas_modelos.tipo_veiculo` → `configuracoes.marcas_exclusivas_moto` → regex de keywords no modelo**. Edge `aprovar-proposta` já delega a decisão de rastreador a essa RPC e o comentário interno avisa: *"marcas_exclusivas_moto NÃO é mais lida aqui"*.

O problema residual é que **a classificação moto/carro em si** (não só a decisão de rastreador) continua duplicada para os casos em que o veículo ainda **não tem id** (cotação em digitação, link público, autovistoria, calculadora de preço) ou quando o consumidor é frontend puro:

| # | Arquivo | O que faz | Fonte |
|---|---|---|---|
| 1 | `src/data/vistoriaConfigCompleta.ts` | `MOTO_KEYWORDS` (~70 palavras) + `detectarTipoVeiculo(api, modelo, marca)` | Local |
| 2 | `src/hooks/useDetectarTipoVeiculo.ts` | Lê `configuracoes.marcas_exclusivas_moto` + cataloga em `marcas_modelos` + fallback keywords | DB parcial |
| 3 | `src/pages/public/CotacaoContratacao.tsx` | `detectarTipoVeiculoDaCotacao` reusa o de #1 + fallback por `categoria`/`veiculo_categoria` | Local |
| 4 | `supabase/functions/contrato-gerar/index.ts` | `MOTO_MODEL_KEYWORDS` (subset) + leitura de `marcas_exclusivas_moto` + `MOTO_BRANDS` interno | Híbrido |
| 5 | `supabase/functions/aprovar-proposta/index.ts` | Já delegou para a RPC, mas ainda tem heurística `tipoVeiculo.includes('moto')` para o snapshot (linha 819) | Misto |
| – | `src/hooks/useSolicitarVistoriaTecnico.ts`, `CalculadoraPreco.tsx`, `PrestadorInstalacao.tsx`, `VistoriaPrestador.tsx`, `VistoriaPublica.tsx`, `InstaladorChecklist.tsx`, `ExecutarVistoriaCompleta.tsx`, `useAprovacaoMonitoramento.ts`, `PropostaDetalhesTabs.tsx` | Consumidores de `detectarTipoVeiculo` de #1 (síncrono, sem id) | Local |

Resultado: para adicionar uma marca como CFMoto/Dafra hoje, o operador precisa editar **`vistoriaConfigCompleta.ts` + `contrato-gerar/index.ts`** e ainda esperar que `configuracoes.marcas_exclusivas_moto` cubra os casos novos.

## Estratégia

Promover a **mesma sequência canônica** (catálogo → marcas exclusivas → keywords) para uma RPC que aceita `(marca, modelo)` em texto — não exige `veiculo_id`. Toda a app passa a consultar essa fonte única; a lista de keywords no frontend vira **só fallback síncrono offline** (link público sem rede, primeira renderização).

Não tocar em `fn_veiculo_precisa_rastreador` — ela continua sendo a autoridade quando há `veiculo_id` e já está testada em triggers/edges.

## Mudanças

### 1. Banco — RPC nova `fn_detectar_tipo_veiculo(marca text, modelo text) returns text`

Migration nova, função `STABLE SECURITY DEFINER`, mesma sequência da `fn_veiculo_precisa_rastreador` (passos 2 + 3a + 3b extraídos), retorna `'moto'` ou `'carro'`. Refatorar `fn_veiculo_precisa_rastreador` para chamar a nova RPC internamente (passo 2/3 viram `IF fn_detectar_tipo_veiculo(v_marca, v_modelo) = 'moto' THEN v_is_moto := true`), preservando comportamento e regex existente.

`GRANT EXECUTE ON FUNCTION ... TO anon, authenticated, service_role` para o frontend público poder chamar via `supabase.rpc`.

### 2. Frontend — hook único `useDetectarTipoVeiculo`

Reescrever `src/hooks/useDetectarTipoVeiculo.ts` para chamar `supabase.rpc('fn_detectar_tipo_veiculo', { marca, modelo })` quando há marca; manter `staleTime` longo (já tem 10min) por par marca+modelo. Snapshot canônico (`snapshotTipo`) continua vencendo. Fallback síncrono via keywords só quando a RPC falha ou está carregando.

### 3. Frontend — `src/data/vistoriaConfigCompleta.ts`

`MOTO_KEYWORDS` e `detectarTipoVeiculo` ficam, mas com JSDoc `@deprecated FALLBACK SÍNCRONO. Prefira useDetectarTipoVeiculo (consulta DB canônico).` Nenhum import é removido — os consumidores listed na tabela são síncronos por natureza e ficam usando a versão local como fallback aceitável. Em PRs futuras esses sites podem migrar para o hook caso virem assíncronos.

### 4. Edge function `contrato-gerar`

Substituir `MOTO_MODEL_KEYWORDS` + leitura local de `marcas_exclusivas_moto` + `MOTO_BRANDS` por uma chamada `supabaseAdmin.rpc('fn_detectar_tipo_veiculo', { marca, modelo })`. Sanity-check anti-Chevrolet vira parte da RPC (regex extra para marcas "obviamente de carro" — opcional, manter no edge se a regra for sensível a UX).

### 5. Edge function `aprovar-proposta`

A heurística `tipoVeiculo.includes('moto')` da linha 819 (snapshot da autovistoria enxuta) também passa a chamar `fn_detectar_tipo_veiculo` quando `tipoVeiculo` vem nulo/genérico. Resto do arquivo já delega à RPC.

### 6. `CotacaoContratacao.tsx`

`detectarTipoVeiculoDaCotacao` passa a usar `useDetectarTipoVeiculo` (já é React). Preserva fallback por `categoria`/`veiculo_categoria` como `snapshotTipo`.

## Não-objetivos

- Não tocar nas triggers/migrations de `fn_veiculo_precisa_rastreador` além do refactor interno para reusar `fn_detectar_tipo_veiculo`.
- Não remover `MOTO_KEYWORDS` do frontend — vira fallback marcado como deprecated.
- Não tocar nos consumidores síncronos legados (`InstaladorChecklist`, `VistoriaPublica`, etc.) que já são robustos para o uso atual; migrações pontuais quando alguém mexer na tela.
- Não criar tabela `marcas_moto` nova — `configuracoes.marcas_exclusivas_moto` + `marcas_modelos.tipo_veiculo` já cobrem.

## Validação

1. Migration aplicada; `psql` confirma `SELECT fn_detectar_tipo_veiculo('Honda','CG 160')` = `moto` e `('Chevrolet','Onix')` = `carro`.
2. `SELECT fn_veiculo_precisa_rastreador(<id_moto_fipe_8k>)` = `false`, `<id_moto_fipe_12k>` = `true` (paridade com antes).
3. `contrato-gerar` e `aprovar-proposta` sem regressão nos casos de teste existentes (`Marllon KRF8B74`, `ANDERSON/SRZ2E82`).
4. `rg "MOTO_KEYWORDS|MOTO_MODEL_KEYWORDS"` mostra só `vistoriaConfigCompleta.ts` (com banner deprecated) e zero ocorrências em `supabase/functions/`.
5. Hook `useDetectarTipoVeiculo` continua retornando síncronamente para `snapshotTipo` (sem regressão de loading flicker).

## Memória

Atualizar Core memory para apontar `fn_detectar_tipo_veiculo` como fonte canônica (revisar a entrada `[Vehicle detection]` em `mem://logic/operations/vehicle-type-detection-source`).

## Risco

Médio. A RPC nova herda regex/keywords já em produção via `fn_veiculo_precisa_rastreador`, então o blast radius do refactor é controlado. Risco principal: latência extra no `contrato-gerar` (uma RPC a mais). Mitigado por cache de `marcas_modelos.tipo_veiculo` (lookup direto) e regex local na própria RPC.

Aprovado para executar?
