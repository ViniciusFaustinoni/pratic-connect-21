## Objetivo
Replicar o reaponte de vínculo cliente↔veículo (feito hoje só na Softruck) também na Rede Veículos, com roteamento por fonte (`fonte_rastreador`) dentro do `efetivar-troca-titularidade`.

## Fonte da verdade: `rastreadores.plataforma`
- A coluna já existe (`'softruck' | 'rede_veiculos'`) e está preenchida na base atual (10k+ registros).
- A validação placa↔IMEI do Prompt 4 (`validarImeiPorPlaca`) já devolve `origem: 'softruck' | 'rede_veiculos'`.
- Hoje o `ModalDetalhesTroca` recebe esse `origem` mas só guarda em estado de UI. Vou **persisti-lo** no mesmo `UPDATE rastreadores` que já roda após a validação OK (linhas 125-131 do modal), gravando `plataforma: res.origem`. Sem migração de schema.

## Alterações

### 1. `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
No bloco que já faz `update rastreadores set veiculo_id` após validação OK, incluir `plataforma: res.origem` no mesmo update. Idempotente; só roda quando `res.rastreadorId` é conhecido.

### 2. `supabase/functions/efetivar-troca-titularidade/index.ts` — refatorar bloco 6.3
Após etapa Hinova OK, manter as pré-condições atuais (`fn_veiculo_precisa_rastreador === true`). Mudar a decisão para:

```text
buscar rastreadorAtivo (id, imei, plataforma, associado_id) por (veiculo_id, status='instalado')
se não exige rastreador → log, sair
se exige mas não há rastreador instalado → log, sair
se rastreadorAtivo.plataforma === 'rede_veiculos' → bloco Rede (novo)
senão → bloco Softruck (atual, preservado byte-a-byte)
```

### 3. Novo bloco Rede (espelho do Softruck)
Reaproveita edges existentes; **não** cria HTTP client novo.

- **Passo A — desvincular antigo:**
  `supabase.functions.invoke('rede-veiculos-desvincular-cliente', { body: { rastreadorId: rastreadorAtivo.id, motivo: 'troca_titularidade', atualizarBancoLocal: false } })`
  Falha → `[FALHA_REDE_TROCA_VINCULO] passo=desvincular ...` + enqueue em `sga_sync_queue` (`etapa_parou='troca_titularidade:rede_desvincular_cliente'`) e **retorna** (não tenta vincular).

- **Passo B — vincular novo:**
  `supabase.functions.invoke('rede-veiculos-vincular-cliente', { body: { imei: rastreadorAtivo.imei, veiculoId, associadoId: novoAssociadoId } })`
  Falha → `[FALHA_REDE_REVINCULAR_CLIENTE] ...` (prefixo distinto, janela DELETE→POST) + enqueue com `etapa_parou='troca_titularidade:rede_revincular_cliente'` e `prioridade='alta'` se a coluna existir (mesmo padrão do Softruck).

- **Sucesso:** log `[REDE_TROCA_VINCULO_OK] veiculoId=... imei=... novoAssoc=...` + `insertAuditLog` com `{ origem:'rede_veiculos', imei, veiculo_id, associado_novo }`.

- **Hook de teste:** `globalThis.__redeTrocaVinculoOverride` (paralelo ao Softruck), para futura suíte Deno.
- **TODO[retry-rede-troca-vinculo]** — `cron-sga-retry` ainda não drena essas duas etapas (mesma dívida do Softruck).

### 4. Não-objetivos (não muda nada)
- Bloco Softruck atual (700-880) preservado.
- Regra de elegibilidade (`fn_veiculo_precisa_rastreador`).
- Update local de `rastreadores.associado_id` (linhas 641-655) — continua antes do roteamento.
- Vehicle/device físico: nenhum endpoint que toque equipamento é chamado.
- Veículo não-elegível: nenhuma chamada em nenhuma das fontes.

### 5. Memory & versão
- `mem://logic/operations/troca-titularidade-religa-cobertura-e-rastreador.md` — descrever roteamento por `rastreadores.plataforma` e os dois novos prefixos.
- `public/version.json` → `rede-troca-vinculo`.

## Critério de aceitação (rastreável nos logs)
- Plataforma `softruck` → mesmo comportamento de hoje (Prompt 3).
- Plataforma `rede_veiculos` → 1 DELETE + 1 POST nas edges Rede; antigo perde acesso, novo passa a ver.
- Veículo não elegível → nenhuma chamada Softruck nem Rede.
- IMEI/equipamento intocados em ambas as APIs.
- Falhas geram `[FALHA_REDE_TROCA_VINCULO]` / `[FALHA_REDE_REVINCULAR_CLIENTE]` + linha em `sga_sync_queue`; solicitação permanece `efetivada`.

## Arquivos tocados
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx` (1 linha no update)
- `supabase/functions/efetivar-troca-titularidade/index.ts` (refator do bloco 6.3, ~80 linhas novas para o branch Rede)
- `mem://logic/operations/troca-titularidade-religa-cobertura-e-rastreador.md`
- `public/version.json`
