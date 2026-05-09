## Problema

Ao efetivar uma substituição de veículo de um associado **ativo**, o novo contrato é criado **sem `dia_vencimento`** (campo fica `NULL`). Como a tela de "vencimento" do associado e a régua de cobranças mensais leem o `dia_vencimento` do contrato/associado ativo, o associado passa a aparecer com vencimento diferente (ou cai no fallback `10`) — o vencimento original "muda".

## Causa raiz

Em `supabase/functions/efetivar-substituicao/index.ts` (Step 2.5, linhas ~112-146), o `INSERT` em `contratos` para o novo veículo **não copia** `dia_vencimento` do contrato anterior nem do `associados.dia_vencimento`. Não há trigger que preencha esse campo automaticamente.

Os demais pontos foram verificados e estão corretos:
- `associados.dia_vencimento` **não** é alterado em nenhuma etapa da efetivação.
- `gerar-cobrancas-mensais` usa `associado.dia_vencimento || 10` — então o problema não é no associado, é no novo contrato.

## Correção

Em `efetivar-substituicao` (Step 2.5), ao criar o novo contrato:

1. Buscar o contrato anterior do mesmo associado/veículo antigo (`contratos` filtrado por `associado_id` + `veiculo_id = veiculo_antigo_id`, mais recente).
2. Resolver `diaVencimentoOriginal` em ordem de prioridade:
   - `contratoAnterior.dia_vencimento`
   - `associado.dia_vencimento`
   - fallback `10`
3. Incluir `dia_vencimento: diaVencimentoOriginal` no `INSERT` do novo contrato.

Não mexer em `associados.dia_vencimento` (continua intocado).

## Detalhes técnicos

Arquivo: `supabase/functions/efetivar-substituicao/index.ts`

```ts
// Antes do INSERT do novo contrato
const { data: contratoAnterior } = await supabase
  .from('contratos')
  .select('dia_vencimento')
  .eq('associado_id', substituicao.associado_id)
  .eq('veiculo_id', substituicao.veiculo_antigo_id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

const diaVencimentoOriginal =
  contratoAnterior?.dia_vencimento ??
  associado?.dia_vencimento ??
  10;

// adicionar no insert:
dia_vencimento: diaVencimentoOriginal,
```

## Validação

1. Login como diretor (admin@teste.com).
2. Selecionar associado **ativo** com `dia_vencimento = 15` (por exemplo).
3. Realizar substituição completa até efetivação.
4. Conferir:
   - `associados.dia_vencimento` permanece `15`.
   - Novo `contratos.dia_vencimento` = `15`.
   - Próximo boleto gerado em `gerar-cobrancas-mensais` usa dia `15`.

## Fora de escopo

- Nenhuma mudança de UI.
- Nenhuma migration.
- Erro TS pré-existente em `src/hooks/useManutencaoInterna.ts:184` (TS2589) — herdado de turno anterior; aplicar mesmo padrão `(supabase as any)` se desejar resolver junto.
