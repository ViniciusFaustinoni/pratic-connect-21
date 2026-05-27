## Objetivo

Hoje, no drawer de detalhes em **Relacionamento › Análises**, os botões "Ficha do Associado / Veículo / Financeiro / Histórico" usam `<Link>` e tiram o usuário da tela do Relacionamento (caem em Cadastro, Financeiro etc.). A operadora deve resolver o caso **sem sair do setor** — a visualização precisa ser nativa, dentro do próprio drawer.

## Escopo

Arquivo único: `src/components/relacionamento/AnaliseRelacionamentoDrawer.tsx`.
Sem mudança de schema, edge functions, rotas ou outros setores. Apenas frontend/presentation.

## O que muda

1. Trocar o bloco **"Acessos rápidos"** (5 botões `<Link>`) por um componente de **abas internas** (`Tabs` do shadcn) renderizadas dentro do próprio `SheetContent`. Abas:
   - **Associado** — dados pessoais (nome, CPF, contato, endereço, status) reaproveitando `useAssociados` / `getAssociadoById`.
   - **Veículo** — placa, marca/modelo, FIPE, chassi, status, rastreador vinculado (via `useVeiculos` filtrado por `analise.veiculo_id`).
   - **Financeiro** — lista enxuta de cobranças/mensalidades do associado (read-only) reaproveitando o hook já existente em `src/hooks` que serve a tela de Cobranças por associado.
   - **Histórico** — timeline via `useAssociadoHistoricoCompleto(analise.associado_id)`.
2. Cada aba é **read-only** e renderizada inline (cards densos compatíveis com a largura do `Sheet sm:max-w-2xl`). Nada de iframe; só consumo dos hooks que já existem.
3. Estado de loading/empty/error padrão (`Skeleton` + mensagens curtas).
4. Manter:
   - Cabeçalho com badges, nome, CPF, placa, termo assinado.
   - Card "Termo de cancelamento" (link externo para Autentique permanece — é documento fora do sistema).
   - Card "Tratativa" (Assumir caso, justificativa, anexo, Marcar como resolvido) inalterado.

## Detalhes técnicos

- Adicionar `Tabs/TabsList/TabsTrigger/TabsContent` de `@/components/ui/tabs`.
- Importar hooks já existentes (sem criar novos):
  - `useAssociados` → buscar por `id` ou criar select pontual via `supabase` se mais leve.
  - `useVeiculos` → idem para `analise.veiculo_id`.
  - `useAssociadoHistoricoCompleto` (já existe em `src/hooks/useAssociadoHistoricoCompleto.ts`).
  - Para Financeiro, reaproveitar o hook usado em `src/pages/financeiro/Cobrancas*` (verificar nome exato no momento da implementação — provavelmente `useCobrancasPorAssociado` ou consulta direta a `cobrancas` por `associado_id`).
- Cada aba só dispara fetch quando ativada (lazy via `value` controlado) para não pesar.
- Remover imports não usados (`Link`, `User`, `Car`, `FileText`, `History` se não forem mais necessários como ícones das abas — manter os que virarem ícones do `TabsTrigger`).
- Sem alterações de rota/router.

## Critérios de aceite

- Abrir um caso → ver as 4 abas dentro do drawer; nenhuma navegação para outra página ao clicar.
- A aba Histórico mostra os eventos do associado direto no drawer.
- A aba Financeiro mostra as cobranças do associado direto no drawer.
- O resto do drawer (termo, tratativa, resolver) continua funcionando idêntico.
- Sem regressões em `Relacionamento › Análises` (lista + filtros).

## Fora de escopo

- Editar dados do associado/veículo no drawer (continua read-only — quem edita usa as telas próprias).
- Mudar SGA, financeiro real ou histórico de outros setores.
- Adicionar novos tipos de análise/badges.
