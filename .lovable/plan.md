## Diagnóstico — por que o motor não chega ao SGA

O número do motor é capturado corretamente no OCR (CRLV/NF) e gravado em `cotacoes.veiculo_motor` pelo fluxo público (`useCotacaoContratacao.ts:483`). O envio ao SGA também está correto: `_shared/hinova-payloads.ts:191` lê `veiculo.numero_motor` e o coloca no payload Hinova.

O elo quebrado está no meio: a edge function **`contrato-gerar`** cria o registro em `public.veiculos` a partir de `cotacao.veiculo_*`, mas **nunca copia `cotacao.veiculo_motor` para `veiculos.numero_motor`**. Isso acontece nas três ramificações de criação de veículo:

- `supabase/functions/contrato-gerar/index.ts` linhas ~516-537 (associado existente por CPF)
- linhas ~642-663 (associado existente por email)
- linhas ~759-790 (novo associado)

Confirmado no banco: dos 10 últimos veículos com `codigo_hinova` preenchido (já sincronizados), **todos têm `numero_motor = NULL`**. Logo, o `sga-hinova-sync` envia `numero_motor: ''` (fallback do `buildVeiculoPayload`).

Causa raiz: omissão do campo no INSERT em `contrato-gerar`, não problema do OCR, do formulário ou do payload Hinova.

## Correção (raiz)

### 1. `supabase/functions/contrato-gerar/index.ts`
Adicionar `numero_motor: cotacao.veiculo_motor || null` nos três `INSERT` em `veiculos` (linhas ~518, ~644, ~761), junto a `chassi`/`renavam`.

### 2. `supabase/functions/aprovar-proposta/index.ts`
Verificar o `update` em `veiculos` (linha 167 e 226) — se a aprovação também monta o veículo a partir da cotação, propagar o mesmo campo. Se o veículo já existir, fazer um update condicional `numero_motor = COALESCE(veiculos.numero_motor, cotacao.veiculo_motor)` para não sobrescrever valor já corrigido manualmente.

### 3. Backfill dos veículos já criados sem motor
Migration única para preencher `veiculos.numero_motor` a partir de `cotacoes.veiculo_motor` quando:
- `veiculos.numero_motor IS NULL`
- existir cotação correspondente (mesmo `associado_id` + mesma `placa` ou mesmo `chassi`) com `veiculo_motor` preenchido

```sql
UPDATE public.veiculos v
SET numero_motor = c.veiculo_motor
FROM public.cotacoes c
WHERE v.numero_motor IS NULL
  AND c.veiculo_motor IS NOT NULL
  AND c.veiculo_motor <> ''
  AND (
    (v.placa = c.veiculo_placa AND v.placa NOT ILIKE '0KM%')
    OR v.chassi = c.veiculo_chassi
  );
```

### 4. Reenfileirar sincronização SGA dos veículos afetados
Após o backfill, marcar os veículos atualizados como pendentes de re-sync para que o `sga-hinova-sync` (rota `/veiculo/alterar`) atualize o `numero_motor` no Hinova. Plano: inserir esses `veiculo_id` em `sga_sync_queue` com action `atualizar_veiculo` (ou usar o mecanismo já existente — confirmar nome exato lendo `sga-hinova-sync` antes de implementar).

### 5. Guarda defensiva no payload (opcional)
Em `_shared/hinova-payloads.ts:191`, manter o fallback `''`, mas **omitir a chave** quando vazio (em vez de mandar string vazia), reduzindo ruído de log e evitando “limpar” o campo num PUT futuro. Confirmar comportamento Hinova antes (provavelmente seguro omitir como já fazemos com `placa` 0KM).

## Validação após deploy

1. Criar uma nova cotação de teste com motor extraído via OCR; confirmar que `veiculos.numero_motor` é preenchido no INSERT.
2. Conferir log de `sga-hinova-sync` (`payloadV` em `cadastrar_veiculo`) — deve conter `numero_motor` não vazio.
3. Rodar o backfill em staging primeiro; medir quantos veículos serão atualizados.
4. Spot-check no SGA Hinova confirmando o campo populado em 2-3 placas.

## Fora de escopo
- Mudanças no fluxo de OCR (já funciona).
- Mudanças no `useCotacaoContratacao` (já grava `veiculo_motor`).
- Mudanças visuais no painel.
