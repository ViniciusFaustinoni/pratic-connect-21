

# Plano: Consolidar menus do sidebar do diretor em grupos colapsaveis

## Contexto

Atualmente o sidebar exibe cada modulo como um grupo colapsavel individual (vendas, cadastro, monitoramento, eventos, etc.). O diretor ve todos eles, resultando em um menu muito longo. A proposta e agrupar em 3 categorias "mae" e remover ouvidoria do sidebar.

## Alteracoes

### 1. `src/components/layout/AppSidebar.tsx` — Reestruturar grupos

Adicionar logica que, **quando o usuario e diretor** (`permissions.isDiretor`), agrupa os `visibleGroups` em 3 super-grupos colapsaveis:

**Comercial** (icone: ShoppingCart)
- Vendas
- Cadastro
- Monitoramento

**Relacionamento** (icone: Users)
- Eventos
- Assistencia 24h
- Oficinas
- Relacionamento (cobranca)

**Administrativo** (icone: Building2)
- Financeiro
- Contabilidade
- Juridico
- Recursos Humanos
- Marketing
- Diretoria
- Documentos
- Relatorios

Cada super-grupo sera um `Collapsible` que ao expandir mostra os sub-grupos originais (tambem colapsaveis), criando uma hierarquia de 2 niveis.

Para usuarios nao-diretores, o comportamento permanece identico ao atual.

### 2. Remover Ouvidoria do sidebar e rotas ERP

- Remover o grupo `ouvidoria` do `menuConfig.groups`
- Remover a cor `ouvidoria` de `MENU_COLORS`
- Remover as rotas ERP de ouvidoria em `App.tsx` (`/ouvidoria`, `/ouvidoria/fila`, `/ouvidoria/nova`, `/ouvidoria/:id`) e seus imports lazy
- Manter as rotas publicas (`/ouvidoria/canal-denuncia`, `/ouvidoria/consulta-protocolo`, `/ouvidoria/pesquisa/:protocolo`) e as rotas do app (`/app/ouvidoria/*`) intactas

### 3. `src/config/modules.ts` — Remover ouvidoria

- Remover `{ id: 'ouvidoria', label: 'Ouvidoria' }` do array `MODULES`
- Remover a entrada `ouvidoria` de `MODULE_ITEMS`

## Estrutura visual (modo expandido, diretor)

```text
▼ Dashboard
▼ Comercial
  ▼ Vendas
    Leads, Cotacao, ...
  ▼ Cadastro
    Propostas, Associados, ...
  ▼ Monitoramento
    Equipe, Servicos de Campo, ...
▼ Relacionamento
  ▼ Eventos
    Dashboard, Sinistros, ...
  ▼ Assistencia 24h
    Dashboard, Chamados, ...
  ▼ Oficinas
    ...
  ▼ Relacionamento
    ...
▼ Administrativo
  ▼ Financeiro
    ...
  ▼ Contabilidade
    ...
  ▼ Juridico
    ...
  ... (demais)
⚙ Configuracoes
```

## Detalhes tecnicos

- Os super-grupos terao seu proprio estado `openSuperGroups` separado de `openGroups`
- No modo colapsado (icones), os super-grupos aparecem como icones com popover mostrando os sub-menus
- O super-grupo que contem o grupo ativo abre automaticamente
- Renderizacao condicional: `permissions.isDiretor ? renderSuperGroups() : renderFlatGroups()`

## Arquivos modificados

- `src/components/layout/AppSidebar.tsx` — Logica de super-grupos + remover ouvidoria
- `src/App.tsx` — Remover rotas ERP ouvidoria
- `src/config/modules.ts` — Remover ouvidoria

