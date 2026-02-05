
## Análise: Discrepância Entre Funil do Dashboard e Jornada Real da Cotação

### Problema Identificado

O **Funil de Vendas** exibido no Dashboard do Vendedor mostra etapas diferentes das que o lead realmente passa durante o processo de cotação.

### Comparativo: Funil Atual vs. Etapas Desejadas

| Dashboard Atual | Etapas Desejadas | Status |
|-----------------|------------------|--------|
| Novo | Novo | ✅ Correto |
| Contato | Contato | ✅ Correto |
| Qualificado | — | ❌ Não desejado |
| Cotação Enviada | Cotação Gerada | ⚠️ Precisa incluir cotações sem lead |
| Negociação | — | ❌ Não desejado |
| — | Escolhendo Plano | ❌ Falta no funil |
| — | Enviando Documentação | ❌ Falta no funil |
| — | Termo Assinado | ❌ Falta no funil |
| — | Pagamento Efetuado | ❌ Falta no funil |
| Vistoria Agendada | Vistoria Agendada | ✅ Correto |
| Contrato Env. | — | ❌ Não desejado |
| Assinado | — | ❌ Não desejado (duplica termo) |
| Instalação | — | ❌ Não desejado |
| Ganho | Proposta Concluída | ⚠️ Renomear (marca conversão) |

### Descoberta Importante

O sistema **já possui** as etapas corretas implementadas para o fluxo de cotação nos componentes:
- `CotacaoCard.tsx`
- `CotacoesTable.tsx`
- `CotacaoDetalhesModal.tsx`

Essas etapas são usadas internamente para acompanhar o progresso da cotação:

| Etapa Interna (já existe) | Correspondente Desejada |
|---------------------------|-------------------------|
| `cotacao_realizada` | Cotação Gerada |
| `escolhendo_plano` | Escolhendo Plano |
| `enviando_documentos` | Enviando Documentação |
| `assinando_contrato` | Termo Assinado |
| `realizando_pagamento` | Pagamento Efetuado |
| `vistoria_agendada` | Vistoria Agendada |
| `associado_ativo` | Proposta Concluída |

### Solução Proposta

Refatorar o funil de vendas do Dashboard para usar as **9 etapas desejadas**:

```text
1. Novo              → Lead recebido, não contactado
2. Contato           → Primeiro contato realizado
3. Cotação Gerada    → Cotação criada (incluir sem lead)
4. Escolhendo Plano  → Cliente analisando opções
5. Enviando Docs     → Cliente enviando documentação
6. Termo Assinado    → Contrato assinado digitalmente
7. Pagamento Efetuado→ Adesão paga
8. Vistoria Agendada → Aguardando vistoria
9. Proposta Concluída→ Associado ativo (conversão)
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/types/database.ts` | Atualizar `EtapaLead` com novas etapas |
| `src/lib/lead-transitions.ts` | Refatorar `ETAPAS_FUNIL` com 9 etapas |
| `src/hooks/useVendasMetricasExpanded.ts` | Atualizar `ETAPAS_FUNIL_CONFIG` |
| `src/hooks/useVendasMetricas.ts` | Atualizar `ETAPA_LABELS` e `ETAPA_CORES` |
| `src/pages/Dashboard.tsx` | Atualizar `etapaConfig` com novas etapas |
| `src/pages/vendas/VendasDashboard.tsx` | Atualizar visualização do funil |
| `src/pages/vendas/LeadKanban.tsx` | Atualizar colunas do Kanban |

### Lógica de Contagem para o Funil

Para contar leads/cotações por etapa, a lógica será:

```typescript
const NOVO_FUNIL_CONFIG = [
  { 
    id: 'novo', 
    label: 'Novo',
    // Leads com etapa='novo' (sem contato)
  },
  { 
    id: 'contato', 
    label: 'Contato',
    // Leads com etapa='contato' ou 'contato_inicial'
  },
  { 
    id: 'cotacao_gerada', 
    label: 'Cotação Gerada',
    // Contar COTAÇÕES (não leads) com status != 'rascunho'
    // Inclui cotações SEM lead vinculado
  },
  { 
    id: 'escolhendo_plano', 
    label: 'Escolhendo Plano',
    // Cotações com status_contratacao = 'plano_escolhido'
  },
  { 
    id: 'enviando_docs', 
    label: 'Enviando Docs',
    // Cotações com status_contratacao = 'dados_preenchidos'
  },
  { 
    id: 'termo_assinado', 
    label: 'Termo Assinado',
    // Cotações com status_contratacao = 'contrato_assinado'
    // OU contratos com status = 'assinado'
  },
  { 
    id: 'pagamento_efetuado', 
    label: 'Pagamento Efetuado',
    // Contratos com adesao_paga = true
  },
  { 
    id: 'vistoria_agendada', 
    label: 'Vistoria Agendada',
    // Instalações/Vistorias com status = 'agendada'
  },
  { 
    id: 'proposta_concluida', 
    label: 'Proposta Concluída',
    // Associados com status = 'ativo'
    // Esta etapa define a taxa de conversão
  },
];
```

### Taxa de Conversão

A taxa de conversão será calculada como:

```
Taxa = (Propostas Concluídas / Total de Cotações Geradas) × 100%
```

### Considerações Importantes

1. **Migração de dados:** Leads existentes precisam ser mapeados para as novas etapas
2. **Cotações sem lead:** O funil deve contar cotações independentemente de terem lead vinculado
3. **Backwards compatibility:** Manter etapas antigas como aliases para não quebrar dados históricos
4. **Kanban:** O Kanban de vendas também precisará ser atualizado para refletir as novas etapas

### Resumo da Implementação

1. Redefinir as 9 etapas do funil em `src/lib/lead-transitions.ts`
2. Atualizar hooks de métricas para usar lógica híbrida (leads + cotações + contratos)
3. Refatorar Dashboard e VendasDashboard para exibir novo funil
4. Atualizar Kanban com as novas colunas
5. Adicionar contador de "Cotações sem Lead" na etapa "Cotação Gerada"
