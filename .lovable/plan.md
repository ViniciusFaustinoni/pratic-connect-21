

# Dashboard de Vistorias de Prestadores Externos

## Resumo

Criar uma nova pagina dedicada ao acompanhamento em tempo real de todas as vistorias atribuidas a vistoriadores prestadores externos, com valores de cada tarefa, acessivel por coordenadores, diretores e financeiro.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/monitoramento/VistoriasPrestadoresDashboard.tsx` | **Criar** |
| `src/hooks/useVistoriasPrestadoresDashboard.ts` | **Criar** |
| `src/App.tsx` | **Editar** — adicionar rota `/monitoramento/vistorias-prestadores` |

## Detalhes

### 1. Hook de dados (useVistoriasPrestadoresDashboard.ts)

- Query principal: buscar `vistoria_prestador_links` com join em `vistoriadores_prestadores` (nome, telefone) e `instalacoes` (associado_nome, cidade, bairro, data_agendada)
- Retornar metricas agregadas: total de links, aguardando, em execucao, concluidas, valor total previsto, valor total concluido
- Realtime: subscribe no canal `vistoria_prestador_links` para invalidar queries automaticamente
- `refetchInterval: 30000` como fallback

### 2. Pagina Dashboard (VistoriasPrestadoresDashboard.tsx)

**KPI Cards (topo):**
- Total de vistorias atribuidas
- Aguardando resposta (status `aguardando`)
- Em execucao (status `em_execucao`)
- Concluidas (status `concluida`)
- Valor total previsto (soma de `valor` de todos os links)
- Valor total pago (soma de `valor` dos concluidos)

**Filtros:**
- Periodo (hoje, 7 dias, 30 dias, todos)
- Status (todos, aguardando, em_execucao, concluida)
- Prestador (select com lista dos vistoriadores)

**Tabela principal:**
- Colunas: Prestador, Associado, Cidade, Status, Valor (R$), Atribuido em, Chegada, Conclusao, WhatsApp enviado
- Badge colorido por status
- Valor formatado com `formatarMoeda`
- Linha clicavel para expandir detalhes (fotos, checklist)

**Permissoes:**
- `PermissionGate` com `isDiretor`, `isAdminMaster`, `isCoordenadorMonitoramento`, `isFinanceiro` (mode: any)

### 3. Rota (App.tsx)

- Adicionar `<Route path="/monitoramento/vistorias-prestadores" element={<VistoriasPrestadoresDashboard />} />`
- Na linha ~644, junto das rotas de monitoramento existentes

