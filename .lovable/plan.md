

# Plano: Duplicação de Linhas/Benefícios + Varredura de Hardcodes

## Parte 1 — Funcionalidades de Duplicação

### Estado atual
- **Planos**: já possuem `useDuplicatePlan()` e botão "Duplicar" na UI (ProdutosPlanos + PlanosTab)
- **Linhas de Produto**: NÃO possuem duplicação — LinhasTab só tem Editar/Excluir
- **Benefícios**: NÃO possuem duplicação — BeneficiosCoberturas só tem Editar/Excluir

### Implementação

**1. Hook `useDuplicateProductLine`** em `src/hooks/usePlansAdmin.ts`
- Copia todos os campos da linha (nome + " (cópia)", slug + "-copia-timestamp")
- Cria inativa por padrão

**2. Hook `useDuplicateBenefit`** em `src/hooks/usePlansAdmin.ts`
- Copia nome, slug, icon, description, category, display_order
- NÃO copia vínculos com planos (pois cada plano configura separadamente)
- Cria inativo

**3. UI — LinhasTab**: Adicionar botão "Duplicar" ao lado de Editar/Excluir em cada card de linha

**4. UI — BeneficiosCoberturas**: Adicionar botão "Duplicar" ao lado de Editar/Excluir em cada card de benefício

---

## Parte 2 — Varredura de Hardcodes

### Hardcodes encontrados que PRECISAM ser removidos

| Arquivo | Hardcode | Ação |
|---------|----------|------|
| `src/lib/gerarPdfCotacao.ts` (L158-165) | `COBERTURAS_PADRAO` — lista fixa de 6 coberturas usada como fallback no PDF | Substituir por query à tabela `main_coverages` (ou aceitar lista vazia se plano não tiver coberturas) |
| `src/components/planos/PlanoCardSelecao.tsx` (L31-38) | `LINHA_CORES_FALLBACK` — mapa fixo de cores por slug de linha | Usar campo `color` da tabela `product_lines` (já existe no banco) |
| `src/components/rh/BeneficioFormModal.tsx` (L30-37) | `tiposBeneficio` — lista fixa de 7 tipos de benefícios RH | Mover para tabela `configuracoes` ou criar tabela `tipos_beneficio_rh` |
| `supabase/functions/fechamento-mensal/index.ts` (L12-19) | `TIPOS_BENEFICIO` e `SINISTRO_PARA_BENEFICIO` — mapeamento fixo de tipos de sinistro para benefícios | Mover para tabela `configuracoes` ou criar tabela de mapeamento |
| `src/data/combustiveis.ts` | `COMBUSTIVEIS_FALLBACK` — já documentado como fallback | OK — já é fallback do banco, aceitável |

### Hardcodes ACEITÁVEIS (não precisam de ação)
- `LINE_COLORS` em LinhasTab/PlanosTab/PlanPreview — são apenas CSS classes de Tailwind mapeadas por cor do banco (o campo `color` é dinâmico, as classes CSS correspondentes precisam existir no código)
- `COMBUSTIVEIS_FALLBACK` — fallback explícito quando banco não responde
- `MOMENTOS` em FotosReboquistaUploadModal — são etapas fixas de processo operacional
- `STATUS_*` configs — são estados de máquina de estado, não dados comerciais

---

## Resumo de alterações

### Arquivos modificados
- `src/hooks/usePlansAdmin.ts` — 2 novos hooks (duplicar linha e benefício)
- `src/components/admin/planos/LinhasTab.tsx` — botão Duplicar
- `src/components/gestao-comercial/BeneficiosCoberturas.tsx` — botão Duplicar
- `src/lib/gerarPdfCotacao.ts` — remover `COBERTURAS_PADRAO`, usar `main_coverages` do banco
- `src/components/planos/PlanoCardSelecao.tsx` — usar `product_lines.color` + `gradient_class` do banco ao invés de `LINHA_CORES_FALLBACK`

### Hardcodes de backend (ação futura, não neste PR)
- `TIPOS_BENEFICIO` no fechamento mensal — requer migração de tabela de mapeamento
- `tiposBeneficio` no RH — requer tabela/config no banco

