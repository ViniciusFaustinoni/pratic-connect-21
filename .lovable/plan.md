

## Plano: Auditoria de Rotas e Limpeza de Caminhos Mortos

### Resumo da Auditoria

Analisei todas as ~180 rotas em `App.tsx`, cruzando com o sidebar (`AppSidebar.tsx`), breadcrumbs, e referências internas em todo o código. Abaixo estão as categorias encontradas.

---

### 1. REDIRECTS OBSOLETOS (podem ser removidos)

Rotas que redirecionam para outras rotas, mas **nenhum link no sistema aponta para elas** -- existem apenas como legado:

| Rota | Redireciona para | Referências |
|---|---|---|
| `/vendas/cotacao` | `/vendas/cotacoes` | Apenas App.tsx |
| `/vendas/cotador` | `/vendas/cotacoes` | Apenas App.tsx |
| `/vendas/propostas` | `/vendas/equipe-comercial` | Apenas App.tsx |
| `/monitoramento/instalacoes` | `/monitoramento/vistorias-instalacoes-mon` | Apenas App.tsx |
| `/monitoramento/encaixes` | `/monitoramento/vistorias-instalacoes-mon` | Apenas App.tsx |
| `/monitoramento/gestao-rotas` | `/diretoria/vistorias-instalacoes` | Apenas App.tsx |
| `/monitoramento/rotas` | `/diretoria/vistorias-instalacoes` | Apenas App.tsx |
| `/monitoramento/estoque` | `/monitoramento/rastreadores` | Apenas App.tsx |
| `/monitoramento/config-plataformas` | `/configuracoes/integracoes` | Apenas App.tsx |
| `/monitoramento/vistorias` | `/monitoramento/vistorias-instalacoes-mon` | Apenas App.tsx |
| `/monitoramento/retiradas` | `/monitoramento/vistorias-instalacoes-mon` | Apenas App.tsx |
| `/diretoria/rotas` | `/diretoria/vistorias-instalacoes` | Apenas App.tsx |
| `/diretoria/gestao-rotas` | `/diretoria/vistorias-instalacoes` | Apenas App.tsx |
| `/diretoria/gestao-vistorias-instalacoes` | `/diretoria/vistorias-instalacoes` | Apenas App.tsx |
| `/diretoria/regras-venda` | `/diretoria/gestao-comercial` | Apenas App.tsx |
| `/diretoria/produtos` | `/diretoria/gestao-comercial` | Apenas App.tsx |
| `/diretoria/planos-beneficios` | `/diretoria/gestao-comercial` | Apenas App.tsx |
| `/diretoria/precos` | `/diretoria/gestao-comercial` | Apenas App.tsx |
| `/configuracoes/usuarios` | `/configuracoes/usuarios-acessos` | Apenas App.tsx |
| `/configuracoes/perfis` | `/configuracoes/usuarios-acessos?tab=perfis` | Apenas App.tsx |
| `/configuracoes/logs` | `/configuracoes/usuarios-acessos?tab=logs` | Apenas App.tsx |
| `/configuracoes/rateio` | `/diretoria/gestao-comercial` | Apenas App.tsx |
| `/configuracoes/empresas-sindicancia` | `/eventos/sindicantes` | Apenas App.tsx |
| `/financeiro/dashboard` | `FinanceiroDashboard` (duplicata de `/financeiro`) | Apenas breadcrumb |

### 2. ROTAS SEM LINK NO SIDEBAR (existem mas nao acessiveis por navegação normal)

Rotas que tem componente real mas **nenhum item no sidebar aponta para elas**:

| Rota | Componente | Acessivel via |
|---|---|---|
| `/vendas/acompanhamento` | `Acompanhamento` | Nenhum link encontrado |
| `/vendas/contratos` | `Contratos` | Links internos (cotação, leads) |
| `/vendas/vendedores` | `Vendedores` | Nenhum item no sidebar |
| `/vendas/configuracoes` | `VendasConfig` | Nenhum link |
| `/vendas/relatorios` | `RelatoriosVendas` | relatoriosConfig.ts |
| `/monitoramento/realizar-vistoria` | `Vistorias` | Nenhum link |
| `/monitoramento/vistorias-instalacoes` | `VistoriasInstalacoes` | Nenhum link (mon version exists) |
| `/monitoramento/vistorias-manutencao` | `VistoriasManutencao` | Nenhum link |
| `/monitoramento/configuracoes/regioes` | `RegioesAtendimento` | Nenhum link no sidebar |
| `/monitoramento/vistorias-prestadores` | `VistoriasPrestadoresDashboard` | Nenhum link |
| `/cadastro/documentos` | `Documentos` | Nenhum link no sidebar |
| `/cadastro/gerar-termo` | `GerarTermo` | Nenhum link |
| `/cadastro/migracoes` | `ProcessosOperacionais` (duplicata de /cadastro/processos) | Nenhum link |
| `/marketing/landing-pages` | `LandingPages` | Nenhum link no sidebar |
| `/marketing/materiais` | `Materiais` | Nenhum link no sidebar |
| `/marketing/comunicacao` | `ComunicacaoMassa` | Nenhum link no sidebar |
| `/marketing/redes-sociais` | `RedesSociais` | Nenhum link no sidebar |
| `/diretoria/solicitacoes-ia` | `SolicitacoesIA` | Nenhum link no sidebar |
| `/diretoria/campanhas` | `CampanhasDesconto` | Nenhum link no sidebar |
| `/diretoria/rateios` | `RateioSinistros` | Link no dashboard diretoria |
| `/diretoria/usuarios` + sub-rotas | `UsuariosPage` | Nenhum item no sidebar |
| `/financeiro/extrato-associado` | `ExtratoAssociado` | Nenhum link |
| `/monitoramento/alertas` | `AlertasMonitoramento` | Sidebar diz "removido temporariamente" |

### 3. DUPLICAÇÕES FUNCIONAIS

| Rota A | Rota B | Mesmo componente? |
|---|---|---|
| `/financeiro` | `/financeiro/dashboard` | Sim (`FinanceiroDashboard`) |
| `/cadastro/processos` | `/cadastro/migracoes` | Sim (`ProcessosOperacionais`) |
| `/eventos/pre-analise` | `/eventos/solicitacoes-ia` | Sim (`EventosPreAnalise`) |
| `/monitoramento/vistorias-instalacoes` | `/monitoramento/vistorias-instalacoes-mon` | Diferentes componentes, funcao similar |
| `/cobranca/chat` | `/eventos/chat-ia` | Sim (`EventosChatIA`) |

### 4. ARQUIVO MORTO

- `src/pages/diretoria/RegrasVenda.tsx` -- apenas redireciona, pode ser deletado

---

### Plano de Correção

**Etapa 1: Remover 24 redirects obsoletos do App.tsx**
- Remover todas as rotas da tabela 1 acima que apenas redirecionam e nao tem referencia externa

**Etapa 2: Remover duplicatas**
- `/financeiro/dashboard` -- remover (manter `/financeiro`)
- `/cadastro/migracoes` -- remover (duplicata de `/cadastro/processos`)
- `/eventos/pre-analise` -- redirecionar para `/eventos/solicitacoes-ia` ou vice-versa (manter 1)

**Etapa 3: Remover rotas sem acesso e sem referências internas**
- `/vendas/acompanhamento` + componente `Acompanhamento`
- `/vendas/configuracoes` + componente `VendasConfig`
- `/monitoramento/realizar-vistoria` + componente `Vistorias`
- `/monitoramento/vistorias-instalacoes` + componente `VistoriasInstalacoes` (manter apenas a versão `mon`)
- `/monitoramento/vistorias-manutencao` + componente `VistoriasManutencao`
- `/monitoramento/configuracoes/regioes` + componente `RegioesAtendimento`
- `/monitoramento/vistorias-prestadores` + componente `VistoriasPrestadoresDashboard`
- `/cadastro/documentos` + componente `Documentos`
- `/cadastro/gerar-termo` + componente `GerarTermo`
- `/financeiro/extrato-associado` + componente `ExtratoAssociado`

**Etapa 4: Remover arquivo morto**
- Deletar `src/pages/diretoria/RegrasVenda.tsx`

**Etapa 5: Manter mas NÃO remover (tem referências internas)**
- `/vendas/contratos` -- usado em cotacoes, leads, funil
- `/vendas/vendedores` -- usado em auditoria, config de usuarios
- `/vendas/relatorios` -- usado em relatoriosConfig.ts
- `/marketing/landing-pages`, `/marketing/materiais`, `/marketing/comunicacao`, `/marketing/redes-sociais` -- funcionalidades futuras, manter
- `/diretoria/solicitacoes-ia`, `/diretoria/campanhas`, `/diretoria/rateios`, `/diretoria/usuarios` -- usados em dashboards internos
- `/monitoramento/alertas` -- usado pelo AlertasWidget

**Etapa 6: Limpar imports lazy nao utilizados em App.tsx**

### Arquivos afetados
- **Editar**: `src/App.tsx` (remover ~30 rotas + ~10 imports lazy)
- **Editar**: `src/components/layout/GlobalBreadcrumb.tsx` (remover entradas mortas)
- **Editar**: `src/hooks/useModuleItemVisibility.ts` (remover mapeamentos mortos)
- **Deletar**: `src/pages/diretoria/RegrasVenda.tsx`
- **Deletar**: ~8-10 componentes de página sem referência (Acompanhamento, VendasConfig, Vistorias, VistoriasInstalacoes, VistoriasManutencao, etc.)

