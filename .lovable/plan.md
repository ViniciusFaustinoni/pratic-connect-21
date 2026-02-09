
# Correcao Urgente: Fatura Ignora Segundo Veiculo

## O Problema

Existem **duas** edge functions de geracao de faturas, e **ambas** tem o mesmo bug:

1. **`gerar-faturas-mensais`** (modelo rateio/pos-pago) - linha 201:
```
const veiculo = veiculos[0] as any;  // BUG: so pega o primeiro
```

2. **`gerar-cobrancas-mensais`** (modelo plano fixo) - linha 136:
```
const valorMensalidade = (associado.planos as any)?.valor_mensalidade || 150;
// Nem busca veiculos - usa valor fixo do plano
```

A segunda funcao (`gerar-cobrancas-mensais`) tem um problema diferente: ela nem consulta veiculos, usa o valor fixo do plano do associado. Neste caso, nao ha bug de "ignorar segundo veiculo" porque o valor ja vem do plano. O bug critico esta na **`gerar-faturas-mensais`** (rateio).

---

## Correcao: `gerar-faturas-mensais/index.ts`

### O que muda

Em vez de pegar `veiculos[0]` e calcular a composicao para um unico veiculo, o sistema vai:

1. **Iterar TODOS os veiculos ativos** e calcular a composicao individual de cada um (taxa administrativa, rateios por cobertura, cotas)
2. **Somar os totais** para gerar um unico boleto ASAAS unificado
3. **Registrar uma linha em `cobrancas_composicao` POR VEICULO** (a tabela ja suporta `veiculo_id`)
4. **Salvar metadata com detalhes** de cada veiculo na cobranca principal via `composicao_resumo`
5. **Melhorar a descricao** do boleto ASAAS para mostrar quantidade de veiculos quando > 1
6. **Adicionar log de auditoria** para associados multi-veiculo

### Detalhes tecnicos

**Trecho atual (linhas 197-230):**
```
const veiculo = veiculos[0] as any;
// ... calcula composicao para 1 veiculo
```

**Sera substituido por:**
```
// Para cada veiculo ativo, calcular composicao individual
let totalGeral = 0;
const composicoesPorVeiculo = [];

for (const veiculo of veiculosAtivos) {
  const valorFipe = veiculo.valor_fipe || 50000;
  const cotas = veiculo.quantidade_cotas || ...;
  const composicao = { taxa_administrativa, rateios... };
  totalGeral += composicao.total;
  composicoesPorVeiculo.push({ veiculo, composicao });
}
```

**Na insercao da cobranca:**
- `valor` = soma de todos os veiculos (totalGeral)
- `veiculo_id` = null (cobranca unificada, nao pertence a um unico veiculo)
- `composicao_resumo` = JSON com array de { placa, valor, cotas } por veiculo

**Na insercao de `cobrancas_composicao`:**
- Uma linha por veiculo (ja suportado pela tabela)
- Cada linha com seu respectivo `veiculo_id`, `valor_fipe`, `quantidade_cotas`

**Na descricao ASAAS:**
- 1 veiculo: `Fatura 2026-02 - Nome - ABC1234`
- 2+ veiculos: `Fatura 2026-02 - Nome - 2 veiculos: ABC1234, XYZ5678`

### A funcao `gerar-cobrancas-mensais` (modelo plano fixo)

Esta funcao usa `valor_mensalidade` do plano do associado, nao calcula por veiculo. Nao tem o mesmo bug, pois o valor vem do plano. **Nao sera alterada** nesta correcao — se o modelo de plano fixo precisar somar por veiculo, e uma mudanca de regra de negocio separada.

---

## Arquivos a Alterar

| Arquivo | Alteracao |
|---------|----------|
| `supabase/functions/gerar-faturas-mensais/index.ts` | Iterar todos veiculos ativos, somar composicoes, registrar por veiculo |

### O que NAO sera alterado
- `gerar-cobrancas-mensais` (modelo diferente, valor fixo do plano)
- Nenhuma outra edge function
- Nenhum componente frontend
- Nenhuma tabela de banco (cobrancas_composicao ja suporta veiculo_id)
