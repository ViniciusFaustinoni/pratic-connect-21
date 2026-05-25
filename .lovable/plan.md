# Plan — "Outros Processos" desde a criação

## Diagnóstico

O hook `src/hooks/useOutrosProcessos.ts` **já carrega** trocas e substituições sem cotação (blocos 6 e 7, linhas 384–579). O problema é só de **chave de filtro**:

- `solicitacoes_troca_titularidade.criado_por` guarda **`profiles.id`** (memória canônica do projeto).
- `solicitacoes_substituicao_placa.criado_por` / `consultor_id` — mesma convenção.
- Os filtros em escopo `own` usam `effectiveVendedorId`, que é o **`auth.users.id`** (igual ao usado em `cotacoes.vendedor_id`).

Resultado: para o consultor (escopo `own`), os blocos 6 e 7 nunca casam → a troca da THAÍS (KPJ4994) não aparece enquanto não houver cotação. Para supervisor/diretor (escopo `team`/`all`), os filtros são bypassados → eles veem normalmente. Bate com o sintoma relatado.

## Mudança proposta (uma só, frontend)

Em `src/hooks/useOutrosProcessos.ts`, dentro do `queryFn`, **resolver uma vez** o `profile.id` do vendedor logado e usar nos filtros de solicitações sem cotação. Sem mexer em `cotacoes` (continua filtrando por `vendedor_id` = auth uid, que é o correto).

### Passos

1. **Resolver profile.id quando escopo own**
   - Logo no início do `queryFn`, se `effectiveScope === 'own' && effectiveVendedorId`, fazer um `select id from profiles where user_id = effectiveVendedorId`.
   - Guardar em `selfProfileId`.
   - Idem para `consultorId` quando vier (escopo team/all com filtro de consultor) — resolver o profile.id dele em `targetProfileId`.

2. **Bloco 6 (substituições sem cotação, linhas 393–397)**
   - Substituir `effectiveVendedorId` / `consultorId` por `selfProfileId` / `targetProfileId` no `.or('consultor_id.eq.X,criado_por.eq.X')`.
   - Manter o `.or(...)` (cobre os dois campos).

3. **Bloco 7 (trocas sem cotação, linhas 484–488)**
   - Substituir `.eq('criado_por', effectiveVendedorId)` / `.eq('criado_por', consultorId)` por `.eq('criado_por', selfProfileId)` / `.eq('criado_por', targetProfileId)`.

4. **Vendedor_id do item de saída (linha 543)**
   - Já está correto (`prof?.user_id`) — o `profMap` é populado por `profiles.id` (linha 518), então o `user_id` do profile vai pro item. Sem mudança.

5. **Curto-circuito defensivo**
   - Se `selfProfileId` não resolver (perfil não encontrado), pular os blocos 6/7 para `own` em vez de listar tudo — evita vazamento. Mesmo trato para `targetProfileId`.

### Fora de escopo

- Não alterar `cotacoes.vendedor_id` nem o bloco 1 do hook.
- Não retroagir trocas antigas com `vendedor_id` faltando (caso da THAÍS já tem `criado_por`, que é o que importa aqui).
- Não tocar em `troca-pos-cadastro-bg.ts` — patch já aplicado em mensagem anterior cobre cotações futuras.
- Não tocar em UI/colunas/labels — `ProcessoCard` e `etapa_label` já cobrem os rótulos pedidos no PRD.

## Validação manual

1. Login `vendedorctl@teste.com` (THAÍS) → `/vendas/cotacoes` → aba "Outros Processos".
   - Deve aparecer troca do KPJ4994 (Gabriel → Anderson) com etapa **"Termo pendente"** (ou "Aguardando novo titular" se o Anderson já assinou).
2. Login como supervisor → mesma troca continua aparecendo (escopo `all` inalterado).
3. Criar nova substituição como consultor → aparece imediatamente na aba dele, mesmo antes da cotação.
4. Quando a cotação nascer (via `vincular-cotacao-troca`), a linha "subst-..." ou "troca-..." some e a linha por `cotacao_id` toma o lugar — o item ainda aparece porque `cotacoes.vendedor_id` agora é populado corretamente (patch A já em produção).

## Arquivo tocado

- `src/hooks/useOutrosProcessos.ts` (somente o `queryFn`).
