

# Botão "Outras Entradas" no módulo de Vendas

## Resumo

Adicionar um botão "Outras Entradas" ao lado de "Nova Cotação" na página de Cotações. Ao clicar, abre um painel/dropdown com 4 opções (Substituição, Troca Titularidade, Migração, Inclusão), cada uma com busca contextual e redirecionamento ao fluxo correspondente.

## Alterações

### 1. Novo componente: `src/components/vendas/OutrasEntradasMenu.tsx`

Componente que renderiza um `Popover` (ou `DropdownMenu`) com:

- **4 cards/opções** com ícone, título e descrição curta:
  - `ArrowLeftRight` — Substituição de Placa — "O associado trocou de carro e quer passar a proteção para o novo veículo."
  - `Users` — Troca de Titularidade — "O veículo foi vendido e o novo dono quer manter a proteção."
  - `FileInput` — Migração — "O cliente está em outra associação e quer vir para a Praticcar sem perder a carência."
  - `PlusCircle` — Inclusão de Veículo — "O associado já tem um veículo protegido e quer incluir um segundo."

- Ao clicar numa opção, exibe um **campo de busca inline** dentro do popover.

- **Busca contextual**:
  - Substituição e Troca Titularidade: usa `useAssociadoSearch` (associados ativos) — busca por nome, CPF, telefone. Adicionar busca por placa via query separada em `veiculos`.
  - Migração: busca em leads (nome/CPF) ou qualquer CPF — criar query simples em `leads` + fallback de CPF livre.
  - Inclusão: usa `useAssociadoSearch` (associados ativos).

- **Ao selecionar resultado**:
  - Substituição → `navigate(/cadastro/substituicao-veiculo/${associadoId})`
  - Troca Titularidade → abre `TrocaTitularidadeDialog` com o `associadoId` selecionado
  - Migração → abre `MigracaoDiretaDialog` (já existente, recebe CPF pré-preenchido)
  - Inclusão → verifica débitos via `useVerificarDebitosAssociado`. Se ok, navega para cotação com flag de inclusão. Se bloqueado, exibe alerta inline.

- **Bloqueio de Substituição**: ao selecionar associado para substituição, verificar inadimplência via `useVerificarDebitosAssociado`. Se inadimplente, exibir bloqueio com cálculo de Repasse Maior (buscar config `regra_repasse_maior` das configurações).

### 2. Atualizar `src/pages/vendas/Cotacoes.tsx`

- Importar `OutrasEntradasMenu`
- Renderizar ao lado do botão "Nova Cotação", dentro de um `PermissionGate` com permissão `cotacao.canCreate` (mesma do botão Nova Cotação — vendedores CLT, externos e gerência já possuem essa permissão)
- O botão usa `variant="outline"` para se distinguir visualmente do botão principal

### 3. Novo hook: `src/hooks/useBuscaPlaca.ts`

Hook simples que busca em `veiculos` por placa e retorna o `associado_id` vinculado:
```typescript
const { data } = await supabase
  .from('veiculos')
  .select('id, placa, modelo, marca, associado_id, associados(id, nome, cpf, status)')
  .ilike('placa', `%${termo}%`)
  .eq('status', 'ativo')
  .limit(5);
```

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/vendas/OutrasEntradasMenu.tsx` | **Novo** — menu com 4 opções + busca + redirecionamento |
| `src/hooks/useBuscaPlaca.ts` | **Novo** — busca de veículos por placa |
| `src/pages/vendas/Cotacoes.tsx` | Adicionar botão "Outras Entradas" ao header |

Nenhuma alteração de schema necessária. Reutiliza hooks existentes (`useAssociadoSearch`, `useVerificarDebitosAssociado`, `useInclusaoBloqueioDebito`) e dialogs existentes (`TrocaTitularidadeDialog`, `MigracaoDiretaDialog`).

