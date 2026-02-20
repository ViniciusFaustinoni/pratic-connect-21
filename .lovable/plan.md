
# Correção: Badge de Status Incorreto na Lista de Sinistros

## Diagnóstico

### Dois erros distintos relatados

**Erro 1 — Status "Comunicado" exibido errado:**
No `SinistrosList.tsx`, linha 497, o fallback de status é:
```ts
const statusInfo = statusConfig[sinistro.status] || statusConfig.comunicado;
```
O mapa `statusConfig` (linhas 54–71) **não possui entrada para `pecas_em_cotacao`**, então qualquer sinistro com esse status cai no fallback `statusConfig.comunicado`, exibindo o badge "Comunicado" em amarelo — completamente errado.

**Confirmado no banco:** O sinistro SIN-20260220-0012 está com `status = pecas_em_cotacao` desde às 18:20 de hoje, mas a lista exibe "Comunicado".

**Erro 2 — "Deveria aparecer em Pré-Análise":**
Este ponto não é um erro — é uma expectativa incorreta. A tela **Pré-Análise** (`EventosPreAnalise.tsx`) existe para sinistros ainda na fase inicial: `comunicado`, `documentacao_pendente`, `aguardando_vistoria`. Um sinistro em `pecas_em_cotacao` já passou pela vistoria, aprovação e pagamento da cota — ele pertence corretamente à **lista geral de Sinistros**. O problema era apenas o badge errado dando a impressão de que estava "em comunicado".

## Solução

### 1. Adicionar `pecas_em_cotacao` ao `statusConfig` do `SinistrosList.tsx`

Inserir a entrada faltante no mapa de configuração de status:

```ts
pecas_em_cotacao: { label: 'Peças em Cotação', class: 'bg-amber-100 text-amber-800' },
```

### 2. Corrigir o fallback de status

Trocar o fallback perigoso por um fallback genérico que não mascara o status real:

```ts
// Antes (bugado — fallback faz qualquer status desconhecido virar "Comunicado"):
const statusInfo = statusConfig[sinistro.status] || statusConfig.comunicado;

// Depois (seguro — usa o próprio valor do status como label):
const statusInfo = statusConfig[sinistro.status] || { 
  label: sinistro.status?.replace(/_/g, ' ') || 'Desconhecido', 
  class: 'bg-gray-100 text-gray-800' 
};
```

### 3. Adicionar `pecas_em_cotacao` ao filtro de status no Select

O select de filtros (linha 424–441) não tem a opção "Peças em Cotação", tornando impossível filtrar por esse status na lista do diretor. Adicionar a opção:

```tsx
<SelectItem value="pecas_em_cotacao">Peças em Cotação</SelectItem>
```

### 4. Adicionar `pecas_em_cotacao` ao filtro do analista de eventos

Na linha 143–147, o analista de eventos vê apenas certos status. `pecas_em_cotacao` deve ser incluído para que o analista acompanhe o andamento dos sinistros aprovados:

```ts
query = query.in('status', [
  'aguardando_analise', 'aprovado', 'negado', 'reprovado',
  'em_reparo', 'em_recuperacao', 'aguardando_pagamento',
  'pago', 'encerrado', 'cancelado',
  'pecas_em_cotacao'  // ← adicionar
] as any);
```

Igualmente no contador de analistas (linhas 193–197).

## Arquivos a Alterar

| Arquivo | Alteração |
|---|---|
| `src/pages/eventos/SinistrosList.tsx` | 1. Adicionar `pecas_em_cotacao` ao `statusConfig`; 2. Corrigir fallback de status para não apontar para `comunicado`; 3. Adicionar opção no Select de filtros; 4. Incluir `pecas_em_cotacao` nos status visíveis pelo analista |

## Resultado Esperado

Após a correção, o sinistro SIN-20260220-0012 exibirá o badge **"Peças em Cotação"** em amarelo-âmbar na lista de Gestão de Sinistros — que é o local correto para ele estar. Outros sinistros com status desconhecidos futuros também não serão mais erroneamente rotulados como "Comunicado".
