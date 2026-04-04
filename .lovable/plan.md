

# Reestruturação do Mapa de Monitoramento em Abas

## Resumo
Substituir a estrutura atual do mapa (2 abas: Veículos + Vistorias) por 3 abas com propósitos distintos: **Associados**, **Equipe** e **Atribuições** (condicional). Remover filtros de data do mapa de vistorias. Adicionar funcionalidade de cancelamento de rota atribuída para Coordenador de Monitoramento e Diretor.

## Estrutura das Abas

```text
┌─────────────┬──────────┬──────────────────┐
│ Associados  │  Equipe  │  Atribuições*    │
└─────────────┴──────────┴──────────────────┘
* só aparece se atribuição manual estiver ativa
```

### Aba 1 — Associados
- Mapa satélite com barra de pesquisa por placa (já existe como aba "Veículos")
- Busca exibe o veículo encontrado no mapa (comportamento atual mantido)
- Renomear de "Veículos" para "Associados"

### Aba 2 — Equipe
- Mapa mostrando apenas os técnicos em campo (marcadores azuis do `useVistoriadoresRealtime`)
- Popup de cada técnico com nome, status operacional, tempo da última atualização, botão WhatsApp
- Sem sidebar de lista de serviços; foco apenas na localização da equipe

### Aba 3 — Atribuições (condicional)
- Só aparece se `useConfigAtribuicaoManual` retornar `true`
- Mapa com técnicos + serviços pendentes (sem filtro de data — mostra serviços do dia atual e atrasados)
- Drag-and-drop de pins para atribuição manual (funcionalidade já implementada no MapaVistoriasContent)
- Linhas de rota dos serviços já atribuídos (polylines técnico → próxima tarefa)
- **Novo**: botão "Cancelar Atribuição" no popup de serviços já atribuídos, visível para `isCoordenadorMonitoramento` e `isDiretor`
- Cancelar atribuição = setar `profissional_id = null` e `status = 'pendente'` no serviço

## Alterações Técnicas

### 1. `src/pages/monitoramento/Mapa.tsx`
- Reestruturar as abas: `associados`, `equipe`, `atribuicoes`
- Aba `associados`: manter código existente de busca por placa e mapa de veículos
- Aba `equipe`: novo componente inline ou extraído, usando `useVistoriadoresRealtime` para renderizar apenas marcadores de técnicos
- Aba `atribuicoes`: renderizar `MapaVistoriasContent` (condicional via `useConfigAtribuicaoManual`)

### 2. `src/components/mapa/MapaVistoriasContent.tsx`
- Remover filtro de data (calendar, navegação anterior/próximo/hoje)
- Manter filtro hardcoded para data de hoje + atrasados (sem input do usuário)
- Remover filtro de tipo de vistoria e filtro de status da sidebar
- Manter apenas busca por placa/associado/bairro na sidebar
- Adicionar botão "Cancelar Atribuição" no popup de serviços que já têm `vistoriador_id`, visível apenas para coordenador/diretor
- Remover sidebar de lista de vistorias (ou simplificá-la para listar apenas serviços pendentes)

### 3. `src/hooks/useDesatribuirServico.ts` (novo)
- Hook com `useMutation` que faz:
  - `UPDATE servicos SET profissional_id = NULL, status = 'pendente' WHERE id = ?`
  - Registra no `servicos_atribuicoes_log` com `tipo_atribuicao = 'cancelamento_manual'`
  - Invalida queries relevantes

### 4. `src/hooks/useAtribuicaoManual.ts`
- Sem alterações (já funcional)

## Permissões
- Cancelamento de atribuição: `isCoordenadorMonitoramento || isDiretor || isAdminMaster || isDesenvolvedor`
- Importar `usePermissions` no `MapaVistoriasContent`

## Arquivos
| Arquivo | Ação |
|---------|------|
| `src/pages/monitoramento/Mapa.tsx` | Reestruturar 3 abas |
| `src/components/mapa/MapaVistoriasContent.tsx` | Remover filtros de data, adicionar cancelamento |
| `src/hooks/useDesatribuirServico.ts` | Novo hook de cancelamento de atribuição |

