## Objetivo

Após troca de titularidade efetivada em veículo elegível a rastreador, reaponte o vínculo usuário↔veículo na Softruck: garantir usuário do novo titular, remover `association_user` do antigo e criar do novo. `vehicle_id`, `device_association` e `codigo_veiculo` (Hinova) ficam intocados. Falha não aborta a troca — vai para `sga_sync_queue`.

## Escopo

Único arquivo tocado: `supabase/functions/efetivar-troca-titularidade/index.ts`.

Reaproveita 4 operações já existentes em `softruck-api`:
- `buscar-usuario` (por cpf, fallback email)
- `criar-usuario`
- `listar-usuarios-veiculo`
- `desassociar-usuario-veiculo`
- `associar-usuario-veiculo`

Nada novo em `softruck-api/index.ts`. Nada de Rede Veículos. Rastreador físico (`association_devices`) não é tocado.

## Ponto de inserção

Novo bloco **6.3 (Softruck — reaponte de usuário)**, logo após o bloco existente **6.1 RELIGAR COBERTURA + REAPONTAR RASTREADOR** (linhas 599-658). Esse ponto vem depois da transferência do veículo no banco e antes da etapa SGA do novo titular — alinhado com "após Hinova bem-sucedida" do prompt (a etapa Hinova `alterar veículo` já rodou; `inativar antigo` roda mais adiante e é não-bloqueante igual a este novo bloco, então a ordem entre eles é indiferente).

## Lógica do bloco 6.3

Pré-condições para executar (qualquer falha → pula em silêncio, sem enfileirar):
1. `exigeRastreador === true` (reusa o valor já computado em 6.1 via `fn_veiculo_precisa_rastreador`; vou içar a variável para fora do `try` de 6.1, ou recomputar aqui — recomputar mantém o bloco isolado e auditável).
2. `SELECT softruck_vehicle_id, placa FROM veiculos WHERE id = veiculoId` retorna `softruck_vehicle_id` não-nulo. Sem ele, log info `[SOFTRUCK_TROCA_VINCULO_SEM_VEHICLE_ID]` e sai (veículo nunca foi sincronizado na Softruck).
3. Carrega novo titular: `SELECT nome, cpf, email, telefone FROM associados WHERE id = novoAssociadoId`. Sem CPF e sem email, log warn e sai (não dá pra resolver usuário).

Passos (cada um envolto em try/catch independente para preservar o estado da janela DELETE→POST):

**Passo 1 — Resolver/criar usuário Softruck do novo titular**
- `supabase.functions.invoke('softruck-api', { body: { operation: 'buscar-usuario', data: { cpf } } })`. Se vier vazio e tiver email, repete com `{ email }`.
- Se achou: `novoUserId = items[0].id`.
- Se não achou: `supabase.functions.invoke('softruck-api', { body: { operation: 'criar-usuario', data: { username: emailOuCpf, email, nome, telefone, cpf } } })` e extrai `novoUserId` do retorno.
- Falha aqui → `[FALHA_SOFTRUCK_TROCA_VINCULO]` + enqueue, **return** (não tenta DELETE).

**Passo 2 — Listar vínculos atuais**
- `operation: 'listar-usuarios-veiculo'` com `vehicleId = softruck_vehicle_id`.
- Extrai todos os `association.id` cujo `user.id !== novoUserId` (cobre o caso de múltiplos usuários antigos; em prática é só um).
- Se o `novoUserId` já estiver na lista E nenhum antigo presente, log `[SOFTRUCK_TROCA_VINCULO_NOOP]` e sai com sucesso.
- Falha aqui → `[FALHA_SOFTRUCK_TROCA_VINCULO]` + enqueue, return.

**Passo 3 — Remover vínculo(s) antigo(s)**
- Para cada `associationId` antigo, chama `operation: 'desassociar-usuario-veiculo'`.
- Falha aqui → `[FALHA_SOFTRUCK_TROCA_VINCULO]` + enqueue, return (passo 4 não roda).

**Passo 4 — Criar vínculo novo**
- Só roda se passo 3 OK E `novoUserId` ainda não está vinculado.
- `operation: 'associar-usuario-veiculo'` com `{ userId: novoUserId, vehicleId: softruck_vehicle_id }`.
- Falha aqui → **`[FALHA_SOFTRUCK_RECRIAR_VINCULO]`** (prefixo distinto pedido pelo usuário, janela de inconsistência visível) + enqueue com `etapa_parou='troca_titularidade:softruck_recriar_vinculo'` e `prioridade` mais alta se a coluna existir (caso contrário, prefixo já basta para o operador distinguir).
- Sucesso → log `[SOFTRUCK_TROCA_VINCULO_OK]` + `insertAuditLog` (`acao:'criar'`, módulo `monitoramento`) descrevendo `vehicle_id`, `user_antigo_removido`, `user_novo_vinculado`.

## Enqueue na `sga_sync_queue`

Mesmo padrão do bloco `INATIVAR_ANTIGO` (linhas ~1051):

```ts
await supabase.from('sga_sync_queue').insert({
  associado_id: novoAssociadoId,
  veiculo_id: veiculoId,
  status: 'pendente',
  etapa_parou: 'troca_titularidade:softruck_reaponte_usuario', // ou ':softruck_recriar_vinculo'
  erro_ultimo: msg,
  origem: 'troca_titularidade',
});
```

Comentário `TODO[retry-softruck-troca-vinculo]` no enqueue — `cron-sga-retry` hoje não drena essa etapa; rastreabilidade e ação manual ficam garantidas, retry automático é prompt futuro.

## Hook de teste (mínimo, padrão já estabelecido)

Para permitir teste sem rede, envolver as 4 invocações em:

```ts
const callSoftruck = (globalThis as any).__softruckTrocaVinculoOverride
  ?? ((operation: string, data: unknown) =>
       supabase.functions.invoke('softruck-api', { body: { operation, data } }));
```

Mesmo padrão do `globalThis.__inativarAssociadoHinovaOverride`.

## Validação

Testes Deno em `supabase/functions/efetivar-troca-titularidade/softruck_reaponte_test.ts` com mock do client Supabase e do `callSoftruck`:

- **C1 — Elegível + caminho feliz**: ordem de chamadas = `buscar-usuario(cpf) → listar-usuarios-veiculo → desassociar-usuario-veiculo (antigo) → associar-usuario-veiculo (novo)`; nenhum insert em `sga_sync_queue`; `solicitacao.status === 'efetivada'`.
- **C2 — Não elegível** (`fn_veiculo_precisa_rastreador` retorna false): `callSoftruck` **não** é invocado; troca segue normal.
- **C3 — Sem `softruck_vehicle_id`**: nenhuma chamada Softruck; nenhum enqueue; log `[SOFTRUCK_TROCA_VINCULO_SEM_VEHICLE_ID]` registrado.
- **C4 — Falha no passo 1 (criar-usuario)**: `[FALHA_SOFTRUCK_TROCA_VINCULO]` logado; `sga_sync_queue` recebe insert com etapa `softruck_reaponte_usuario`; passos 2-4 não rodam; troca efetivada.
- **C5 — Falha no passo 4 (POST associar)**: passos 1-3 OK, mock falha no 4; `[FALHA_SOFTRUCK_RECRIAR_VINCULO]` logado; enqueue com etapa `softruck_recriar_vinculo`; troca efetivada.
- **C6 — Usuário novo já vinculado e nenhum antigo presente**: passo 2 retorna apenas o `novoUserId`; passos 3 e 4 não rodam; log `[SOFTRUCK_TROCA_VINCULO_NOOP]`; sem enqueue.

Reporto bruto (passou/lista de chamadas/estado final). Se algum cenário não puder rodar por limitação de mock, reporto qual e por quê — sem inventar resultado.

## Memória

Após implementar, atualizar `mem://logic/operations/troca-titularidade-religa-cobertura-e-rastreador` (já é a memória canônica do reaponte pós-troca) adicionando: "Em veículo elegível a rastreador, também reaponta `association_users` na Softruck (buscar/criar user → listar → DELETE antigo → POST novo); falha → `[FALHA_SOFTRUCK_TROCA_VINCULO]` ou `[FALHA_SOFTRUCK_RECRIAR_VINCULO]` (janela DELETE→POST) + `sga_sync_queue` etapa `softruck_reaponte_usuario`/`softruck_recriar_vinculo` (consumo pelo cron pendente)."

## Decisões pendentes antes de implementar

1. **`enterpriseId` no `criar-usuario`**: a operação já tem fallback para `getEnterpriseId()` interno do `softruck-api`. Confirma que esse default é o correto para clientes novos da troca, ou precisa passar um enterprise específico?
2. **`username` na criação**: vou usar `email || cpf` como base (op já sanitiza). OK?
3. **Suporte a retry no cron**: implemento só o enqueue agora (rastreabilidade) e deixo `TODO[retry-softruck-troca-vinculo]`, como já fizemos com `inativar_associado_antigo`. Se quiser drenagem automática nesta mesma rodada, me avise antes de aprovar.