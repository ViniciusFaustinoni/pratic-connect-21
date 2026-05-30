## Contexto

Cotação LPL1312 (sub-FIPE, FIPE R$ 22.508, carro `<` R$ 30k, status `pagamento_ok`) chegou na etapa de autovistoria completa mas tem **zero fotos** em `cotacoes_vistoria_fotos` e **zero objetos** no bucket. Investigação confirmou:

- Bucket `cotacoes-vistoria` em produção: `public=true`, `file_size_limit=200MB`, `allowed_mime_types` inclui `image/*` + `video/mp4|webm|quicktime` — **OK**.
- RLS de `cotacoes_vistoria_fotos`: política permite `anon` com base em `token_publico` — **OK**.
- Pipeline de upload (`useUploadFotoCotacaoVistoria` → `publicSupabase.storage.upload` → upsert em `cotacoes_vistoria_fotos`) está correto.
- Edge `finalizar-autovistoria-cotacao` **NÃO valida quantidade mínima de fotos nem presença de vídeo** — aceita finalizar com qualquer coisa, inclusive zero.
- Cada tentativa de upload (sucesso ou erro) **não gera log** — impossível distinguir abandono do cliente de falha real.

A causa do caso LPL1312 é compatível com abandono, mas hoje não temos **prova** disso nem **gate de servidor** que garanta que sub-FIPE só conclui com o set obrigatório.

## Objetivo

1. Garantir que uma cotação sub-FIPE só consiga **concluir** quando o set canônico (31 carro / 15 moto + `video_360`) estiver persistido.
2. Gerar **observabilidade** por upload — toda falha vira evento rastreável.
3. Validar com **teste E2E interno** chamando a edge function.

## Plano

### Camada A — Gate no servidor (`finalizar-autovistoria-cotacao`)

Em `supabase/functions/finalizar-autovistoria-cotacao/index.ts`, antes de criar a `vistorias` (linha 170):

- Resolver `veiculoSubFipe` (já feito nas linhas 58–123).
- Resolver `tipoVeiculo` (`carro` / `moto`) a partir de `cotacoes.tipo_veiculo`.
- Se `veiculoSubFipe === true`, importar o adapter canônico `getFotosVistoriaSubFipe` (mover para `_shared` ou replicar o filtro em runtime Deno lendo a config) e calcular a lista de `tipo` esperados.
- Comparar com `fotosArr.map(f => f.tipo)`:
  - Se faltar qualquer `tipo` obrigatório (visivelCliente !== false), retornar HTTP `409` com payload `{ code: 'AUTOVISTORIA_INCOMPLETA', faltantes: string[], esperadas: N, recebidas: M }`.
  - Vídeo (`video_360`) entra na mesma checagem.
- Não alterar comportamento para fluxo ≥FIPE (autovistoria opcional/enxuta segue como hoje).

### Camada B — Auditoria por upload (`useUploadFotoCotacaoVistoria`)

Em `src/hooks/useCotacaoVistoria.ts`:

- No `onError` (linha 228) e no `onSuccess` (linha 225), gravar em `logs_auditoria` via `publicSupabase` com `acao='criar'` + descrição prefixada `[autovistoria_upload]` ou `[autovistoria_upload_falhou]` contendo:
  - `cotacao_id`, `fotoId`, `fileSize`, `mime`, `mensagem` (no erro), `duracaoMs`
- Respeitar a CHECK de 38 valores (memória `logs-auditoria-vigia-universal`) — usar fallback `acao='criar'` + descrição rastreável.
- Sem toast novo (já existe), sem mudança de UX.

### Camada C — Teste E2E interno

Após deploy das mudanças A+B, executar contra a edge real (`supabase--curl_edge_functions`):

1. **Setup**: criar uma cotação sub-FIPE de teste via SQL (placa fake, FIPE R$ 20k, carro) com `token_publico` definido.
2. **Cenário 1 — incompleto**: chamar `finalizar-autovistoria-cotacao` com `{ cotacaoId }` sem nenhuma foto. **Esperado**: `409 AUTOVISTORIA_INCOMPLETA` com `faltantes.length === 32` (31 + vídeo).
3. **Cenário 2 — parcial**: inserir 5 fotos via `publicSupabase` direto (apenas DB, sem storage real). Chamar a edge. **Esperado**: `409` com `faltantes.length === 27`.
4. **Cenário 3 — completo**: popular as 31 fotos + `video_360` em `cotacoes_vistoria_fotos`. Chamar a edge. **Esperado**: `200 success=true`, `vistorias` criada, `vistoria_fotos` com 32 rows copiadas, `servicos` com `tipo='vistoria_entrada'`, `status='em_analise'` (sub-FIPE entra no Cadastro).
5. **Limpeza**: marcar cotação de teste com `_TESTE_E2E_AUTOVISTORIA` no número e remover registros ao fim.

Reportar resultado de cada cenário (status code, payload, contagens no DB).

## Detalhes técnicos

**Arquivos tocados:**
- `supabase/functions/finalizar-autovistoria-cotacao/index.ts` — gate sub-FIPE.
- `src/hooks/useCotacaoVistoria.ts` — auditoria por upload.
- `supabase/functions/_shared/fotosVistoriaSubFipe.ts` (novo) — versão Deno do adapter (apenas a lista de `tipo` esperados por `tipo_veiculo`, sem dependência do front).

**Fora de escopo (sinalizado mas não tocado agora):**
- Fila operacional "autovistoria sub-FIPE parada > 24h" — pode virar tarefa separada.
- Indicador granular no UI de quais fotos faltam (botão "Finalizar" já desabilita até `todasEnviadas`).
- Compressão/retry mais robusto — fluxo atual já comprime + retry de vídeo.

**Riscos:**
- O gate A pode quebrar cotações sub-FIPE **legadas** que ficaram com fotos parciais e estavam para ser finalizadas. Mitigação: filtrar `faltantes` por `categoria !== 'avarias'` (opcional) e checar antes se existem cotações nesse estado.
- Auditoria em `logs_auditoria` aumenta volume — usar amostragem só em erro (sucesso pode ficar de fora se ficar pesado).
