
## Objetivo

Eliminar as rotas dedicadas `/vendas/leads/:id` e `/vendas/leads/:id/editar` e converter ambas em **modais** abertos a partir das listagens (Kanban, tabela de Leads, Dashboard, Marketing, Followup, etc.), preservando 100% das funcionalidades atuais.

---

## Escopo do que será removido

**Páginas a deletar:**
- `src/pages/vendas/LeadDetalhe.tsx` (688 linhas) — detalhe completo do lead com abas
- `src/pages/vendas/LeadEditar.tsx` (655 linhas) — formulário de edição

**Rotas a remover de `src/App.tsx`:**
- `/vendas/leads/:id`
- `/vendas/leads/:id/editar`

**Breadcrumb a limpar em `src/components/layout/GlobalBreadcrumb.tsx`:**
- Entrada `/vendas/leads/:id`

---

## O que será criado

### 1. `LeadDetailModal` (substitui LeadDetalhe.tsx)

Dialog full-screen em mobile / `max-w-5xl` em desktop, com **todo o conteúdo atual** da página de detalhe:

- **Cabeçalho**: avatar, nome, telefone, e-mail, badges de etapa/origem, tempo no funil
- **Cards superiores**: `LeadQuickStats`, `LeadFunnelProgress`, `VeiculoPerfilAlert`
- **Abas (Tabs)**:
  - **Linha do tempo** (`LeadTimeline` + `HistoricoConversaWhatsApp`)
  - **Cotações** vinculadas (lista com `STATUS_COTACAO_LABELS/COLORS`)
  - **Documentos**
  - **Anotações**
- **Ações no header do modal** (DropdownMenu + botões diretos):
  - "Mover etapa" → abre `MoverEtapaModal` empilhado
  - "Gerar cotação" → abre `CotacaoFormDialog` empilhado
  - "Enviar WhatsApp" → ação direta
  - "Gerar proposta" → `BotaoGerarProposta`
  - "Agendar follow-up" → `AgendarFollowupDialog`
  - "Editar" → abre `LeadEditarModal` empilhado (substitui `navigate(.../editar)`)
  - "Excluir" → `AlertDialog` de confirmação

> O `LeadDetailDrawer.tsx` existente (377 linhas, versão resumida em Sheet) será **descontinuado e excluído** — o novo modal cobre tudo o que ele fazia e mais.

### 2. `LeadEditarModal` (substitui LeadEditar.tsx)

Dialog `max-w-3xl` com o formulário completo atual:

- Dados cadastrais (nome, telefone, email, CPF, etc.)
- Dados do veículo
- Atribuição de vendedor
- Etapa, origem, observações
- Botões Salvar / Cancelar
- Ao salvar: invalida queries e fecha o modal (sem navegação)

### 3. Hook/Context global de modal de Lead

Criar `useLeadModals()` (Zustand ou Context simples) com API:

```ts
openLeadDetail(leadId: string)
openLeadEdit(leadId: string)
closeLeadModals()
```

Montar `<LeadModalsProvider>` no `App.tsx` envolvendo as rotas autenticadas, para que qualquer página possa abrir o modal sem prop drilling.

---

## Arquivos a atualizar (substituir `navigate(...)` por `openLeadDetail/openLeadEdit`)

| Arquivo | Mudança |
|---|---|
| `src/pages/vendas/Leads.tsx` (linhas 520, 604, 611-615) | Tabela: clique na linha e ações "Ver"/"Editar" abrem modal |
| `src/pages/vendas/LeadKanban.tsx` (linha 237) | Card: clique abre detalhe; "Editar" abre edição |
| `src/pages/vendas/LeadsUnificado.tsx` | Idem |
| `src/pages/vendas/VendedorHistorico.tsx` (linha 292) | Linha de histórico abre detalhe |
| `src/pages/vendas/VendasDashboard.tsx` (linha 570) | Mantém link para listagem (não é detalhe individual) |
| `src/components/vendas/FollowupWidget.tsx` (linhas 58, 93) | Link individual → abre modal; link de listagem mantém |
| `src/components/cotacoes/CotacaoClienteVeiculo.tsx` (linha 134) | Link → botão que abre modal |
| `src/components/leads/LeadDetailDrawer.tsx` | **Excluir** (substituído pelo novo modal) |
| `src/pages/marketing/CanalDetalhe.tsx` (linha 191) | Linha da tabela abre modal |
| `src/pages/marketing/CampanhaDetalhe.tsx` (linha 626) | Idem |
| `src/pages/Dashboard.tsx` (linha 485) | Idem |
| `src/components/layout/GlobalBreadcrumb.tsx` (linha 171) | Remover entrada |

---

## Comportamento e UX

- **Deep-link preservado**: ao acessar uma URL antiga `/vendas/leads/:id` (ex: link compartilhado ou de e-mail), redirecionar para `/vendas/leads?lead=<id>` e o `Leads.tsx` detecta o query param e abre o modal automaticamente. Mesmo para `/vendas/leads/:id/editar` → `?lead=<id>&edit=1`.
- **Modais empilhados**: o detalhe abre cotação, mover etapa, follow-up, editar e confirmação de exclusão sem fechar o modal-pai.
- **Mobile**: o `Dialog` ocupa quase a tela inteira (`h-[95vh] max-w-full`), abas viram scroll vertical.
- **Fechar**: ESC, clique fora ou botão X. Após salvar edição, o modal de edição fecha mas o de detalhe permanece (com dados atualizados via invalidate).

---

## Detalhes técnicos

- Reaproveitar **todo o JSX** atual de `LeadDetalhe.tsx` e `LeadEditar.tsx` movendo-o para os novos componentes; remover apenas `useParams`/`useNavigate` e a moldura de página (breadcrumb interno, botão "Voltar").
- Substituir `useParams<{id}>()` por uma prop `leadId: string`.
- Substituir `navigate(...)` interno por handlers do contexto (`openLeadEdit`, `closeLeadModals`).
- O state `editingLead` já existente em `Leads.tsx` (linha 611) será migrado para o contexto global, eliminando duplicação.
- `MoverEtapaModal`, `CotacaoFormDialog`, `AgendarFollowupDialog`, `AlertDialog` de exclusão continuam como já estão (são dialogs filhos).
- Manter os hooks `useLead`, `useCotacoesByLead`, `useChangeLeadEtapa`, `useLeadActions`, `useCriarCotacaoPublica` exatamente como estão.

---

## Critérios de aceite

1. As rotas `/vendas/leads/:id` e `/vendas/leads/:id/editar` retornam 404 (ou redirecionam para listagem com modal aberto).
2. Em desktop e mobile, todas as origens listadas acima abrem os modais corretamente.
3. Nenhuma funcionalidade descrita (abas, botões, ações, edição) é perdida.
4. Sidebar do diretor (corrigida na iteração anterior) continua funcionando.
5. Build passa sem warnings de import quebrado.
