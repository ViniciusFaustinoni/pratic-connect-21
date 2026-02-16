

# Corrigir Inconsistencias no Calculo da Cota de Coparticipacao

## Situacao Atual

A cota de coparticipacao e calculada em 4 locais diferentes no sistema, com inconsistencias entre eles. Para o caso atual (plano SELECT EXCLUSIVE, veiculo normal), o calculo esta correto e o valor enviado ao Asaas esta correto. Porem, existem falhas que afetarao veiculos de aplicativo.

## Problemas Identificados

### 1. Falta suporte a veiculos de aplicativo em 2 funcoes

As funcoes `processar-termo-evento` e `validar-link-evento` NAO buscam os campos `cota_app_percent`, `cota_app_min` e `uso_aplicativo`. Planos como "SELECT ONE" tem 6% normal e 8% para app -- se o veiculo for de aplicativo, o calculo estara errado nesses locais.

### 2. `processar-termo-evento` nao persiste o valor

A funcao calcula a cota corretamente mas nao salva em `sinistros.valor_cota_participacao`, causando divergencia entre o valor exibido e o armazenado.

### 3. Origem do plano inconsistente

`processar-termo-evento` busca via tabela `contratos`, enquanto as demais usam `associados.plano_id`. A busca via contratos e mais correta (plano ativo do contrato).

## Solucao

### Arquivo 1: `supabase/functions/processar-termo-evento/index.ts`

- Adicionar `cota_app_percent`, `cota_app_min` na query do plano (linha 95)
- Buscar `uso_aplicativo` do veiculo (ja disponivel no select, linha 61)
- Aplicar logica de app: se `veiculo.uso_aplicativo && plano.cota_app_percent`, usar percentual e minimo diferenciados
- Persistir valor calculado em `sinistros.valor_cota_participacao` quando diferente

### Arquivo 2: `supabase/functions/validar-link-evento/index.ts`

- Adicionar `cota_app_percent`, `cota_app_min` na query do plano (linha 88)
- Buscar `uso_aplicativo` do veiculo (ja disponivel na query de sinistro)
- Aplicar mesma logica de calculo diferenciado para app

## Alteracoes Detalhadas

### `processar-termo-evento/index.ts`

```typescript
// Linha 93-96: Adicionar campos do plano
const { data: plano } = await supabase
  .from("planos")
  .select("nome, cota_participacao, cota_minima, cota_app_percent, cota_app_min")
  .eq("id", planoId)
  .single();

// Linha 102-106: Calculo com suporte a app
const valorFipe = veiculo?.valor_fipe || 0;
let percentual = planoInfo?.cota_participacao || 0;
let cotaMinima = planoInfo?.cota_minima || 0;

if (veiculo?.uso_aplicativo && planoInfo?.cota_app_percent) {
  percentual = planoInfo.cota_app_percent;
  cotaMinima = planoInfo.cota_app_min || cotaMinima;
}

valorCota = Math.max(valorFipe * percentual / 100, cotaMinima);

// Apos calcular: persistir no banco
if (valorCota > 0) {
  await supabase
    .from("sinistros")
    .update({ valor_cota_participacao: valorCota })
    .eq("id", sinistro.id);
}
```

### `validar-link-evento/index.ts`

```typescript
// Linha 88: Adicionar campos do plano
const { data: plano } = await supabase
  .from("planos")
  .select("nome, cota_participacao, cota_minima, cota_app_percent, cota_app_min")
  .eq("id", associado.plano_id)
  .single();

// Calculo com suporte a app
if (veiculo?.uso_aplicativo && plano?.cota_app_percent) {
  percentual = plano.cota_app_percent;
  cotaMinima = plano.cota_app_min || cotaMinima;
}
```

## Resultado Esperado

- Veiculos normais: calculo permanece identico (6% FIPE ou minimo)
- Veiculos de aplicativo: calculo usa percentual/minimo diferenciado do plano (ex: 8% / R$ 3.000)
- Valor sempre persistido no banco para consistencia
- Cobranca Asaas sempre reflete o valor correto

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/processar-termo-evento/index.ts` | Adicionar suporte a `cota_app_percent`/`cota_app_min`, buscar `uso_aplicativo`, persistir valor no banco |
| `supabase/functions/validar-link-evento/index.ts` | Adicionar suporte a `cota_app_percent`/`cota_app_min`, buscar `uso_aplicativo` |

