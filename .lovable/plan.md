

# Permitir Edicao de Cotacoes (Exceto Apos Assinatura)

## Problema Atual
A edicao de cotacoes esta restrita apenas ao status `rascunho`. Cotacoes em outros status (enviada, visualizada, etc.) nao podem ser editadas, mesmo quando ainda nao possuem contrato assinado. A edicao so deve ser bloqueada apos a assinatura do contrato.

## Solucao

### Regra de Negocio
- **Pode editar**: qualquer cotacao que NAO possua um contrato com status `assinado` ou `ativo`
- **Nao pode editar**: cotacoes cujo contrato vinculado ja foi assinado (`contrato.status` in `['assinado', 'ativo']`)

### Mudancas

#### 1. `CotacaoAcoes.tsx` — Expandir condicao de edicao

Substituir `podeEditar = cotacao.status === 'rascunho'` por uma logica que verifica se existe contrato assinado. O componente recebera uma nova prop `contratoAssinado` (boolean).

```text
ANTES:  const podeEditar = cotacao.status === 'rascunho';
DEPOIS: const podeEditar = !contratoAssinado;
```

Atualizar o tooltip do botao para refletir: "Nao e possivel editar apos a assinatura do contrato".

#### 2. `CotacaoDetalhe.tsx` — Permitir edicao em qualquer status pre-assinatura

- Remover a condicao `cotacao.status === 'rascunho'` que envolve o `CotacaoFormDialog`
- Calcular `contratoAssinado` baseado em `cotacao.contrato?.status` (verificar se e `assinado` ou `ativo`)
- Passar `contratoAssinado` para `CotacaoAcoes`
- O `cotacaoParaEditar` continuara sendo passado normalmente ao dialog

#### 3. `CotacaoFormDialog.tsx` — Garantir que aceita cotacoes de qualquer status

O dialog ja suporta edicao via `cotacaoParaEditar`. Nenhuma mudanca significativa — apenas garantir que o comentario `"somente rascunhos"` na tipagem seja atualizado para refletir a nova regra.

#### 4. `Cotacoes.tsx` (listagem) — Verificar se ha botao de edicao na tabela

Se a listagem tiver acoes de edicao inline, aplicar a mesma regra: permitir exceto quando contrato assinado.

#### 5. Atualizacao automatica no link do associado

O link publico (`CotacaoPublica`, `CotacaoContratacao`) ja le os dados diretamente da tabela `cotacoes` via token. Como o `useUpdateCotacao` atualiza a tabela, qualquer edicao reflete automaticamente no link do associado sem mudancas adicionais.

## Arquivos Modificados (3-4)

1. **`src/components/cotacoes/CotacaoAcoes.tsx`** — Nova prop `contratoAssinado`, logica de `podeEditar` atualizada
2. **`src/pages/vendas/CotacaoDetalhe.tsx`** — Remover restricao de status rascunho, calcular `contratoAssinado`, passar ao componente de acoes
3. **`src/components/cotacoes/CotacaoFormDialog.tsx`** — Atualizar comentario da tipagem (mudanca menor)
4. **`src/pages/vendas/Cotacoes.tsx`** — Se houver edicao inline, aplicar mesma regra

## Impacto
- Cotacoes enviadas, visualizadas ou em negociacao poderao ser editadas normalmente
- O link publico do associado refletira as alteracoes automaticamente (ja funciona assim)
- Apos assinatura do contrato, a edicao sera bloqueada definitivamente
