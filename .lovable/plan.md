# Correção: Vendedores enxergando dados de toda a empresa

## Diagnóstico (causa raiz)

Vendedores (`vendedor_clt`, `vendedor_externo`, `agencia`) são cadastrados em `profiles` com `tipo = 'funcionario'`. Várias políticas RLS usam `is_funcionario(auth.uid())` como porta de acesso, e essa função **só checa `profiles.tipo = 'funcionario'`** — ignorando o `role` real. Resultado: vendedores recebem acesso de "staff completo" em:

| Tabela | Política aberta hoje | Efeito para vendedor |
|---|---|---|
| `associados` | `Staff can view all associates` / `Staff can manage associates` (`is_funcionario`) | Vê e edita TODOS os associados |
| `veiculos` | `Staff can manage vehicles` / `View vehicles` (`is_funcionario`) | Vê e edita TODOS os veículos |
| `contratos` | `Staff can view contracts` (`is_funcionario`) | Vê TODOS os contratos |
| `servicos` | `Funcionarios podem gerenciar/ver servicos` (`am_i_funcionario`) | Vê e edita TODOS os serviços |

A tabela `cotacoes` já está correta (usa `vendedor_id = auth.uid()` + `can_view_all_cotacoes` que exclui vendedores), e `instalacoes` também (usa `has_role` específico).

Confirmado em produção: 154 vendedores CLT + 36 externos + 36 agências, todos com `profiles.tipo='funcionario'`.

## Estratégia

Criar um conceito explícito de **"funcionário interno NÃO-vendedor"** em SQL e trocar todas as policies abertas por escopo correto. Vendedores passam a enxergar apenas linhas vinculadas a algum vendedor_id deles (direta ou indiretamente via associado/contrato).

### 1) Novas funções SECURITY DEFINER

- `is_funcionario_interno(_user_id uuid)` → true apenas se `profiles.tipo='funcionario'` E o usuário **não tem** nenhum dos roles `vendedor_clt`, `vendedor_externo`, `agencia` (e está ativo). Esta substitui `is_funcionario` em policies de "staff geral".
- `is_vendedor_nao_gestor(_user_id uuid)` → true se for `vendedor_clt`/`vendedor_externo`/`agencia` e NÃO tiver `gerente_comercial`/`supervisor_vendas`/`diretor`/`admin_master`.
- `get_vendedor_associado_ids(_user_id uuid)` → SETOF uuid: retorna IDs de associados visíveis ao vendedor a partir de:
  - `cotacoes.vendedor_id = profile_id` → associado_id
  - `contratos.vendedor_id = profile_id` ou `contratos.created_by = profile_id` → associado_id
  - `associados.vendedor_original_id = profile_id`

Manteremos `is_funcionario` (algumas policies legítimas dependem dela para incluir associados acessando próprios dados), mas trocamos as policies sensíveis para `is_funcionario_interno`.

### 2) Substituição de RLS

**`associados`**
- Substituir `Staff can view all associates` → permitir se `is_funcionario_interno(auth.uid())` OU `user_id = auth.uid()` OU `id IN get_vendedor_associado_ids(auth.uid())`.
- Substituir `Staff can manage associates` (ALL) → restringir a `is_funcionario_interno` (vendedor não pode dar UPDATE/DELETE em qualquer associado).
- Adicionar policy UPDATE: `Vendedor pode atualizar seus associados` com `id IN get_vendedor_associado_ids(...)`.

**`veiculos`**
- `View vehicles` → `is_funcionario_interno(auth.uid()) OR associado_id IN get_vendedor_associado_ids(auth.uid()) OR associado_id = get_my_associado_id(auth.uid())`.
- `Staff can manage vehicles` (ALL) → restringir a `is_funcionario_interno`.
- Nova policy INSERT/UPDATE para vendedores limitada aos seus associados.

**`contratos`**
- `Staff can view contracts` → `is_funcionario_interno(auth.uid()) OR vendedor_id = get_current_profile_id() OR created_by = get_current_profile_id()`.
- Mantém policies existentes "Sales can update own contracts" e "Staff with sales role can insert contracts".

**`servicos`**
- `Funcionarios podem ver servicos` → `is_funcionario_interno(auth.uid()) OR associado_id IN get_vendedor_associado_ids(auth.uid())`.
- `Funcionarios podem gerenciar servicos` (ALL) → restringir a `is_funcionario_interno`.

### 3) Ajustes correlatos

Auditar e corrigir, com o mesmo padrão `is_funcionario_interno`, qualquer outra tabela cujo SELECT use `is_funcionario` e contenha dados sensíveis cross-vendedor:
- `documentos_associado`, `assinaturas`, `pagamentos`, `mensalidades`, `comissoes` (se houver), `historico_*`, `leads`, `propostas`, `rastreadores`, `instalacoes_links_publicos` etc.

Migração varre `pg_policies` listando todas que usam `is_funcionario(auth.uid())` em SELECT/UPDATE/DELETE para revisão; apenas as tabelas sensíveis ao escopo do vendedor terão policies reescritas. Tabelas puramente operacionais internas (configs, catálogos, parâmetros) permanecem com `is_funcionario` se for desejável que vendedor leia (ex.: catálogo de planos).

### 4) Verificação no frontend

A maioria das telas (Cotações, Funil) já filtra por `vendedor_id` no hook quando o usuário é vendedor não-gestor (ver `useFunilCotacao.ts`). Garantir que também as telas de **Associados**, **Veículos**, **Contratos** e **Serviços** apliquem o mesmo escopo no `select` (defesa em profundidade, embora a RLS já bloqueie). Ajustar:
- `useAssociados`/`useAssociadosList` → quando `isVendedorNaoGestor`, filtrar por associados vinculados.
- `useContratos` → idem.
- `useVeiculos` (se houver listagem global) → idem.

### 5) QA pós-deploy

1. Login como vendedor de teste (criar um se necessário).
2. Conferir que listas de Associados, Veículos, Contratos, Serviços só mostram registros vinculados.
3. Conferir que admin/diretor continua vendo tudo.
4. Conferir que o associado público continua vendo só os próprios dados.
5. Rodar `supabase--linter` para confirmar que não introduzimos warnings novos.

## Arquivos / artefatos

- **Migração SQL nova** (criar funções + recriar policies das 4 tabelas principais + qualquer correlata identificada na varredura).
- **Hooks frontend** ajustados para filtragem explícita por vendedor onde aplicável.
- Sem mudanças em rotas/UI.

## Riscos / mitigação

- Risco de quebrar fluxos públicos (token de contrato, link de vistoria): policies públicas existentes (`token_publico`, `link_token`) são mantidas intactas.
- Risco de bloquear funcionários internos legítimos: `is_funcionario_interno` exclui apenas vendedores; analistas, coordenadores etc. continuam com acesso total.
- Risco de quebrar vendedor-gestor (supervisor/gerente): mantemos as policies `can_view_all_cotacoes`/`is_gerencia` e estendemos a lógica de `is_vendedor_nao_gestor` para que gestores enxerguem amplo.
