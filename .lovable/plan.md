# Filtros: Consultor e Tipo de Adesão na aba Associados

## Objetivo
Adicionar dois novos filtros ao painel **Filtros Avançados** da página `/cadastro/associados`:
1. **Consultor (vendedor)** — busca por nome, com select pesquisável.
2. **Tipo de Adesão** — multi-select: Nova Adesão, Inclusão, Substituição, Troca de Titularidade, Reativação, Migração, Indicação.

Ambos serão combináveis com os filtros já existentes (status, plano, cidade, período).

## Modelo de dados (já existente)
- `contratos.vendedor_id` → `profiles.id` (consultor responsável pela venda).
- `contratos.tipo_entrada` (varchar): valores canônicos já usados na base — `adesao`, `inclusao`, `substituicao_placa`, `substituicao` (alias), `troca_titularidade`, `reativacao`, `migracao`, `indicacao`. Labels já existem em `TIPO_ENTRADA_SHORT_LABELS` (`OrigemCadastroCard.tsx`).
- `associados.vendedor_original_id` existe mas é histórico — o vínculo "vivo" do consultor da contratação atual está em `contratos.vendedor_id`. Vamos filtrar por `contratos.vendedor_id` (último contrato vinculado), respeitando a memória `profile-id-as-canonical-commission-key`.

## Mudanças

### 1. `src/components/cadastro/AssociadoFilters.tsx`
- Estender `SheetFiltersValue`:
  ```ts
  vendedor_id?: string;
  tipos_entrada?: string[];
  ```
- Adicionar duas novas props: `vendedores?: { id: string; nome: string }[]` e usar `TIPO_ENTRADA_SHORT_LABELS` para as opções.
- UI:
  - Bloco **Consultor**: `Select` com busca (Combobox baseado em `Command`) listando vendedores ordenados por nome + opção "Todos os consultores".
  - Bloco **Tipo de Adesão**: lista de checkboxes (mesmo padrão do bloco Status) com as 7 opções canônicas.
- Atualizar `handleApply`, `handleLimpar` e `activeCount` para incluir os novos filtros.

### 2. `src/hooks/useAssociados.ts`
- Estender `AssociadoFilters` com `vendedor_id?: string` e `tipos_entrada?: string[]`.
- No `queryFn`, quando algum desses filtros vier preenchido, fazer pré-busca em `contratos`:
  ```ts
  let associadoIdsByContrato: string[] | null = null;
  if (filters?.vendedor_id || filters?.tipos_entrada?.length) {
    let q = supabase.from('contratos').select('associado_id').not('associado_id','is',null);
    if (filters.vendedor_id) q = q.eq('vendedor_id', filters.vendedor_id);
    if (filters.tipos_entrada?.length) {
      // Normaliza alias 'substituicao' ↔ 'substituicao_placa'
      const tipos = expandTipoEntradaAliases(filters.tipos_entrada);
      q = q.in('tipo_entrada', tipos);
    }
    const { data } = await q.limit(50000);
    associadoIdsByContrato = Array.from(new Set((data||[]).map(r=>r.associado_id).filter(Boolean)));
    if (associadoIdsByContrato.length === 0) {
      // sem matches → retorna vazio
      return { associados: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    }
    query = query.in('id', associadoIdsByContrato);
  }
  ```
- Helper `expandTipoEntradaAliases` no próprio arquivo: se o array contém `substituicao_placa`, adiciona também `substituicao` (e vice-versa) para respeitar a memória `tipo-entrada-substituicao-canonical`.

### 3. Novo hook `src/hooks/useVendedoresList.ts` (ou reuso)
Verificar se já existe um hook que liste vendedores (`profiles` com role `vendedor` / `consultor` / `agencia`). Se existir, reutilizar; senão criar:
```ts
export function useVendedoresList() {
  return useQuery({
    queryKey: ['vendedores-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('role', ['vendedor','supervisor','gerente','agencia','consultor_externo'])
        .order('nome');
      return data || [];
    },
    staleTime: 5*60*1000,
  });
}
```
(Vou conferir os roles reais no `app_roles_config` antes de fechar a lista; usa-se a mesma fonte que já alimenta outras telas de comissão.)

### 4. `src/pages/cadastro/Associados.tsx`
- Adicionar `vendedor_id` e `tipos_entrada` ao state `sheetFilters`.
- Passar `vendedor_id` e `tipos_entrada` para `useAssociados({ filters: ... })`.
- Passar `vendedores={vendedores}` para `<AssociadoFilters>`.
- Atualizar:
  - `hasFilters`, contagem de filtros ativos, `useEffect` de reset de paginação.
  - Chips de filtros ativos (se houver) para mostrar consultor + tipos selecionados.

## Detalhes técnicos

### Aliases de tipo_entrada
A memória `tipo-entrada-substituicao-canonical` define `substituicao_placa` como canônico, com `substituicao` como alias gravado em alguns contratos antigos. O filtro deve sempre buscar ambos quando o usuário escolher "Substituição".

### Performance
A pré-busca em `contratos` retorna apenas `associado_id` distinct. Em produção atual (~9.5k associados, ~quantidade similar de contratos), o limite de 50k cobre 100% dos casos. Se futuramente crescer, migra-se para uma RPC dedicada.

### Escopo de visibilidade
A query continua respeitando RLS de `associados` e `contratos`, então o filtro por consultor para um vendedor logado naturalmente só retornará seus próprios associados (já alinhado com `funil-cotacao-vendor-scoping`).

## Arquivos afetados
- `src/components/cadastro/AssociadoFilters.tsx` (UI + tipos)
- `src/hooks/useAssociados.ts` (filtros server-side + alias)
- `src/hooks/useVendedoresList.ts` (novo, se não houver equivalente)
- `src/pages/cadastro/Associados.tsx` (state + props)

## Fora de escopo
- Não altera exportação inteligente (pode ser estendida em iteração separada para incluir colunas de consultor/tipo).
- Não toca a barra de filtros rápidos no topo (apenas o sheet de Filtros Avançados, conforme pedido).
