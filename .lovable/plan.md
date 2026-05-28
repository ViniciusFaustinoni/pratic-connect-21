## Diagnóstico — placa SRZ2E82 / IMEI 863829079450860

Reconstituí a linha do tempo pelos logs e pela `sga_sync_queue`:

| Hora (UTC) | Etapa | Resultado |
|---|---|---|
| 20:27 | `aprovar-troca-monitoramento` registra aprovação | OK |
| 20:54 | `efetivar-troca-titularidade` roda → SGA Hinova sincroniza, status `efetivada` | **SGA OK** |
| 20:55:25 | Mesmo fluxo tenta o reaponte Softruck (Passo 2 `listar-usuarios-veiculo`) → 400/`includes` inválido (bug do dia) → **enfileira** `sga_sync_queue` linha `72c5faf1` etapa `troca_titularidade:softruck_reaponte_usuario` | **Softruck falhou** |
| 20:58:57 | Retry manual antes do deploy do fix → ainda etapa `listar` errando | falhou |
| 20:59:52 | Retry manual após o fix → DESASSOCIAR + ASSOCIAR → `[SOFTRUCK_TROCA_VINCULO_OK] status=feito` → **Softruck agora correto na plataforma** | OK lógico |
| 21:00 / 21:05 | Cron `cron-softruck-troca-retry` busca pendentes — query retorna 0 (race entre o UPDATE concluido e o select; depois eu reabri) | "nada a processar" |
| 21:09 / 21:10 | Cron tenta novamente o mesmo item → helper lista, acha 0 vínculos antigos do CPF do antigo titular, mas ainda tenta DELETE com `associationId` em cache → Softruck 500 `"Associação entre ativo e usuário não encontrada"` → cron incrementa `tentativas` | **trava em loop** |

### Por que não terminou sozinho

- **A 1ª efetivação original falhou no Softruck** por causa do bug `includes` do `softruck-api` (`query.includes.devices[0] must be one of...`) — esse já foi corrigido no commit anterior, então **trocas novas não vão mais cair na fila por esse motivo**.
- **O retry manual JÁ deixou a Softruck no estado certo** (novo titular vinculado), mas o item da fila não fechou — porque o cron, em execuções subsequentes, **re-executa cegamente DESASSOCIAR mesmo quando a associação antiga já não existe**, recebe 500 "Associação não encontrada" e marca falha.
- Resultado: estado externo correto + fila eternamente pendente até `falha_permanente`.

A raiz é **não-idempotência** do reaponte Softruck, agravada por não haver sondagem do estado real antes/depois.

---

## Plano de correção (4 mudanças cirúrgicas)

### 1. Tornar `executarSoftruckTrocaVinculo` idempotente — `supabase/functions/efetivar-troca-titularidade/index.ts`

Helper canônico, usado tanto pelo fluxo normal quanto pelo `retry_softruck`. Mudanças:

- **Passo 2 (listar)** já vira ponto de verdade: a partir do `listar-usuarios-veiculo` calcular `antigosAssocIds` SOMENTE com os vínculos efetivamente presentes; ignorar qualquer cache anterior. Se `novoJaVinculado=true` e `antigosAssocIds=[]` → `noop` (já existe).
- **Passo 3 (desassociar)**: tratar respostas Softruck `404` e `500` com mensagem que contenha `"Associação"` + `"não encontrada"` (case/acentos-insensitive) como **sucesso lógico** — apenas logar e seguir. Continuar com o próximo `assocId`. Nunca retornar `ok=false` por essa causa.
- **Passo 4 (associar)**: tratar resposta com mensagem `"já"`/`"already"` + `"vinculado"`/`"associated"` como sucesso lógico — após o erro, re-listar e confirmar; se `novoUserId` aparece, retornar `ok:true status:"feito"`.
- Padronizar retorno `{ ok:true, status:"feito" | "noop" | "ja_correto", ... }` para os 3 cenários de sucesso.

### 2. Verificação de estado antes do DELETE no cron — `supabase/functions/cron-softruck-troca-retry/index.ts`

Antes de re-invocar `retry_softruck`, o cron faz um pré-check leve:

- Chama `softruck-api/listar-usuarios-veiculo` com o `vehicleId` do veículo (resolvido pelo mesmo fallback do helper).
- Se o `userId` do novo titular já está na lista E não há vínculo do antigo → marca o item da fila como `concluido` direto, **sem chamar `retry_softruck`**.
- Só invoca `retry_softruck` quando a sondagem confirma divergência.

Isso fecha imediatamente qualquer item órfão como o `72c5faf1`.

### 3. Fechamento garantido no fluxo síncrono — `efetivar-troca-titularidade`

No bloco normal (linhas 1219-1264) e no bloco `retry_softruck` (linhas 415-455), após `res.ok === true`, **sempre** rodar o UPDATE da `sga_sync_queue` com a chave `(origem='troca_titularidade', veiculo_id, associado_id, etapa_parou LIKE 'troca_titularidade:softruck%')`. Hoje o bloco síncrono não limpa a fila (só o `retry_softruck` faz); por isso o item `72c5faf1` nasceu pendente e ficou. Aplicar idempotência: se não havia item, o UPDATE é no-op.

### 4. Saneamento do caso atual (SRZ2E82)

- Marcar manualmente `sga_sync_queue.id = 72c5faf1-7478-4e12-abc9-ab8bd01da004` como `concluido` com observação `[manual] estado Softruck já correto após retry 20:59:52`.
- Rodar o cron uma vez para validar “nada a processar”.
- Validar via `softruck-api/listar-usuarios-veiculo` que o veículo `12BVLr2P6mLaGz8` tem apenas o `userId` do novo titular.

### O que NÃO entra neste plano

- SGA Hinova já está OK nesta troca (`sga_status='sincronizado'`, `sga_codigo_associado_novo=24511`).
- Rede Veículos não se aplica (rastreador está na plataforma `softruck`).
- Não mexer no `aprovar-troca-monitoramento` — ele já chama `efetivar-troca-titularidade` na ordem certa; a falha era 100% dentro do reaponte Softruck.

---

## Resultado esperado

- Trocas novas: Softruck sincroniza no mesmo ciclo da aprovação (bug do `includes` já corrigido).
- Falhas transitórias: cron `*/5min` drena e fecha por sondagem real do estado, sem laço infinito de DELETE.
- Itens órfãos como o atual: fechados na próxima execução do cron, sem intervenção.
- Garantia de "processo concluído integralmente": fluxo síncrono + cron idempotente + sondagem do estado externo.
