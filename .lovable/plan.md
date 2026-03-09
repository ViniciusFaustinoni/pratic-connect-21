

# Investigacao Profunda: Hardcode em Planos e Beneficios

## Resumo dos focos encontrados

---

### Foco 1 — `LINHAS_PLANO` hardcoded em `PlanosConfig.tsx` (CRITICO)

**Arquivo**: `src/components/planos/PlanosConfig.tsx` L20-26

```
const LINHAS_PLANO = [
  { value: 'select', label: 'Linha Select' },
  { value: 'select-one', label: 'Linha Select One' },
  { value: 'especial', label: 'Linha Especial' },
  { value: 'lancamento', label: 'Linha Lançamento' },
  { value: 'advanced', label: 'Linha Advanced' },
];
```

A tabela `product_lines` ja existe no banco e `useProductLines()` ja esta disponivel. Este array deveria vir do banco.

Defaults do form tambem sao fixos: `linha: 'select'`, `cobertura_fipe: 100`, `ano_minimo: 2005`.

---

### Foco 2 — `LINHA_CORES` hardcoded em `PlanoCardSelecao.tsx` (MEDIO)

**Arquivo**: `src/components/planos/PlanoCardSelecao.tsx` L30-37

```
const LINHA_CORES: Record<string, string> = {
  'select': 'from-blue-500 to-blue-600',
  'select-one': 'from-emerald-500 to-green-600',
  'especial': 'from-orange-500 to-amber-600',
  'lancamento': 'from-violet-500 to-purple-600',
  'advanced': 'from-red-500 to-rose-600',
  'eletricos': 'from-teal-500 to-cyan-600',
};
```

A tabela `product_lines` ja tem campo `color`. O `PlanoCardDynamic.tsx` ja usa `plan.product_lines?.color` — mas este componente nao.

---

### Foco 3 — `NIVEL_CONFIG` hardcoded em `EscolhaPlano.tsx` (MEDIO)

**Arquivo**: `src/components/cotacao-publica/EscolhaPlano.tsx` L35-54

Mapeia `exclusive`, `premium`, `basic` com icones e cores fixas. Ja tem fallback para niveis desconhecidos, mas os 3 niveis conhecidos sao hardcoded. Poderia ter campo `icon` e `color` na tabela `planos` (que ja tem `badge_color`).

---

### Foco 4 — `REGIOES` hardcoded em 3 arquivos (CRITICO)

A tabela `regioes` ja existe e `useRegioes()`/`useRegioesAtivas()` estao disponiveis.

| Arquivo | Conteudo fixo |
|---|---|
| `EtapaDadosVeiculo.tsx` L91-95 | `REGIOES = [{rio_de_janeiro}, {regiao_lagos}, {sao_paulo}]` |
| `EtapaCriteriosCotacao.tsx` L36-39 | `REGIOES = [{rio_de_janeiro}, {regiao_lagos}, {sao_paulo}]` |
| `EtapaResultado.tsx` L64-68 | `REGIOES_LABELS = {rio_de_janeiro: 'Rio de Janeiro', ...}` |

---

### Foco 5 — `OBSERVACOES_CATEGORIA` hardcoded em `EtapaResultado.tsx` (MEDIO)

**Arquivo**: `src/components/cotacao/EtapaResultado.tsx` L71-75

```
const OBSERVACOES_CATEGORIA: Record<string, string> = {
  leilao: 'Veículo de leilão: sem cobertura de incêndio',
  aplicativo: 'Uso para aplicativo: cota de participação 8% (mín R$ 3.000)',
  chassi_remarcado: 'Chassi remarcado: sujeito à análise de aceitação',
};
```

Estas observacoes deveriam vir de `benefit_category_exclusions` (ja existe) ou de um campo `observacao` em alguma tabela de categorias.

---

### Foco 6 — `CATEGORIAS_VEICULO` hardcoded em `VehicleCategorySelect.tsx` (MEDIO)

**Arquivo**: `src/components/cotador/VehicleCategorySelect.tsx` L12-21

Array fixo com 8 categorias. Importado por 5+ componentes. Deveria vir do banco (nova tabela `categorias_veiculo` ou da tabela de configuracoes).

---

### Foco 7 — `MARCAS` e `MODELOS_POR_MARCA` hardcoded em `EtapaDadosVeiculo.tsx` (MEDIO)

**Arquivo**: `src/components/cotacao/EtapaDadosVeiculo.tsx` L54-79

17 marcas e ~80 modelos fixos em codigo. Usado apenas como fallback para entrada manual (FIPE puxa automaticamente), mas novas marcas/modelos nao aparecem.

---

### Foco 8 — Logica de negocio hardcoded em `usePlanosCotacao.ts` (CRITICO)

**Arquivo**: `src/hooks/usePlanosCotacao.ts`

| Linha | Hardcode |
|---|---|
| L177-178 | `linha !== 'advanced'` para filtrar motos/carros |
| L189 | `linha === 'lancamento'` regra de ano para linha Lancamento |
| L274-276 | Ordenacao prioriza `linha === 'select'` |
| L139-143 | Mapeamento manual de codigos de regiao (`rio_de_janeiro` → `rj`, etc.) |

Estas regras de negocio deveriam derivar de campos na tabela `product_lines` (ex: `tipo_veiculo = 'moto'`, `sort_priority`, `requires_recent_year`).

---

### Foco 9 — Mensagem WhatsApp com textos fixos em `Cotador.tsx` (BAIXO)

**Arquivo**: `src/pages/vendas/Cotador.tsx` L696-700

```
✨ *Benefícios exclusivos PRATIC:*
• Cobertura 100% da tabela FIPE
• Sem análise de perfil
• Aprovação em até 24h
• App exclusivo para associados
```

Textos de marketing fixos no codigo. Deveriam vir de uma tabela `configuracoes` ou `templates_mensagem`.

---

### Foco 10 — Fotos de vistoria hardcoded em `autovistoriaConfig.ts` e `vistoriaConfigCompleta.ts` (BAIXO)

**Arquivos**: `src/data/autovistoriaConfig.ts` (509 linhas), `src/data/vistoriaConfigCompleta.ts`

~500 linhas de configuracao de fotos (15 fotos carro, 7 fotos moto, instrucoes, periodos, vagas). Importado por 15+ componentes. Adicionar/remover uma foto requer deploy.

---

### Foco 11 — `CATEGORIA_LABELS` hardcoded em `restricoesCategorias.ts` (BAIXO)

**Arquivo**: `src/data/restricoesCategorias.ts` L24-32

Labels de categorias duplicados do `CATEGORIAS_VEICULO` do Foco 6. Sem fonte unica.

---

## Resumo quantitativo

| Categoria | Arquivos | Impacto |
|---|---|---|
| Linhas de produto fixas (LINHAS_PLANO, LINHA_CORES) | 2 | CRITICO — novas linhas requerem deploy |
| Regioes fixas (REGIOES, REGIOES_LABELS) | 3 | CRITICO — banco ja tem tabela `regioes` |
| Logica de negocio por nome de linha | 1 | CRITICO — regras de filtragem/ordenacao |
| Niveis de plano fixos (NIVEL_CONFIG) | 1 | MEDIO — tem fallback, mas cores fixas |
| Categorias de veiculo fixas | 2 | MEDIO — 8 categorias hardcoded |
| Marcas/modelos fixos | 1 | MEDIO — fallback manual |
| Observacoes por categoria fixas | 1 | MEDIO — textos de negocio |
| Textos de marketing WhatsApp | 1 | BAIXO — textos fixos |
| Fotos de vistoria | 2 | BAIXO — ~500 linhas de config |

---

## Plano de correcao

### Fase 1 — Migrar `LINHAS_PLANO` para banco (Foco 1)
`PlanosConfig.tsx`: substituir array fixo por `useProductLines()`. Usar `product_lines.slug` como value e `product_lines.name` como label.

### Fase 2 — Migrar `REGIOES` para banco (Foco 4)
`EtapaDadosVeiculo.tsx`, `EtapaCriteriosCotacao.tsx`, `EtapaResultado.tsx`: usar `useRegioesAtivas()` em vez de arrays fixos.

### Fase 3 — Eliminar logica por nome de linha em `usePlanosCotacao.ts` (Foco 8)
Adicionar campos a `product_lines`:
- `tipo_veiculo` (enum: 'carro', 'moto', 'ambos') — substitui `linha === 'advanced'`
- `requires_recent_year` (boolean) — substitui `linha === 'lancamento'`
- `sort_priority` (int) — substitui `linha === 'select'` na ordenacao

Atualizar mapeamento de regiao para usar `regioes.codigo` diretamente.

### Fase 4 — Migrar `LINHA_CORES` e `NIVEL_CONFIG` (Focos 2 e 3)
`PlanoCardSelecao.tsx`: usar `product_lines.color` do banco (ja funciona em `PlanoCardDynamic`).
`EscolhaPlano.tsx`: manter `NIVEL_CONFIG` como fallback visual, ja que tem auto-fallback funcional.

### Fase 5 — Migrar `CATEGORIAS_VEICULO` para banco (Foco 6)
Criar tabela `categorias_veiculo` (value, label, ativa, ordem) ou usar `configuracoes`. Unificar com `CATEGORIA_LABELS` de `restricoesCategorias.ts`.

### Fase 6 — Migrar `OBSERVACOES_CATEGORIA` (Foco 5)
Derivar observacoes de `benefit_category_exclusions` e dos dados de cota do plano, em vez de textos fixos.

### Fase 7 — Migrar textos WhatsApp (Foco 9)
Mover para tabela `configuracoes` com chave `template_whatsapp_cotacao`.

### Fases futuras — Fotos de vistoria e marcas/modelos
Focos 7 e 10 sao de menor impacto e podem ser tratados separadamente.

