# Plano: troca de titularidade na Hinova via `/alterar/veiculo`

## Problema
Sync atual usa inativação (`alterarSituacaoParaVeiculoHinova` situação 2) para tentar liberar a placa quando ela já existe na Hinova vinculada a outro `codigo_associado`. A Hinova **não** libera o índice de placa via inativação — o vínculo persiste, sync entra em `falha_permanente`, operador tem que mexer no painel SGA.

## Solução
Endpoint oficial `POST /alterar/veiculo` permite trocar o `codigo_associado` vinculado a um `codigo_veiculo` existente, com `transferir_agregados` opcional. É o caminho nativo para troca de titularidade.

## Mudanças

### 1. `supabase/functions/_shared/hinova-client.ts`
Adicionar `alterarVeiculoHinova(supabase, payload)` → `POST /alterar/veiculo` via `hinovaPostAuth`.

### 2. `supabase/functions/sga-hinova-sync/index.ts`
Substituir `tentarAutoInativarVeiculoRemoto` por `tentarTransferirVeiculoRemoto`:

- **Match por placa/chassi do conflito** (não pelo `veiculo_id` da fila):
  buscar `solicitacoes_troca_titularidade` JOIN `veiculos` por placa/chassi em conflito + `status='efetivada'`.
- **Idempotência**: re-consultar `/buscar` por placa/chassi. Se já retornou novo `codigo_associado` = código do novo titular local, pular `alterar/veiculo` e devolver `ok` com `codigoVeiculoHinova` resolvido.
- **Transferir agregados**: parametrizado via `configuracoes.chave='sga_alterar_veiculo_enviar_agregados'` (default `false` = omite). Permite ligar via DB após validação manual sem redeploy.
- Em sucesso, devolver `codigoVeiculoHinova = codVeicRem` para o caller pular o `cadastrarVeiculoHinova` (linha 974).
- Remover sequência de inativar veículo + inativar associado órfão + recheck. Tudo isso vira uma única chamada idempotente.

### 3. `supabase/functions/oneoff-sga-liberar-placa-troca/index.ts`
Reescrever: localiza veículo local + troca efetivada, chama `alterarVeiculoHinova` (com idempotência), reenfileira `sga_sync_queue`, audita.

### 4. `supabase/functions/cron-liberar-placas-presas/index.ts`
**Não confundir** com o cron homônimo que existe (cuida de cotações com `placa_reservada_ate` expirada). Mantemos esse intocado; nossa lógica vai num novo cron `cron-sga-reenfileirar-trocas-presas`:

- Varre `sga_sync_queue` `status='falha_permanente'` com `etapa_parou IN ('conflito_placa','conflito_chassi')`.
- Para cada fila, confirma existência de `solicitacoes_troca_titularidade.efetivada` para aquela placa/chassi (mesmo critério do sync).
- Reenfileira `status='pendente'`, `tentativas=0`, `erro_ultimo=null`, `proximo_reenvio_em=now()`.
- Roda diariamente (não agendamos cron novo agora — só edge sob demanda; o `cron-sga-retry` existente já varre `pendente` e despacha).

### 5. `supabase/functions/oneoff-sga-inativar-veiculo-remoto/index.ts`
Responder **410 Gone** com mensagem orientando o novo fluxo. Arquivo preservado.

### 6. Memória
- Atualizar Core: caminho de troca de titularidade na Hinova passa a ser `/alterar/veiculo`. Placa presa só vira ação manual quando NÃO há troca efetivada local.
- Nova memória `mem://logic/integrations/sga-alterar-veiculo-troca-titularidade` documentando o helper + flag de agregados + idempotência.

## Validações manuais ANTES do rollout
1. **Caso da Bruna**: rodar `oneoff-sga-liberar-placa-troca` com `placa=RFL7J00`, confirmar:
   - `alterarVeiculoHinova` retorna `ok` com mensagem "alterado".
   - `buscarVeiculoPorPlaca('RFL7J00')` passa a devolver `codigo_associado` da Bruna.
   - Log `alterar_vinculo_veiculo success` em `sga_sync_logs`.
2. **Comportamento dos agregados**: rodar manualmente em um veículo COM ao menos 1 agregado:
   - Cenário A (omitir parâmetro): ver se agregados acompanham ou ficam órfãos.
   - Se ficarem órfãos: ligar flag `sga_alterar_veiculo_enviar_agregados=true` E adicionar coleta dos códigos de agregados no payload (TODO se cenário ocorrer).
   - Se acompanharem por default: manter flag `false`.

## Pós-validação
- Reenfileirar manualmente (via SQL ou função `sga-reenfileirar-trocas-presas`) as `sga_sync_queue` em `falha_permanente` com `etapa_parou` em conflito_placa/chassi que tenham troca efetivada local.

## Arquivos
- `supabase/functions/_shared/hinova-client.ts` — adicionar helper
- `supabase/functions/sga-hinova-sync/index.ts` — substituir helper + ajustar caller (linhas 176–301 e 883–968)
- `supabase/functions/oneoff-sga-liberar-placa-troca/index.ts` — reescrever
- `supabase/functions/oneoff-sga-inativar-veiculo-remoto/index.ts` — 410 deprecated
- Memória + Core do projeto

## Fora de escopo
- Não alterar `efetivar-troca-titularidade`.
- Sem migração de schema.
- Não mexer no fluxo de conflito sem troca local — segue `falha_permanente`.
