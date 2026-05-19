
## O que aconteceu (raiz do bug)

A cotação **existe sim** no banco:

- `id`: `c46ba7dc-24cc-425b-a88c-389a3d3f04e6`
- `numero`: `COT-20260519-095712313-060`
- `status`: `rascunho`, `status_contratacao`: `aguardando`
- `vendedor_id`: `283907ed-9b43-4ecb-aa21-54a93fe787a5` → **auth.users.id** da **THAÍS DE SOUZA FIGUEIREDO** (profile `107b60dc-…`)
- `nome_solicitante`: `Leandro`, `veiculo_placa`: `PYL9A01`

Ou seja: **não é "invisível"** — é uma rascunho legítima da Thaís, criada há minutos. O que confunde é o conjunto de bugs abaixo, todos pela mesma causa: **`cotacoes.vendedor_id` guarda `auth.users.id`** (convenção histórica — 100% dos 80 maiores `vendedor_id` da tabela batem com `profiles.user_id`, **0 batem com `profiles.id`**), mas vários consumidores comparam contra `profiles.id`.

### Bug 1 — Nome do consultor some no modal

`src/hooks/useVerificarPlaca.ts` (linha 88):
```ts
.eq('id', cotacao.vendedor_id)  // ❌ deveria ser .eq('user_id', …)
```
Não encontra o perfil → cai no fallback `Consultor (283907ed)` que aparece no print. Por isso parece que o dono é desconhecido / órfão.

### Bug 2 — Mesmo dono é tratado como "outro consultor"

`Cotador.tsx:709` e `CotacaoFormDialog.tsx:1032`:
```ts
if (placaDuplicada.vendedorId !== profile?.id) { … abre modal "outro consultor" … }
else { toast.info("Você já possui…") }
```
Como `vendedorId` é `auth.users.id` e `profile?.id` é o id da tabela `profiles`, **nunca** são iguais. Resultado: até a própria Thaís, se reabrisse a cotação rápida pela placa dela, levaria o modal "Placa Já em Atendimento" e seria empurrada para "outro consultor".

### Bug 3 — Sem saída para placa presa

O `PlacaDuplicadaModal` aceita `onIgnorarEProsseguir` (bypass de diretor), mas o `Cotador.tsx` (linha 2203) **não passa esse callback** — só o `CotacaoFormDialog` passa. Por isso o print só mostra "Entendido". Além disso, o modal não tem:

- Botão "Abrir cotação" para navegar até ela.
- Botão "Cancelar rascunho e liberar a placa" (para gestor/diretor).

### Bug 4 — Visibilidade na lista

A cotação aparece para quem está com `viewScope = 'team'/'all'` (gestor/diretor) ao filtrar por `PYL9A01`. Para um consultor com `viewScope='own'` cujo `userId` é diferente do da Thaís, ela é filtrada server-side em `useCotacoes` (`vendedor_id = effectiveVendedorId`) — daí a sensação de "invisível" quando outro vendedor abre o cotador rápido e recebe o bloqueio sem ter como ver a cotação.

---

## Plano de correção (somente UI/hooks, sem mudar schema)

### 1. `src/hooks/useVerificarPlaca.ts`
- Trocar `.from('profiles').select('nome, email').eq('id', vendedor_id)` por `.eq('user_id', vendedor_id)`.
- Retornar também `vendedorUserId` (auth) no `PlacaDuplicadaInfo` — separado de `vendedorId` (id da cotação, que vai virar alias `vendedorUserId` para ficar explícito).
- Já que o campo `vendedorId` no objeto retornado representa o `auth.users.id`, renomear no tipo para deixar isso claro (`vendedorUserId`) e ajustar os dois callers.

### 2. Callers do modal — comparar com `user?.id` (auth), não `profile?.id`
Arquivos:
- `src/pages/vendas/Cotador.tsx:709`
- `src/components/cotacoes/CotacaoFormDialog.tsx:1032`

Trocar `placaDuplicada.vendedorId !== profile?.id` por `placaDuplicada.vendedorUserId !== user?.id` (usando o `user` já disponível via `useAuth`).

### 3. `PlacaDuplicadaModal` — saídas para a placa presa
Adicionar dois botões ao lado de "Entendido":

- **"Abrir cotação"** — sempre visível. `navigate(`/vendas/cotacoes?cotacaoId=${info.cotacaoId}`)` (ou rota equivalente que já abre o drawer da cotação). Permite ao gestor/diretor ver de quem é e tomar ação na tela completa.
- **"Cancelar rascunho e liberar"** — visível apenas para perfis com `permissions.cotacao.viewScope !== 'own'` (gestor/coord/diretor). Faz `UPDATE cotacoes SET status='recusada', motivo_cancelamento='Liberação manual de placa', cancelada_em=now() WHERE id = info.cotacaoId AND status='rascunho'`, invalida queries e fecha o modal. Confirmação inline (segundo clique) para evitar acidente.

### 4. `Cotador.tsx` — passar `onIgnorarEProsseguir`
Mesma lógica que já existe no `CotacaoFormDialog`: se o usuário tem permissão de bypass (diretor), passar o callback para o modal mostrar "Ignorar e Prosseguir" (usa o fluxo de `IgnorarAvisoSGADialog` já implementado).

### 5. Lista de Cotações — facilitar achar rascunho de outro
Em `src/pages/vendas/Cotacoes.tsx`, quando o usuário tem `viewScope !== 'own'` e há `searchTerm` que parece placa, garantir que o filtro de status default inclua `rascunho` (já inclui via `em_andamento`, mas confirmar que `filtroOrfas`/aba padrão não esconde rascunhos sem `nome_solicitante` completo). Só ajuste cosmético se precisar.

### 6. Limpeza pontual deste caso
Após deploy, marcar a rascunho `c46ba7dc-…` como `recusada` com `motivo_cancelamento='Liberação manual — fluxo de teste'` para destravar a placa `PYL9A01` agora (via migration única de UPDATE, ou pelo novo botão depois que estiver no ar).

---

## Fora do escopo

- Não vamos mudar a convenção de `cotacoes.vendedor_id` (continua `auth.users.id`) — isso afetaria comissões/relatórios. Só padronizamos a leitura.
- Sem alterar RLS, schema ou regras de 48h.
- Sem mexer em `useCotacao` (já usa `user_id` corretamente).
