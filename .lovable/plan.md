## Objetivo
Adicionar item **Cobranças** na sidebar do módulo **Relacionamento** que abre direto a tela do print: `Financeiro › Cobranças › Régua` com a sub-aba **Emissão de Cobranças** ativa (e dentro dela a aba **Importar CSV (SGA)**).

## Mudanças

### 1. `src/components/layout/AppSidebar.tsx` (bloco `id: 'relacionamento'`, ~linha 249)
Adicionar item após "Chat":
```ts
{ title: 'Cobranças', url: '/financeiro/cobrancas/regua?tab=emissao&sub=csv', icon: Receipt },
```
(import de `Receipt` do lucide-react já é usado em outros pontos; reaproveitar.)

### 2. `src/pages/financeiro/ReguaPage.tsx`
Ler `?tab=emissao|regua` via `useSearchParams` para definir o estado inicial da sub-aba. Mantém default `regua` quando ausente, garantindo que o link da sidebar do Relacionamento caia direto em **Emissão de Cobranças**.

### 3. `src/pages/financeiro/EmissaoCobrancas.tsx`
Ler `?sub=csv|fechamento` para inicializar `tab` (default `fechamento` quando ausente). Assim a sidebar leva o usuário direto à aba "Importar CSV (SGA)" mostrada no print.

### 4. `src/components/layout/GlobalBreadcrumb.tsx`
Sem alterações — a rota `/financeiro/cobrancas/regua` já existe e tem breadcrumb. Os query params não interferem.

## Não incluído
- Não duplicar a página de Emissão. É o mesmo destino, apenas atalho contextual no Relacionamento.
- Não alterar permissões: o item só aparece para quem já tem acesso ao módulo Relacionamento; quem não tiver permissão financeira verá a página com guard padrão da rota existente.

## Validação
1. Login como diretor.
2. Sidebar Relacionamento → clicar em **Cobranças**.
3. Conferir que abre em `/financeiro/cobrancas/regua?tab=emissao&sub=csv` com as abas **Régua → Emissão de Cobranças → Importar CSV (SGA)** já selecionadas (idêntico ao print).
4. Acessar `/financeiro/cobrancas/regua` direto continua abrindo na sub-aba **Régua** (default preservado).
