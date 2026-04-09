

## Revisao Completa: Areas Duplicadas no Sistema

### 1. DUPLICACAO FUNCIONAL: `/oficinas` vs `/oficina` (ATIVA)

Ha dois diretórios de paginas para oficinas com funcionalidades sobrepostas:

| Rota no Sidebar (usada) | Pagina | Rota duplicada (morta) | Pagina duplicada |
|---|---|---|---|
| `/oficinas` | `oficinas/Oficinas.tsx` (191L) | `/oficina/credenciadas` | `oficina/OficinasList.tsx` (362L) |
| `/ordens-servico` | `oficinas/OrdensServico.tsx` (128L) | `/oficina/ordens-servico` | `oficina/OrdensServicoList.tsx` (390L) |
| N/A | `oficinas/OrdemServicoDetalhe.tsx` (221L) | `/oficina/ordens-servico/:id` | `oficina/OrdemServicoDetalhe.tsx` (545L) |

O sidebar do diretor aponta para `/oficinas` e `/ordens-servico`. As rotas `/oficina/*` sao acessiveis mas nao linkadas — sao duplicatas orfas.

**Acao**: Remover as 4 rotas `/oficina/*` do App.tsx e os 4 arquivos em `src/pages/oficina/`.

---

### 2. LAZY IMPORTS SEM ROTA (codigo morto)

19 componentes sao importados via `lazy()` no App.tsx mas nunca usados em nenhuma `<Route>`:

| Import | Arquivo | Motivo |
|---|---|---|
| `VendasDashboard` | `vendas/VendasDashboard.tsx` | Substituido pelo Dashboard geral |
| `Cotacao` | `vendas/Cotacao.tsx` | Rota redireciona para `/vendas/cotacoes` |
| `Cotador` | `vendas/Cotador.tsx` | Rota redireciona para `/vendas/cotacoes` |
| `Metas` | `vendas/Metas.tsx` | Sem rota |
| `ContratoDetalhe` | `vendas/ContratoDetalhe.tsx` | Sem rota |
| `Configuracoes` | `Configuracoes.tsx` | Substituido pelo layout |
| `SolicitacoesMigracao` | — | Sem rota |
| `InstalacoesList` | `monitoramento/InstalacoesList.tsx` | Rota redireciona |
| `MonitoramentoEncaixes` | `monitoramento/Encaixes.tsx` | Embutido em VistoriasInstalacoesMon |
| `ConfigPlataformas` | `monitoramento/ConfigPlataformas.tsx` | Rota redireciona para integracoes |
| `FilaVistorias` | `monitoramento/FilaVistorias.tsx` | Sem rota |
| `RetiradasPage` | `monitoramento/RetiradasPage.tsx` | Rota redireciona |
| `GestaoRotas` | `monitoramento/GestaoRotas.tsx` | Embutido em Rotas.tsx |
| `ProdutosGestao` | `diretoria/ProdutosGestao.tsx` | Rota redireciona para gestao-comercial |
| `TabelaPrecos` | `diretoria/TabelaPrecos.tsx` | Rota redireciona para gestao-comercial |
| `PerfisAcesso` | `diretoria/PerfisAcesso.tsx` | Rota redireciona para configuracoes |
| `Usuarios` | configuracoes/Usuarios | Diferente do diretoria/Usuarios |
| `Perfis` | configuracoes/Perfis | Redireciona |
| `Logs` | configuracoes/Logs | Redireciona |
| `RateioConfig` | configuracoes/RateioConfig | Redireciona |

**Acao**: Remover os `lazy()` imports nao utilizados do App.tsx. Arquivos de pagina podem ser mantidos temporariamente (nao aumentam bundle por serem lazy e nunca carregados).

---

### 3. ROTAS REDIRECT EXCESSIVAS

Ha ~15 rotas que sao apenas `<Navigate to="..." replace />`. Estas nao sao duplicacao funcional, mas poluem o roteador. Exemplos:

- `/vendas/cotacao` → `/vendas/cotacoes`
- `/vendas/cotador` → `/vendas/cotacoes`
- `/vendas/propostas` → `/vendas/equipe-comercial`
- `/diretoria/regras-venda` → `/diretoria/gestao-comercial`
- `/diretoria/produtos` → `/diretoria/gestao-comercial`
- `/diretoria/planos-beneficios` → `/diretoria/gestao-comercial`
- `/diretoria/rotas` → `/diretoria/vistorias-instalacoes`
- `/monitoramento/instalacoes` → `/monitoramento/vistorias-instalacoes-mon`
- `/monitoramento/encaixes` → `/monitoramento/vistorias-instalacoes-mon`
- `/monitoramento/estoque` → `/monitoramento/rastreadores`

**Acao**: Manter por agora (podem existir links externos/bookmarks), mas marcar com comentario `// DEPRECATED REDIRECT`.

---

### 4. MONITORAMENTO: `VistoriasInstalacoes` vs `VistoriasInstalacoesMon`

Nao sao duplicatas — sao paginas diferentes:
- `VistoriasInstalacoes.tsx` (677L): Tabela detalhada com filtros avancados, usada em `/monitoramento/vistorias-instalacoes`
- `VistoriasInstalacoesMon.tsx` (108L): Hub com tabs que agrega Instalacoes, Vistorias, Encaixes, etc. Usada em `/monitoramento/vistorias-instalacoes-mon`

Ambas tem rotas ativas e propositos distintos. **Nenhuma acao necessaria**.

---

### Resumo de acoes

1. **Remover 4 rotas `/oficina/*`** do App.tsx e os 4 arquivos em `src/pages/oficina/`
2. **Remover ~19 lazy imports orfaos** do App.tsx (linhas de import apenas)
3. **Opcionalmente deletar arquivos de pagina mortos** (vendas/Cotador.tsx, vendas/VendasDashboard.tsx, diretoria/ProdutosGestao.tsx, diretoria/TabelaPrecos.tsx, etc.)

### Arquivos alterados
- `src/App.tsx` — remover imports e rotas duplicadas
- `src/pages/oficina/` — deletar diretorio inteiro (4 arquivos)

### Nao alterado
- Sidebar (AppSidebar.tsx) — ja aponta para as rotas corretas
- Paginas ativas e funcionalidades
- Rotas redirect (mantidas para compatibilidade)

