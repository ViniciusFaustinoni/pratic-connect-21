

# Página "Regiões de Atendimento" para Coordenador de Monitoramento

## Resumo

Criar a página `/monitoramento/configuracoes/regioes` que permite ao Coordenador de Monitoramento gerenciar vínculos cidade ↔ vistoriador usando os hooks e tabelas já criados (`useVistoriadorCidades`, `useVistoriadoresPrestadores`, tabela `vistoriador_cidades`).

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/monitoramento/RegioesAtendimento.tsx` | **Criar** — Página completa |
| `src/App.tsx` | **Editar** — Adicionar rota e import |

## Detalhes técnicos

### 1. `RegioesAtendimento.tsx`

Segue o padrão de `PrestadoresParceiros.tsx`:

- **Acesso**: `PermissionGate` com `isCoordenadorMonitoramento`, `isDiretor`, `isAdminMaster`
- **Dados**: 
  - `useVistoriadorCidades()` (sem filtro) para listar todos os vínculos
  - `useVistoriadoresPrestadores()` para popular checkboxes de prestadores
  - Query de profiles com role `instalador_vistoriador` via `user_roles` para popular checkboxes de vistoriadores comuns
- **Tabela**: Agrupa registros por cidade+UF, exibe badge azul/laranja por tipo, nomes dos vistoriadores (2 + tooltip), ações editar/remover
- **Modal**: Dialog com campos cidade (text), UF (select 27 estados), tipo (radio comum/prestador), checkboxes dinâmicos. Ao trocar tipo, limpa seleções
- **Remoção**: AlertDialog de confirmação, chama `desvincular` para cada registro da cidade
- **Estado vazio**: Ícone Map, mensagem, botão adicionar
- **Banner**: Alert com ícone Info, fundo azul claro

### 2. `App.tsx`

Adicionar rota: `<Route path="/monitoramento/configuracoes/regioes" element={<RegioesAtendimento />} />`

