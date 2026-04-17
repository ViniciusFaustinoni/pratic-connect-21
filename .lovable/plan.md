

## Resposta às duas perguntas

### 1. Supervisor de Vendas — JÁ EXISTE ✅

Está tudo implementado no sistema:

**Role no banco** (`app_roles_config`):
| role | label | área | sigla |
|---|---|---|---|
| `gerente_comercial` | Gerente Comercial | Comercial | GerC |
| **`supervisor_vendas`** | **Supervisor de Vendas** | **Comercial** | **SupV** |
| `vendedor_clt` | Vendedor CLT | Comercial | VdC |
| `vendedor_externo` | Vendedor Externo | Comercial | VdE |
| `agencia` | Agência | Comercial | Ag |

**Vínculo supervisor → vendedores**: tabela `equipes_comerciais` (`supervisor_id`, `vendedor_id`) com hooks prontos: `useMinhaEquipe`, `useEquipesComerciais`, `useAdicionarVendedorEquipe`, `useRemoverVendedorEquipe`.

**Criação de cotação em nome de vendedor**: já funciona. No `CotacaoFormDialog.tsx` linha 181:
```ts
const podeAtribuirVendedor = isDiretor || isGerente || isSupervisor;
```
O supervisor vê o seletor "Consultor Responsável" e pode atribuir a cotação a qualquer vendedor. A RLS da tabela `cotacoes` também autoriza supervisor a ver/editar cotações da equipe.

**Leads**: RLS usa `is_supervisor_of(...)` — supervisor enxerga leads dos seus vendedores (via `equipes_comerciais`).

**Filtros de UI**: `LeadFilters`, página `/vendas/leads`, `/vendas/comissoes` já têm gates `isSupervisor || isGerencia`.

Flags expostas no front: `isSupervisor` em `usePermissions()` e `useAuth()`.

### 2. Vendedor tipo "Agência" — JÁ EXISTE ✅

- Role `agencia` (sort_order 14, área Comercial).
- `profile.tipo = 'agencia'` — tipo próprio de conta (além de `funcionario`/`associado`/`prestador`).
- Campos CNPJ/razão social/nome fantasia no profile (vs CPF dos demais).
- `ProtectedRoute` redireciona `tipo='agencia'` para `/agencia` (dashboard próprio).
- Fluxo de criação em `UsuarioForm.tsx` trata agência separadamente (CNPJ obrigatório, grade de comissão obrigatória).
- Memória do projeto: `external-consultant-ecosystem-v2` e `commission-and-agency-management` detalham o ecossistema ponta-a-ponta (cotação com 4 cenários, dashboards, comissões recorrentes).

---

## Conclusão

**Nada precisa ser construído.** Os dois recursos já estão implementados e em produção:

- Supervisor de Vendas: role ativo, tabela de equipes, hooks, RLS, filtros de UI e permissão para criar cotação em nome de vendedor.
- Agência: tipo de usuário próprio, área comercial, dashboard dedicado, comissões.

Se você estiver sentindo que **algo não funciona na prática** (ex.: "acessei como supervisor mas não consegui escolher o vendedor X", ou "agência não aparece em algum relatório"), me diga o cenário exato (quem logou, em qual tela, o que esperava) que eu investigo o ponto específico. Caso contrário, o requisito já está atendido.

