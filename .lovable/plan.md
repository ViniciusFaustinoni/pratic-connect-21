
# Plano: Refatorar Área de Cotações

## Resumo dos Problemas Identificados

1. **Aba "Finalizadas" não deveria existir** - Todas as cotações devem aparecer em uma lista única
2. **Exibição deve ser em lista** (tabela), não em cards individuais
3. **Clique na linha** deve abrir modal de detalhes (não navegar para outra página)
4. **Bug de status**: Quando cliente agenda vistoria presencial, o badge mostra "Realizando Vistoria" ao invés de "Vistoria Agendada"

---

## Análise do Bug de Status

### Código Atual (CotacaoCard.tsx, linha 176):
```typescript
if (statusContratacao === 'vistoria_ok') return 'realizando_pagamento';
```

### Problema:
Quando o cliente opta por **vistoria presencial** (não autovistoria):
- O `status_contratacao` é definido como `'vistoria_ok'`
- O `tipo_vistoria` é definido como `'agendada'`
- Mas a instalação ainda NÃO existe (é criada somente após pagamento)
- A função retorna `'realizando_pagamento'`, que está correto para o fluxo de pagamento
- Porém, na aba Finalizadas, mostra como "Realizando Vistoria" (badge incorreto)

### Correção Proposta:
Verificar se `tipo_vistoria === 'agendada'` e mostrar "Vistoria Agendada" quando apropriado, mantendo o contexto correto do fluxo.

---

## Alterações Necessárias

### 1. Remover Aba "Finalizadas" e Exibir Lista Única

**Arquivo**: `src/pages/vendas/Cotacoes.tsx`

**Alterações**:
- Remover as Tabs (Em Andamento / Finalizadas)
- Remover lógica de separação `emAndamento` vs `fechadas`
- Exibir todas as cotações em uma única lista/tabela
- Ordenar por data de criação (mais recentes primeiro)

### 2. Trocar Cards por Tabela/Lista

**Arquivo**: `src/pages/vendas/Cotacoes.tsx` ou novo componente

**Nova estrutura**:
```typescript
// Tabela com colunas:
// - Status/Etapa
// - Lead/Cliente (nome, telefone)
// - Veículo (marca, modelo, placa)
// - Valor FIPE
// - Consultor
// - Data
// - Ações
```

### 3. Criar Modal de Detalhes

**Novo arquivo**: `src/components/cotacoes/CotacaoDetalhesModal.tsx`

**Funcionalidades**:
- Exibir todos os dados da cotação
- Mostrar planos comparados
- Exibir histórico/timeline
- Botões de ação (PDF, WhatsApp, Aceitar, etc.)
- Baseado no conteúdo do `CotacaoCard.tsx` atual

### 4. Corrigir Lógica de Etapa da Venda

**Arquivo**: `src/components/cotacoes/CotacaoCard.tsx` (função `getEtapaVenda`)

**Correção**:
```typescript
// Quando status_contratacao = 'vistoria_ok', verificar tipo de vistoria
if (statusContratacao === 'vistoria_ok') {
  const tipoVistoria = cotacao.tipo_vistoria;
  // Se é vistoria agendada e ainda não pagou, mostrar "Aguardando Pagamento"
  // Se é autovistoria, verificar se já fez a autovistoria
  return 'realizando_pagamento'; // ou 'vistoria_agendada' conforme contexto
}
```

---

## Estrutura da Nova Tabela

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Cotação                                                           [+ Nova Cotação]  │
│ Gerencie todas as cotações e acompanhe propostas                                     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [Cards de Métricas: Total, Enviadas, Aceitas, Conversão]                             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Buscar...    Status ▼    Período ▼    Consultor ▼                                    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Status      │ Cliente           │ Veículo              │ FIPE      │ Data     │  │
│  ├────────────────────────────────────────────────────────────────────────────────┤  │
│  │ ✓ ACEITA    │ Marcus Vinicius   │ Toyota Corolla 2013  │ R$ 70k    │ 01/02    │  │
│  │   ATIVO     │ 31 9999...        │ LTB4J74              │           │ 12h ago  │  │
│  ├────────────────────────────────────────────────────────────────────────────────┤  │
│  │ → ENVIADA   │ Ana Paula         │ Honda Civic 2019     │ R$ 85k    │ 31/01    │  │
│  │             │ 31 8888...        │ ABC1234              │           │ 2d ago   │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  Clique em uma linha para ver detalhes e ações                                       │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/vendas/Cotacoes.tsx` | **REFATORAR** - Remover tabs, usar lista/tabela única |
| `src/components/cotacoes/CotacaoDetalhesModal.tsx` | **CRIAR** - Modal com detalhes e ações |
| `src/components/cotacoes/CotacoesTable.tsx` | **CRIAR** - Componente de tabela |
| `src/components/cotacoes/CotacaoCard.tsx` | **EDITAR** - Corrigir função `getEtapaVenda` |

---

## Fluxo Após Implementação

1. Usuário acessa `/vendas/cotacoes`
2. Vê cards de métricas no topo (Total, Enviadas, Aceitas, Conversão)
3. Aplica filtros (status, período, consultor)
4. Visualiza todas as cotações em uma única lista ordenada
5. Clica em uma linha → Abre modal de detalhes
6. No modal: visualiza dados, baixa PDF, envia WhatsApp, gera contrato, etc.

---

## Correção do Bug de Status (Detalhada)

O problema está na priorização da função `getEtapaVenda`. Quando:
- `status_contratacao = 'vistoria_ok'` 
- `tipo_vistoria = 'agendada'`
- Não há instalação criada ainda

O sistema precisa diferenciar:
1. **Vistoria Agendada** (aguardando pagamento para criar instalação)
2. **Realizando Pagamento** (cliente está pagando)

A correção deve verificar `tipo_vistoria` para mostrar o badge correto:
```typescript
if (statusContratacao === 'vistoria_ok') {
  // Se agendou vistoria presencial, mostrar "Vistoria Agendada" 
  // (pagamento ainda não foi feito, mas vistoria já foi agendada)
  if (cotacao.tipo_vistoria === 'agendada' && cotacao.vistoria_data_agendada) {
    return 'vistoria_agendada';
  }
  return 'realizando_pagamento';
}
```
