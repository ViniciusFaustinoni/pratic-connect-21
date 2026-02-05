
## Problema Identificado

O componente **FunilCotacaoChart** atualmente:
- Exibe as 9 etapas do funil de cotação apenas como visualização estática
- Não possui ação de clique para filtrar/navegar
- Tooltip só mostra informações básicas
- Interface não indica que é interativo (sem cursor pointer, sem hover states)

## Solução Proposta

Transformar o funil em um componente **clicável e interativo** que:
1. Permite clicar em cada etapa para navegar/filtrar
2. Exibe feedback visual de hover
3. Redireciona para a página apropriada com filtros aplicados
4. Opcional: Adiciona um callback `onEtapaClick` para uso em diferentes contextos

### Mapeamento de Navegação por Etapa

| Etapa | Ação ao Clicar |
|-------|----------------|
| 1. Novo | `/vendas/leads?etapa=novo` |
| 2. Contato | `/vendas/leads?etapa=contato` |
| 3. Cotação Gerada | `/vendas/cotacoes` |
| 4. Escolhendo Plano | `/vendas/cotacoes?status_contratacao=escolhendo_plano` |
| 5. Enviando Docs | `/vendas/cotacoes?status_contratacao=enviando_documentos` |
| 6. Termo Assinado | `/vendas/contratos?status=assinado` |
| 7. Pagamento Efetuado | `/vendas/contratos?adesao_paga=true` |
| 8. Vistoria Agendada | `/monitoramento/vistorias` |
| 9. Proposta Concluída | `/cadastro/associados?status=ativo` |

### Mudanças Técnicas

**Arquivo 1: `src/components/vendas/FunilCotacaoChart.tsx`**

1. **Adicionar import do useNavigate**
```typescript
import { useNavigate } from 'react-router-dom';
```

2. **Adicionar prop opcional para callback**
```typescript
interface FunilCotacaoChartProps {
  periodo?: Periodo;
  className?: string;
  compact?: boolean;
  onEtapaClick?: (etapaId: string) => void; // Nova prop
}
```

3. **Adicionar mapeamento de rotas**
```typescript
const ETAPA_ROTAS: Record<EtapaFunilCotacao, string> = {
  novo: '/vendas/leads?etapa=novo',
  contato: '/vendas/leads?etapa=contato',
  cotacao_gerada: '/vendas/cotacoes',
  escolhendo_plano: '/vendas/cotacoes?status_contratacao=escolhendo_plano',
  enviando_docs: '/vendas/cotacoes?status_contratacao=enviando_documentos',
  termo_assinado: '/vendas/contratos?status=assinado',
  pagamento_efetuado: '/vendas/contratos?adesao_paga=true',
  vistoria_agendada: '/monitoramento/vistorias',
  proposta_concluida: '/cadastro/associados?status=ativo',
};
```

4. **Adicionar handler de clique**
```typescript
const handleEtapaClick = (etapaId: EtapaFunilCotacao) => {
  if (onEtapaClick) {
    onEtapaClick(etapaId);
  } else {
    navigate(ETAPA_ROTAS[etapaId]);
  }
};
```

5. **Transformar linhas em elementos clicáveis**
- Mudar de `<TooltipTrigger>` para um `<div>` ou `<button>` clicável
- Adicionar estilos de hover: `hover:bg-primary/10 cursor-pointer rounded-lg p-2 -m-2 transition-colors`
- Adicionar `onClick={() => handleEtapaClick(etapa.id)}`

6. **Melhorar feedback visual**
- Adicionar ícone de seta ou indicador visual de ação
- Mudar cor do texto no hover
- Adicionar animação sutil de scale no hover

**Arquivo 2: `src/pages/vendas/Leads.tsx`**

1. **Ler filtro de etapa via URL**
```typescript
// No useEffect inicial
useEffect(() => {
  const etapaParam = searchParams.get('etapa');
  if (etapaParam) {
    setFilters(prev => ({ ...prev, etapa: [etapaParam as EtapaLead] }));
  }
}, []);
```

**Arquivo 3: `src/pages/vendas/Cotacoes.tsx`** (se necessário)

1. **Ler filtro status_contratacao via URL**
```typescript
const statusContratacaoParam = searchParams.get('status_contratacao');
if (statusContratacaoParam) {
  // Aplicar filtro
}
```

### Interface Final do Funil

```
┌────────────────────────────────────────────────────────┐
│ ↗ Funil de Cotação                         ⓘ 1 sem lead│
│   Jornada real do cliente no processo                  │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ● 1. Novo                                      0    → │
│   [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]        │
│                                                        │
│ ● 2. Contato                                   0    → │  ← Hover: bg-primary/10
│   [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]        │
│                                                        │
│ ● 3. Cotação Gerada                            1    → │  ← Clique: Navega
│   [████████████████████████████████████████████]      │
│                                                        │
│ ...                                                    │
├────────────────────────────────────────────────────────┤
│ Total: 1  │  Taxa: 100%  │  Clique para filtrar       │
└────────────────────────────────────────────────────────┘
```

### Impacto

- Funil se torna navegável e útil como ponto de partida
- Usuários podem clicar em qualquer etapa para ver os registros específicos
- Feedback visual claro indica interatividade
- Mantém compatibilidade com uso atual (sem breaking changes)
- Tooltip continua funcionando para informações adicionais

### Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/vendas/FunilCotacaoChart.tsx` | Adicionar navegação e estilos hover |
| `src/pages/vendas/Leads.tsx` | Suportar filtro via URL `?etapa=` |
| `src/pages/vendas/Cotacoes.tsx` | (Opcional) Suportar filtro `?status_contratacao=` |
