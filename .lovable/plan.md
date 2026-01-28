
# Plano: Reestruturar Tela de Cotações

## Problemas Identificados

### 1. Aba "Finalizadas" Não Deveria Existir
A tela atual separa cotações em duas abas:
- **Em Andamento**: status `rascunho`, `enviada`, `visualizada`
- **Finalizadas**: status `aceita`, `recusada`, `expirada`

O problema é que cotações com status `aceita` ainda estão em fluxo ativo (cliente pagando, agendando vistoria, etc.), então não deveriam ir para "Finalizadas".

### 2. Autovistoria Move Cotação para Finalizadas
Quando autovistoria é realizada, a cotação assume status `aceita`, o que automaticamente a move para a aba "Finalizadas". Isso está incorreto pois o fluxo ainda está em andamento.

### 3. Status "Realizando Vistoria" Incorreto
Quando o cliente agenda vistoria sem autovistoria:
- Edge Function define `status_contratacao: 'vistoria_ok'`
- Função `getEtapaVenda` mapeia `vistoria_ok` → `realizando_pagamento`
- Deveria mostrar `vistoria_agendada` para quem agendou presencial

### 4. Clique Deveria Abrir Modal
Atualmente, clicar na linha navega para `/vendas/cotacoes/:id`. O usuário prefere um modal de detalhes inline.

---

## Solução Proposta

### Parte 1: Remover Sistema de Abas

**Arquivo:** `src/pages/vendas/Cotacoes.tsx`

Alterações:
- Remover separação em `emAndamento` e `fechadas`
- Remover componente `Tabs` completamente
- Exibir todas as cotações em uma única lista ordenada por status/data
- Manter os filtros existentes (Status, Período, Busca) para o usuário filtrar

```text
ANTES:
┌─────────────────────────────────────────────┐
│  [Em Andamento (5)]  [Finalizadas (3)]      │
├─────────────────────────────────────────────┤
│  Lista de cotações da aba selecionada       │
└─────────────────────────────────────────────┘

DEPOIS:
┌─────────────────────────────────────────────┐
│  [Filtros: Status ▾] [Período ▾] [Buscar]   │
├─────────────────────────────────────────────┤
│  Cotação 1 - Status: Realizando Vistoria    │
│  Cotação 2 - Status: Vistoria Agendada      │
│  Cotação 3 - Status: Enviada                │
│  Cotação 4 - Status: Rascunho               │
└─────────────────────────────────────────────┘
```

### Parte 2: Corrigir Mapeamento de Etapa para Vistoria Agendada

**Arquivo:** `src/components/cotacoes/CotacaoCard.tsx`

A função `getEtapaVenda` precisa diferenciar:
- `vistoria_ok` + `tipo_vistoria='autovistoria'` → `realizando_pagamento` (cliente precisa pagar)
- `vistoria_ok` + `tipo_vistoria='agendada'` → `vistoria_agendada` (cliente agendou presencial, aguardando técnico)

```typescript
// ANTES (linha 175):
if (statusContratacao === 'vistoria_ok') return 'realizando_pagamento';

// DEPOIS:
if (statusContratacao === 'vistoria_ok') {
  // Se agendou vistoria presencial, mostrar como "vistoria agendada"
  if (cotacao.tipo_vistoria === 'agendada') return 'vistoria_agendada';
  // Se fez autovistoria, cliente precisa pagar adesão
  return 'realizando_pagamento';
}
```

### Parte 3: Adicionar Modal de Detalhes

**Novo componente:** `src/components/cotacoes/CotacaoDetalheModal.tsx`

Criar modal que:
- Exibe informações resumidas da cotação (cliente, veículo, plano, valores)
- Mostra timeline de eventos
- Inclui ações principais (WhatsApp, PDF, Aceitar, Gerar Contrato)
- Tem link "Ver página completa" para navegação detalhada

**Arquivo:** `src/pages/vendas/Cotacoes.tsx`

- Adicionar estado para cotação selecionada no modal
- Trocar `onClick={() => navigate(...)}` por `onClick={() => setModalCotacao(cotacao)}`
- Importar e renderizar o novo `CotacaoDetalheModal`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotacoes.tsx` | Remover tabs, lista única, adicionar modal |
| `src/components/cotacoes/CotacaoCard.tsx` | Corrigir `getEtapaVenda` para `vistoria_agendada` |
| `src/components/cotacoes/CotacaoDetalheModal.tsx` | **NOVO** - Modal de detalhes |

---

## Seção Técnica

### Lógica de Ordenação da Lista Única

```typescript
const sortedCotacoes = [...filteredCotacoes].sort((a, b) => {
  // 1. Prioridade por status_contratacao ativo (cliente em fluxo)
  const temFluxoA = a.status_contratacao && a.status_contratacao !== 'aguardando';
  const temFluxoB = b.status_contratacao && b.status_contratacao !== 'aguardando';
  if (temFluxoA && !temFluxoB) return -1;
  if (!temFluxoA && temFluxoB) return 1;
  
  // 2. Prioridade por status da cotação
  const statusOrder = {
    rascunho: 1,
    enviada: 2,
    visualizada: 3,
    aceita: 4,  // Continua em cima porque pode ter fluxo ativo
    recusada: 5,
    expirada: 6,
  };
  const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  if (statusDiff !== 0) return statusDiff;
  
  // 3. Mais recentes primeiro
  return new Date(b.created_at) - new Date(a.created_at);
});
```

### Mapeamento Completo de status_contratacao → Etapa Visual

| status_contratacao | tipo_vistoria | Etapa Visual |
|-------------------|---------------|--------------|
| `aguardando` | - | (sem badge) |
| `plano_escolhido` | - | Escolhendo Plano |
| `dados_preenchidos` | - | Enviando Documentos |
| `documentos_ok` | - | Escolha de Vistoria |
| `vistoria_ok` | `autovistoria` | Realizando Pagamento |
| `vistoria_ok` | `agendada` | **Vistoria Agendada** ← CORREÇÃO |
| `pagamento_ok` | - | Assinando Contrato |
| `contrato_assinado` | - | Vistoria Agendada |

### Estrutura do Modal

```typescript
interface CotacaoDetalheModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacao: CotacaoWithRelations | null;
  onAcaoCompleta?: () => void; // Para invalidar queries após ação
}
```

Conteúdo do modal:
- Header: Status + Etapa da Venda + Número da cotação
- Seção Cliente: Nome, telefone, email
- Seção Veículo: Marca/Modelo/Ano, Placa, FIPE
- Seção Valores: Plano escolhido, mensalidade, adesão
- Seção Timeline: Últimos 5 eventos
- Footer: Botões de ação contextuais + "Ver detalhes completos"

---

## Resultado Esperado

### Antes
- 2 abas separando cotações
- Autovistoria vai para "Finalizadas"
- Agendamento presencial mostra "Realizando Vistoria"
- Clique navega para outra página

### Depois
- Lista única com filtros
- Todas as cotações na mesma visualização
- Agendamento presencial mostra "Vistoria Agendada"
- Clique abre modal inline com ações rápidas
