

# Plano: Consolidar Estoque + Rastreadores em uma Página Unificada

## Problema

Hoje existem dois itens separados no menu ("Estoque" e "Rastreadores") que tratam do mesmo assunto: rastreadores. Isso fragmenta a operação e obriga o coordenador a navegar entre páginas.

## Solução: Página Única "Rastreadores" com Abas Unificadas

Eliminar a página Estoque e absorver todo o conteúdo na página Rastreadores, reorganizada com abas claras:

```text
Rastreadores
├── [Visão Geral]  ← Métricas unificadas (estoque + comunicação) + lista com filtros/cards/tabela
├── [Estoque]      ← Entrada manual, importar lote, consulta por código/IMEI
├── [Histórico]    ← Movimentações de estoque (entrada, saída, transferências)
└── [Plataformas]  ← Config de plataformas (só diretor/dev, como já é hoje)
```

### Aba "Visao Geral" (tab padrão)
- Métricas combinadas: cards de estoque (disponíveis, instalados, manutenção, baixados) + cards de comunicação (online, atenção, offline)
- Filtros existentes do `RastreadorFiltersV2`
- Toggle cards/tabela com toda a funcionalidade atual (portador, manutenção, retirada, mapa, exclusão, lote)

### Aba "Estoque"
- Botoes "Entrada Manual" e "Importar Lote" (vindos do Estoque atual)
- `ConsultaRastreador` (busca por codigo/IMEI/serie)
- `EstoqueMetricas` simplificada (só os números de entrada/saída do período)

### Aba "Historico"
- `HistoricoMovimentacoes` (já existe, movido do Estoque)

### Aba "Plataformas"
- `PlataformasConfigPanel` (mantido, visível só para diretor/dev)

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/monitoramento/Rastreadores.tsx` | Reestruturar com 4 abas, absorver componentes do Estoque |
| `src/components/layout/AppSidebar.tsx` | Remover item "Estoque" do menu |
| `src/components/layout/GlobalBreadcrumb.tsx` | Remover breadcrumb de `/monitoramento/estoque` |
| `src/App.tsx` | Redirecionar `/monitoramento/estoque` para `/monitoramento/rastreadores` (compatibilidade) |
| `src/pages/monitoramento/DashboardCoordenador.tsx` | Atualizar link se necessário |

## O que NAO sera alterado

- Nenhum componente filho (EstoqueMetricas, ListaRastreadores, ConsultaRastreador, HistoricoMovimentacoes, etc.) — todos são reutilizados como estão
- Permissões existentes
- Edge functions
- Página `Estoque.tsx` pode ser removida ou mantida como redirect

