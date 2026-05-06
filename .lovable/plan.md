## Diagnóstico

A edge function `softruck-ativar-dispositivo` (orquestradora chamada quando um rastreador é ativado) executa hoje 9 passos contra a Softruck:

```text
1. buscar rastreador local
2. buscar veículo local
3. garantir veículo na Softruck (buscar/criar)
4. garantir chip (buscar/criar)
5. garantir device (buscar/criar)
6. associar device ↔ veículo
7. ativar device
8. ativar veículo
8.5 polling de primeira posição
9. atualizar rastreador local + chamar ativar-associado (interno)
```

**Nenhum desses passos cria o usuário (motorista/condutor) na Softruck nem o associa ao veículo.** A edge `softruck-api` já tem suporte às operações `buscar-usuario`, `criar-usuario` e `associar-usuario-veiculo` (linhas 745-984 de `supabase/functions/softruck-api/index.ts`), mas elas **só são invocadas pelo hook `useCriarUsuarioSoftruck` no front (telas administrativas)** — não pela ativação automática. Por isso, todo rastreador vinculado pelo fluxo de instalação fica sem usuário na Softruck.

Confirmação por busca: nenhuma chamada a `criar-usuario` ou `associar-usuario-veiculo` foi encontrada em `softruck-ativar-dispositivo`, `ativar-associado`, `aprovar-proposta` ou `concluir-instalacao-prestador`.

## Correção proposta

Adicionar dois novos passos em `supabase/functions/softruck-ativar-dispositivo/index.ts`, entre o passo 6 (associar device↔veículo) e o passo 7 (ativar device):

### Passo 6.1 — Garantir usuário Softruck do associado
1. Buscar `associados` (já temos `associadoId`) para obter `nome`, `email`, `cpf`, `telefone`, `softruck_user_id` (campo a adicionar se não existir — verificar primeiro com migration leve apenas se ausente).
2. Se `softruck_user_id` já existe → reusar.
3. Senão, chamar `softruck-api/buscar-usuario` por `cpf` (e fallback por `email`).
4. Se não encontrado → chamar `softruck-api/criar-usuario` com `nome`, `email`, `cpf`, `telefone`, `username` derivado do CPF.
5. Persistir o ID retornado em `associados.softruck_user_id`.
6. Em caso de falha → marcar `softruck_integration_status = 'FAILED_USER'` (novo enum value, não bloquear ativação se for erro de duplicidade).

### Passo 6.2 — Associar usuário ao veículo na Softruck
1. Chamar `softruck-api/associar-usuario-veiculo` com `userId` e `vehicleId` (Softruck IDs).
2. Tratar "Already Exists" como sucesso silencioso.
3. Em caso de falha real, logar mas não interromper o fluxo (igual ao tratamento atual de `associar-device-veiculo`).

### Backfill
Script único (executado uma vez via edge function de manutenção) que percorre `rastreadores` com `softruck_integration_status='SUCCESS'` e `plataforma='softruck'`, e para cada um com `associado_id` + `plataforma_veiculo_id` válidos, cria/associa o usuário na Softruck. Isso resolve casos antigos como o do print (RAT-863829070895733 / KRU3077 / EDINO PEIXE LOURENCO).

## Arquivos afetados

- `supabase/functions/softruck-ativar-dispositivo/index.ts` — adicionar passos 6.1 e 6.2; estender enum `IntegrationStatus` com `'FAILED_USER'`.
- (opcional) Migration para coluna `associados.softruck_user_id text` se não existir — confirmar antes de criar.
- (opcional) Nova edge function `softruck-backfill-usuarios` para reprocessar rastreadores antigos.

## Detalhes técnicos

- A operação `criar-usuario` da `softruck-api` exige `username`, `email` e `nome`. Geramos `username = cpf || email_local_part || \`assoc_${associadoId.slice(0,8)}\``.
- A operação `associar-usuario-veiculo` usa `POST /v2/vehicles/associations/users` com `{ user_id, vehicle_id }` (já implementada).
- Reaproveitar o helper `callSoftruckApi` já existente; não há custo adicional de auth porque a softruck-api faz cache/login interno.
- Idempotência garantida: sempre buscar antes de criar; tratar "Already Exists" como sucesso.

Após aprovação, eu implemento + faço deploy + rodo o backfill no caso do EDINO para confirmar.