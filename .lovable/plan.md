

## Plano: Painel de Acionamentos Roubo/Furto para Analista de Monitoramento

### Contexto

Atualmente, acionamentos de roubo/furto (`acionamentos_roubo_furto`) existem no banco e podem ser criados via sinistros, mas **não existe uma página dedicada** para o analista de monitoramento visualizar, analisar e aprovar/autorizar esses acionamentos. O hook `useAcionamentosAtivos()` já busca acionamentos com status `solicitado/autorizado/enviado/confirmado` com joins em veículos, rastreadores e associados.

### O que será criado

**1. Nova página: `src/pages/monitoramento/AcionamentosRouboFurto.tsx`**

Painel completo com:
- **Contadores no topo**: Solicitados (aguardando análise), Ativos (em rastreamento), Encerrados hoje, Total do mês
- **Filtros**: Por status (solicitado, autorizado, enviado, confirmado, encerrado, erro), por tipo de origem
- **Tabela/cards** listando todos os acionamentos com: placa do veículo, associado, status (badge colorido), data da solicitação, protocolo externo, origem, última posição
- **Ações do analista**:
  - **Autorizar** acionamento (mudar status de `solicitado` para `autorizado`)
  - **Encerrar** acionamento (com motivo)
  - **Ver no mapa** (link para Google Maps com última posição)
  - **Registrar recuperação** (reutilizar `RegistrarRecuperacaoModal`)
- Refetch automático a cada 30s para acionamentos ativos

**2. Novo hook: `src/hooks/useAcionamentosRouboFurtoPage.ts`**

- `useAcionamentosTodos()`: busca todos os acionamentos com filtros (status, data, tipo_origem) + joins em veículos/associados/rastreadores
- `useAutorizarAcionamento()`: mutation para alterar status para `autorizado` registrando quem autorizou
- Reutilizar `useEncerrarAcionamento()` já existente

**3. Adicionar rota e menu**

- Nova rota em `App.tsx`: `/monitoramento/acionamentos-roubo`
- Novo item no sidebar em `AppSidebar.tsx` dentro do grupo Monitoramento: "Acionamentos Roubo/Furto" com ícone `ShieldAlert`
- Breadcrumb em `GlobalBreadcrumb.tsx`

**4. Permissão**

- Usar a permission existente `canManageRastreadores` (já associada ao coordenador de monitoramento) ou adicionar uma nova `canManageAcionamentos` no `usePermissions.ts`
- O item de menu ficará visível apenas para quem tem essa permissão

### Arquivos afetados

- `src/pages/monitoramento/AcionamentosRouboFurto.tsx` (novo)
- `src/hooks/useAcionamentosRouboFurtoPage.ts` (novo)
- `src/hooks/useAcionamentoRoubo.ts` (adicionar mutation `useAutorizarAcionamento`)
- `src/App.tsx` (nova rota)
- `src/components/layout/AppSidebar.tsx` (novo item menu)
- `src/components/layout/GlobalBreadcrumb.tsx` (breadcrumb)

