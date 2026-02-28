
# Corrigir Deteccao Automatica de Tipo de Veiculo na Autovistoria

## Problema

O campo `cotacao.categoria` esta **null** no banco de dados para cotacoes criadas pelo fluxo publico (link do associado). Apenas cotacoes criadas pelo Cotador interno tem esse campo preenchido (via dropdown manual). Como o codigo usa `cotacao.categoria === 'moto'` para determinar o tipo de veiculo, ele sempre retorna `false` e mostra as 15 fotos de carro, mesmo para motos.

Exemplo no banco: a cotacao com modelo "nxr160 Bros Esdd" (uma moto) tem `categoria: null`.

## Solucao

Duas alteracoes complementares:

### 1. Corrigir a derivacao de tipo na tela (imediato)

**Arquivo**: `src/pages/public/CotacaoContratacao.tsx`

Alterar a logica de `tipoVeiculo` na linha 523 para usar uma funcao de deteccao inteligente que verifica multiplos campos, em vez de depender apenas de `cotacao.categoria`:

- Primeiro, verificar `cotacao.categoria` (funciona para cotacoes do Cotador)
- Se null, verificar `cotacao.veiculo_categoria`
- Se ambos null, analisar `cotacao.veiculo_modelo` usando a funcao `detectarTipoVeiculo` que ja existe em `src/data/vistoriaConfigCompleta.ts` (reconhece palavras como "moto", "motocicleta", "nxr", "cg", "bros", etc.)

### 2. Preencher `categoria` ao salvar dados pessoais (preventivo)

**Arquivo**: `src/hooks/useCotacaoContratacao.ts`

No `salvarDadosPessoais`, ao salvar dados do CRLV, tambem derivar e persistir a `categoria` no banco se ela estiver null. Isso garante que futuras consultas ja tenham o campo preenchido.

Sera adicionado ao update da cotacao:
- `categoria: cotacao.categoria || detectarCategoria(cotacao.veiculo_modelo)`

Onde `detectarCategoria` retorna `'moto'` se o modelo contiver palavras como "moto", "nxr", "cg", "bros", "cb", "pcx", "factor", "biz", "pop", "titan", etc.

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/public/CotacaoContratacao.tsx` | Usar deteccao inteligente em vez de `cotacao.categoria === 'moto'` |
| `src/hooks/useCotacaoContratacao.ts` | Persistir `categoria` derivada ao salvar dados pessoais |

## Resultado

- Motos ja cadastradas passam a mostrar as 10 fotos corretas automaticamente
- Novas cotacoes terao o campo `categoria` preenchido no banco para consultas futuras
