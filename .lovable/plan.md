# Limpeza do menu Financeiro — consolidar em Cobranças

Remover do sidebar e do roteador os itens redundantes do módulo Financeiro, consolidando o fluxo de cobrança em duas abas dentro de **Cobranças**: **Faturas** e **Régua** (com Emissão como sub-aba).

## O que fica

**Sidebar → Financeiro:**
- Dashboard
- Cobranças (Faturas) — `/financeiro/cobrancas`
- Régua — `/financeiro/cobrancas/regua` (nova rota — engloba Régua + Emissão)
- Chat Cobrança
- Contas a Pagar
- Faturamento
- Extrato
- Contas Bancárias
- Venda Externa

**Sidebar → Comissões:** sem alteração (já tem grupo próprio).

## O que sai do menu (e do roteamento principal)

- Recuperação (`/financeiro/cobrancas/recuperacao`)
- Inadimplentes (`/financeiro/cobrancas/recuperacao/inadimplentes`)
- Fila de Trabalho (`/financeiro/cobrancas/recuperacao/fila`)
- Acordos (`/financeiro/cobrancas/recuperacao/acordos` + `/novo` + `/:id`)
- Negativação (`/financeiro/cobrancas/recuperacao/negativacao`)
- Emissão de Cobranças (`/financeiro/emissao`) → vira **sub-aba** dentro da Régua
- Notificações Cobrança (`/financeiro/notificacoes-cobranca`)
- Extratos Bancários (`/financeiro/extratos-bancarios`)
- Conta Corrente de Comissões (`/financeiro/conta-corrente-comissoes`)
- Comissões (item duplicado dentro do grupo Financeiro)

## Estrutura nova da Régua

```text
/financeiro/cobrancas
 ├── (aba Faturas)  → CobrancasList
 └── /regua  (aba Régua)
       ├── sub-aba "Régua"     → ReguaCobranca (existente)
       └── sub-aba "Emissão"   → EmissaoCobrancas (existente)
```

## Mudanças de código

**`src/components/layout/AppSidebar.tsx`**
- Em `id: 'financeiro'`, remover os items listados acima.
- Renomear destino de "Régua" para `/financeiro/cobrancas/regua`.

**`src/App.tsx`**
- Remover rotas: `recuperacao`, `recuperacao/fila`, `recuperacao/inadimplentes`, `recuperacao/inadimplentes/:id`, `recuperacao/negativacao`, `recuperacao/acordos`, `recuperacao/acordos/novo`, `recuperacao/acordos/:id`, `/financeiro/emissao`, `/financeiro/notificacoes-cobranca`, `/financeiro/extratos-bancarios`, `/financeiro/conta-corrente-comissoes`, `recuperacao/regua`.
- Remover `RedirectInadimplente` e `RedirectAcordo` (componentes de redirect antigos).
- Adicionar nova rota: `<Route path="regua" element={<ReguaPage />} />` dentro de `/financeiro/cobrancas`.
- **Redirects de compatibilidade** (preservar links externos / e-mails antigos):
  - `/financeiro/cobrancas/recuperacao*` → `/financeiro/cobrancas/regua`
  - `/financeiro/emissao` → `/financeiro/cobrancas/regua` (cai na sub-aba Régua; usuário troca para Emissão)
  - `/financeiro/notificacoes-cobranca` → `/financeiro/cobrancas/regua`
  - `/financeiro/extratos-bancarios` → `/financeiro/extrato`
  - `/financeiro/conta-corrente-comissoes` → `/comissoes`
  - `/cobranca/*` antigos: redirecionar para `/financeiro/cobrancas/regua` (em vez do antigo `/recuperacao`).
- Remover imports `lazy(...)` que ficarem sem uso após a limpeza: `CobrancaDashboard`, `FilaTrabalho`, `InadimplentesList`, `InadimplenteDetalhe`, `Negativacao`, `AcordosList`, `NovoAcordo`, `AcordoDetalhe`, `NotificacoesCobranca`, `ExtratosBancarios`, `ComissoesContaCorrente`. (Os arquivos das páginas ficam no projeto, apenas não são roteados — evita risco caso algum hook compartilhado importe deles.)

**`src/pages/financeiro/CobrancasLayout.tsx`**
- Substituir abas "Faturas | Recuperação" por "Faturas | Régua".
- Aba Régua aponta para `/financeiro/cobrancas/regua`.

**`src/pages/financeiro/ReguaPage.tsx` (NOVO)**
- Wrapper com `Tabs` shadcn (sub-abas):
  - "Régua" → renderiza `<ReguaCobranca />`
  - "Emissão de Cobranças" → renderiza `<EmissaoCobrancas />`

**Pequenos ajustes**
- `src/components/layout/GlobalBreadcrumb.tsx`: remover entradas de breadcrumb dos paths removidos; adicionar `'/financeiro/cobrancas/regua': { label: 'Régua' }`.
- `src/hooks/useModuleItemVisibility.ts`: remover entradas `'/financeiro/extratos-bancarios'` e `'/financeiro/conta-corrente-comissoes'`; adicionar `'/financeiro/cobrancas/regua'` se necessário.
- `src/pages/financeiro/FinanceiroDashboard.tsx`: trocar `navigate('/financeiro/extratos-bancarios')` por `navigate('/financeiro/extrato')`.
- `src/pages/financeiro/ExtratoDetalhe.tsx`: idem (2 ocorrências).

## Fora do escopo
- Não vou apagar os arquivos `.tsx` das páginas removidas (Inadimplentes, Acordos, Negativação, Notificações Cobrança, Extratos Bancários, ContaCorrenteComissoes) — só removê-los do roteamento e do sidebar. Isso evita quebrar qualquer import lateral. Posso deletar depois se confirmar que não há referência cruzada.
- Não vou mexer no menu **Comissões** — ele continua intacto.

## Arquivos a editar / criar

**Editar**
- `src/components/layout/AppSidebar.tsx`
- `src/App.tsx`
- `src/pages/financeiro/CobrancasLayout.tsx`
- `src/components/layout/GlobalBreadcrumb.tsx`
- `src/hooks/useModuleItemVisibility.ts`
- `src/pages/financeiro/FinanceiroDashboard.tsx`
- `src/pages/financeiro/ExtratoDetalhe.tsx`

**Criar**
- `src/pages/financeiro/ReguaPage.tsx`
