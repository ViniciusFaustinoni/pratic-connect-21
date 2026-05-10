## Converter Detalhe de Cotação de Drawer → Modal com Abas

Pesquisei o histórico: a versão "anterior" carregada no chat era uma página (`CotacaoDetalhe.tsx`), não um modal com abas — qualquer versão modal com abas anterior está fora da janela de histórico disponível. Vou então **reconstruir o modal com abas reaproveitando o conteúdo já existente no drawer** (mesmas seções, mesmas ações).

### 1. Novo componente `src/components/cotacoes/CotacaoDetalheModal.tsx`

- Baseado em `Dialog` (shadcn) com `DialogContent` largo: `max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0`.
- Estrutura interna:
  - **Header fixo** (não rolável): `CotacaoHeader` + botão fechar.
  - **Tabs** (shadcn `Tabs`) logo abaixo do header, sticky.
  - **Conteúdo das abas** rolável (`overflow-y-auto flex-1`).
- Reaproveita exatamente os mesmos hooks/states/handlers já implementados em `CotacaoDetalheDrawer.tsx` (sem duplicar lógica de negócio: `useCotacao`, `useCotacaoActions`, mutations, handlers de WhatsApp/PDF/Email/Duplicar/Editar/Vincular/Wizard).

### 2. Abas (4)

```
┌──────────────────────────────────────────────────────┐
│ [Resumo] [Planos] [Cliente & Veículo] [Histórico]    │
└──────────────────────────────────────────────────────┘
```

- **Resumo** — Bloco "Plano Selecionado" (resumo) + `CotacaoAcoes` (Baixar PDF, WhatsApp, Email, Duplicar, Editar, Link Público, Gerar Contrato) + `CotacaoVendedor`.
- **Planos** — Lista/grid de `PlanoCardComparativo` (todos os planos da cotação) com `PlanoDetalhesModal` aninhado.
- **Cliente & Veículo** — `CotacaoClienteVeiculo` + `VincularLeadModal` trigger + `TrocaTitularidadeBadge`.
- **Histórico** — `CotacaoTimeline`.

Os modais filhos (`EnviarEmailModal`, `VincularLeadModal`, `ContratoWizard`, `CotacaoFormDialog`, `DuplicarCotacaoDialog`, `PlanoDetalhesModal`) continuam montados no nível do modal principal (mesma estratégia do drawer atual).

### 3. Substituir uso do drawer

- **`src/pages/vendas/Cotacoes.tsx`**: trocar `<CotacaoDetalheDrawer …>` por `<CotacaoDetalheModal …>` (mesma assinatura `cotacaoId / open / onOpenChange`).
- **`src/pages/vendas/VendedorHistorico.tsx`**: idem (se já usa o drawer; senão, chamar via `?abrir=`).
- **`src/components/cotacoes/CotacaoCard.tsx`**: nenhuma mudança — continua chamando `onOpenDetalhe(cotacao)` / fallback `?abrir=`.
- **`src/App.tsx`**: o `CotacaoDetalheRedirect` continua redirecionando `/vendas/cotacoes/:id` → `?abrir=:id` (modal abre automaticamente). Sem mudança.

### 4. Limpeza

- Arquivar/deletar `src/components/cotacoes/CotacaoDetalheDrawer.tsx` após confirmar que o modal cobre o mesmo conteúdo.
- Manter `CotacaoHeader`, `CotacaoAcoes`, `CotacaoTimeline`, `CotacaoClienteVeiculo`, `CotacaoVendedor`, `PlanoCardComparativo`, `PlanoDetalhesModal` — todos compartilhados.

### Validação

- Clicar em uma cotação na lista → abre **Dialog modal centralizado** com header fixo, 4 abas e conteúdo rolável.
- Aba ativa default: **Resumo**.
- Trocar de aba não fecha o modal nem perde estado.
- ESC / overlay click / botão "X" fecham o modal e limpam `?abrir=` da URL.
- `/vendas/cotacoes/:id` direto → redireciona e abre o modal na aba Resumo.
- Todos os botões (PDF, WhatsApp, Email, Duplicar, Editar, Link Público, Gerar Contrato, Vincular Lead) funcionam dentro do modal.

### Fora de escopo

- Não alterar o conteúdo dos componentes filhos (apenas o invólucro).
- Não mexer em fluxos de Troca de Titularidade nem em `App.tsx` (redirect já está correto).
