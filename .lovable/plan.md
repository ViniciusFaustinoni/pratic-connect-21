## Diagnóstico

**Associado:** VINICIUS DE ANDRADE BARROS SANTOS — placa HOA1B39 — etapa `veiculo`.

**Sintoma:** `[buscarVeiculoPorPlaca/consultar] Auth recusada (http=401): "Acesso não autorizado. Verifique seu token de acesso"`.

**Não é problema de credencial.** Os logs em `sga_sync_logs` mostram que segundos antes da falha o sistema autenticou com sucesso e até cadastrou o associado:

```
17:00:05  autenticar           success
17:00:15  cadastrar_associado  success     ← reautenticou aqui (token NOVO)
17:00:17  buscar_veiculo_placa ERROR 401   ← usou token VELHO da sessão em cache
```

**Causa raiz (técnica):** A Hinova é stateful — cada `/usuario/autenticar` invalida o token emitido anteriormente. O fluxo `sga-hinova-sync` chama `buscarVeiculoPorPlaca(session, placa)` em `supabase/functions/sga-hinova-sync/index.ts:586` passando uma `session` capturada no início do processamento. Entre essa captura e a chamada, outras operações (busca/cadastro de associado, resolução de plano) podem ter forçado uma reautenticação dentro do helper `withHinovaSession`, gerando um novo `tokenUsuario` e invalidando o que está na variável `session` local.

A função `buscarVeiculoPorPlaca` em `_shared/hinova-client.ts:355` chama `fetch` direto com `authHeaders(s)` — **não passa pelo `withHinovaSession`**, que é justamente o wrapper que faz `invalidateHinovaSession() + retry com força reautenticar` ao receber 401/403. Resultado: o 401 sobe direto, marca veículo como `erro_sincronizacao` e enfileira como falha permanente.

Outras funções no mesmo arquivo têm o mesmo padrão frágil (ex.: `buscarSituacaoFinanceiraVeiculo`).

## Correção

Refatorar `buscarVeiculoPorPlaca` (e funções similares no mesmo arquivo) para usar `withHinovaSession`, aproveitando o retry automático com reautenticação quando o token expira/é invalidado por sessão concorrente.

### Mudanças

1. **`supabase/functions/_shared/hinova-client.ts`**
   - Reescrever `buscarVeiculoPorPlaca` para receber `supabase` + `placa` (em vez de `session, placa`) e fazer ambas as chamadas (`/veiculo/consultar/placa/{placa}` e fallback `/veiculo/buscar/{placa}/placa`) através de `withHinovaSession(supabase, ctx, buildRequest)`. Assim, qualquer 401/403 dispara automaticamente `invalidateHinovaSession()` + reauth + retry.
   - Auditar e aplicar o mesmo tratamento em `buscarSituacaoFinanceiraVeiculo` e quaisquer outras funções que ainda chamem `fetch` direto com `authHeaders(s)` sem retry.

2. **`supabase/functions/sga-hinova-sync/index.ts`**
   - Atualizar a única chamada (`linha 586`) para a nova assinatura: `buscarVeiculoPorPlaca(supabase, placaLimpa)`.
   - Auditar outras chamadas (`sga-buscar-associado-completo`, `sga-testar-boletos-veiculo`, `sga-sync-financeiro-veiculo`, `sga-mapear-codigos-veiculos`) e ajustar assinaturas conforme necessário.

3. **Reprocessar a fila do VINICIUS / HOA1B39** após o deploy:
   - Resetar `status_sga` do veículo `c52c4b7f-d879-4d10-8fe9-68ccacd064eb` para `pendente`.
   - Remover/reativar o item da `sga_sync_queue` correspondente para que o cron `cron-sga-retry` reexecute, ou disparar `sga-hinova-sync` manualmente para esse veículo.

### Por que isso resolve

A Hinova invalida tokens antigos a cada novo login. Ao fazer toda chamada autenticada ir por `withHinovaSession`, qualquer 401 detectado por sessão "morta" é tratado de forma transparente: invalida cache → reautentica → repete a chamada **uma vez**. O usuário deixa de ver erros aleatórios em fluxos que executam múltiplas operações Hinova em sequência (cadastro de associado → busca de veículo → cadastro de veículo → envio de fotos), que é justamente o cenário do VINICIUS.

### Validação após implementação

- Disparar `sga-hinova-sync` para o veículo do VINICIUS e confirmar logs `success` em `buscar_veiculo_placa`, `cadastrar_veiculo`, `enviar_fotos`, `sync_completo`.
- Conferir no card de "Histórico de erros" que tentativas voltaram a contar sucessos.
- Rodar um backfill pequeno (5–10 veículos) para confirmar que não regrediu.
