
# Corrigir Calculo da Cota de Coparticipacao no Fluxo de Aprovacao

## Problema Identificado

A cobranca de R$ 750,00 esta errada. O valor e um **hardcoded** (`VALORES_SINISTRO.cota_participacao_padrao = 750`). O fluxo atual nao consulta o plano do associado para calcular a cota corretamente.

**Dados reais do sinistro SIN-20260215-0004:**
- Plano: SELECT EXCLUSIVE → `cota_participacao = 6%`, `cota_minima = R$ 1.200`
- Veiculo FIPE: R$ 70.008,00
- Calculo correto: `max(70.008 * 6%, 1.200) = R$ 4.200,48`
- Valor cobrado: R$ 750,00 (errado)

**Causa raiz:** A edge function `aprovar-sinistro` nao calcula nem salva o `valor_cota_participacao` no sinistro. Quando o webhook do Autentique e acionado apos assinatura, ele le esse campo (que esta null ou foi preenchido com o default de R$ 750).

## Formula de Calculo

```text
valor_cota = max(valor_fipe_veiculo * plano.cota_participacao / 100, plano.cota_minima)

Se veiculo.uso_aplicativo = true:
  valor_cota = max(valor_fipe * plano.cota_app_percent / 100, plano.cota_app_min)
```

## Alteracoes

### 1. Edge Function `aprovar-sinistro/index.ts`

Ao aprovar o sinistro, **calcular e salvar** o `valor_cota_participacao` correto:

1. Alterar a query de busca do sinistro para incluir `plano_id` do associado e `valor_fipe, uso_aplicativo` do veiculo
2. Buscar o plano do associado: `cota_participacao`, `cota_minima`, `cota_app_percent`, `cota_app_min`
3. Calcular: `max(valor_fipe * percentual / 100, minimo)`
4. Incluir `valor_cota_participacao` no update do sinistro

**Impacto:** Todo sinistro aprovado a partir de agora tera o valor correto salvo. O webhook do Autentique e a cobranca Asaas usarao esse valor automaticamente.

### 2. Constante `VALORES_SINISTRO.cota_participacao_padrao` em `src/types/sinistros.ts`

Manter a constante como fallback, mas nao sera mais usada no fluxo principal. O valor real vira do calculo do plano.

### 3. Correcao retroativa do sinistro SIN-20260215-0004

Atualizar o `valor_cota_participacao` do sinistro atual para o valor correto (R$ 4.200,48) e, se ja houver cobranca Asaas criada, cancelar/ajustar.

## Detalhes Tecnicos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/aprovar-sinistro/index.ts` | Calcular cota com base no plano + FIPE e salvar no sinistro ao aprovar |

### Trecho de codigo a adicionar (aprovar-sinistro)

Apos buscar o sinistro (linha ~36), buscar tambem o plano e calcular a cota:

```
// Buscar plano do associado para calcular cota
const { data: associadoPlano } = await supabase
  .from('associados')
  .select('plano_id')
  .eq('id', sinistro.associado.id)
  .single();

let valorCotaCalculado = null;
if (associadoPlano?.plano_id && sinistro.veiculo?.valor_fipe) {
  const { data: plano } = await supabase
    .from('planos')
    .select('cota_participacao, cota_minima, cota_app_percent, cota_app_min')
    .eq('id', associadoPlano.plano_id)
    .single();

  if (plano) {
    const { data: veiculoFull } = await supabase
      .from('veiculos')
      .select('uso_aplicativo')
      .eq('id', sinistro.veiculo.id)
      .single();

    let percentual = plano.cota_participacao || 6;
    let minimo = plano.cota_minima || 1200;
    if (veiculoFull?.uso_aplicativo && plano.cota_app_percent) {
      percentual = plano.cota_app_percent;
      minimo = plano.cota_app_min || minimo;
    }

    valorCotaCalculado = Math.max(
      sinistro.veiculo.valor_fipe * percentual / 100,
      minimo
    );
  }
}
```

Depois, no update do sinistro, incluir:

```
.update({
  status: 'aprovado',
  valor_cota_participacao: valorCotaCalculado,
  updated_at: new Date().toISOString(),
})
```
