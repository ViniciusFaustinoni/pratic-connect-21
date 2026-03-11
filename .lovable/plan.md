

# Corrigir hardcodes em StepBeneficios.tsx e StepFinanceiro.tsx

## Contexto do wizard

Estes componentes fazem parte do fluxo de **substituição de veículo** (`src/components/substituicao/`). O wizard tem os dados do novo veículo (`dadosNovoVeiculo`) com `valor_fipe`, `marca`, `modelo`, `uso_aplicativo`, e o plano do associado atual.

O `useCalcularCotacao` é um hook imperativo (chama `calcular(params)` que retorna planos com `valor_mensal` da `tabelas_preco_mensalidade`). Porém, o contexto de substituição não tem `plano_id` nem `linha_slug` explícitos — o associado já tem um plano ativo.

**Abordagem**: Criar um hook wrapper simples que busca o valor mensal correto de `tabelas_preco_mensalidade` dado um `valor_fipe` e `tipo_uso`, reutilizando a mesma lógica do `useCalcularCotacao`. Chamar `calcular()` e pegar o `valor_mensal` do plano correspondente.

## Passo 1 — StepBeneficios.tsx (linha 78-81)

Substituir `fipe * 0.0045` por chamada ao `useCalcularCotacao`:

```typescript
const { calcular, resultado } = useCalcularCotacao();

useEffect(() => {
  const fipe = dadosNovoVeiculo.valor_fipe;
  if (fipe && fipe > 0) {
    calcular({
      valor_fipe: fipe,
      tipo_uso: dadosNovoVeiculo.uso_aplicativo ? 'aplicativo' : 'particular',
    });
  }
}, [dadosNovoVeiculo.valor_fipe, dadosNovoVeiculo.uso_aplicativo]);

const mensalidadeBase = useMemo(() => {
  if (resultado?.planos?.length) {
    // Pegar o plano destaque ou o primeiro disponível
    const planoDestaque = resultado.planos.find(p => p.destaque) || resultado.planos[0];
    return planoDestaque.valor_mensal;
  }
  return 0;
}, [resultado]);
```

## Passo 2 — StepFinanceiro.tsx

### 2.1 — Mensalidade base (linhas 87-91)
Mesmo padrão: usar `useCalcularCotacao` para buscar o valor real.

```typescript
const { calcular, resultado: resultadoCotacao } = useCalcularCotacao();

useEffect(() => {
  const fipe = dadosNovoVeiculo.valor_fipe;
  if (fipe && fipe > 0) {
    calcular({
      valor_fipe: fipe,
      tipo_uso: dadosNovoVeiculo.uso_aplicativo ? 'aplicativo' : 'particular',
    });
  }
}, [dadosNovoVeiculo.valor_fipe, dadosNovoVeiculo.uso_aplicativo]);

const mensalidadeBaseNova = useMemo(() => {
  if (mensalidadeManual) return parseFloat(mensalidadeManual);
  if (resultadoCotacao?.planos?.length) {
    const plano = resultadoCotacao.planos.find(p => p.destaque) || resultadoCotacao.planos[0];
    return plano.valor_mensal;
  }
  return 0;
}, [resultadoCotacao, mensalidadeManual]);
```

A `mensalidadeBaseAntiga` mantém o fallback `veiculoAntigo.mensalidade || 0` (valor histórico do contrato).

### 2.2 — Fallback vidros R$ 9.90 (linhas 98 e 247)
Duas ocorrências de `9.90`. Substituir pelo valor do `precosMap` que já vem de `useBeneficiosSeparados()` (tabela `beneficios_adicionais`). Usar `precosMap['cobertura_vidros']?.preco || 0` em vez de `|| 9.90`.

### 2.3 — Multiplicador `cotas * 200` (linhas 128, 133)
O `200` é o **valor monetário por cota de participação**. Já existe o hook `useValorPorCota()` que busca `atuarial_valor_por_cota` da tabela `configuracoes` (padrão: 5000). Porém, 200 ≠ 5000 — são conceitos diferentes.

Investigando: `cotas * 200` calcula a **cota de participação em sinistro** (quanto o associado paga). Já `valor_por_cota = 5000` é o **tamanho da faixa FIPE** que define quantas cotas o veículo tem.

O valor `200` deveria ser uma chave em `configuracoes`, ex: `atuarial_valor_cota_participacao`. Precisa criar essa chave no banco.

**Ação**: Criar chave `atuarial_valor_cota_participacao` com valor `200` na tabela `configuracoes`, e um hook `useValorCotaParticipacao()` para buscá-la.

### 2.4 — Placeholder (linha 424)
Substituir `(dadosNovoVeiculo.valor_fipe || 0) * 0.0045` pelo `mensalidadeBaseNova` calculado.

## Passo 3 — Verificação global
Busca por `0.0045` para confirmar zero ocorrências restantes.

## Arquivos a modificar
- `src/components/substituicao/StepBeneficios.tsx` — usar `useCalcularCotacao` para mensalidade base
- `src/components/substituicao/StepFinanceiro.tsx` — usar `useCalcularCotacao`, remover fallback 9.90, substituir multiplicador 200

## Migração SQL
- Inserir chave `atuarial_valor_cota_participacao` = `200` na tabela `configuracoes`

## Checklist
- [ ] StepBeneficios: mensalidade usa hook real
- [ ] StepFinanceiro: mensalidade usa hook real
- [ ] StepFinanceiro: vidros R$9,90 corrigido
- [ ] StepFinanceiro: multiplicador 200 vem do banco
- [ ] Placeholder atualizado
- [ ] Busca global: zero ocorrências de 0.0045

