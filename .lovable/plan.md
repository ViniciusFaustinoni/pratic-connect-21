

## Analise Mobile-First: Diagnóstico e Plano de Correção

### Diagnóstico

Analisei o sistema inteiro e encontrei **problemas significativos de mobile-first** em diversas áreas. O padrão correto no Tailwind é começar com o layout mobile (sem prefixo) e escalar para cima (`sm:`, `md:`, `lg:`). Muitas telas fazem o oposto ou não adaptam nada.

### Problemas encontrados

**1. Grids fixos sem breakpoints (problema mais grave)**
Encontrei **330 ocorrências em 43 arquivos** de `grid grid-cols-X` sem prefixo responsivo, forçando 3-7 colunas mesmo em telas pequenas. Exemplos críticos:

- `OuvidoriaDashboard.tsx` — `grid-cols-5` fixo (5 cards lado a lado no celular)
- `CobrancasList.tsx` — `grid-cols-4` fixo para KPIs
- `IndicadoresAtuariais.tsx` — `grid-cols-5` fixo para KPIs
- `NovaManifestacao.tsx` — `grid-cols-5` fixo para tipos
- `PlanosConfig.tsx` — `grid-cols-3` e `grid-cols-4` fixos em formulários
- `ContasBancarias.tsx` — `grid-cols-3` fixo
- `ReguladorOficina.tsx` — `grid-cols-3` fixo para filtros
- `ConfigPlataformas.tsx` — `grid-cols-3` fixo para estatísticas
- Vários modais de oficina, jurídico, marketing com grids fixos

**2. Calendários `grid-cols-7` (aceitável)**
Os 6 arquivos com `grid-cols-7` são calendários — semanticamente correto ter 7 colunas (dias da semana). Não precisam de correção.

**3. Grids de fotos `grid-cols-3` (parcialmente aceitável)**
Páginas do instalador e sinistros usam `grid-cols-3` para miniaturas de fotos — funciona em mobile por serem imagens pequenas, mas algumas podem beneficiar de `grid-cols-2 sm:grid-cols-3`.

**4. Componentes que já estão corretos**
- `Dashboard.tsx` — `grid-cols-2 lg:grid-cols-4` ✓
- `AppHeader.tsx` — responsive com `sm:` e `md:` ✓
- `AppLayout.tsx` — responsive ✓
- `AppBottomNav.tsx` — mobile-only com `md:hidden` ✓
- `DiretoriaDashboard.tsx` — `md:grid-cols-4 lg:grid-cols-7` ✓

### Plano de Correção

Vou corrigir os arquivos mais impactantes em **3 lotes** por prioridade:

**Lote 1 — Dashboards e KPIs (mais visíveis ao usuário)**

| Arquivo | De | Para |
|---|---|---|
| `OuvidoriaDashboard.tsx` | `grid-cols-5` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` |
| `NovaManifestacao.tsx` | `grid-cols-5` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` |
| `CobrancasList.tsx` | `grid-cols-4` | `grid-cols-2 md:grid-cols-4` |
| `IndicadoresAtuariais.tsx` | `grid-cols-5` | `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` |
| `OrdensServicoList.tsx` | `grid-cols-5` | `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` |
| `ProcessosList.tsx` | `grid-cols-5` | `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` |
| `SindicanciasList.tsx` | `grid-cols-4` | `grid-cols-2 md:grid-cols-4` |

**Lote 2 — Formulários e Modais**

| Arquivo | De | Para |
|---|---|---|
| `PlanosConfig.tsx` | `grid-cols-3`, `grid-cols-4` | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, etc. |
| `NovaOficinaModal.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `ContasBancarias.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `ReguladorOficina.tsx` | `grid-cols-3` filtros | `grid-cols-1 sm:grid-cols-3` |
| `ProcessosList.tsx` | `grid-cols-6` filtros | `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` |
| `ConfigPlataformas.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `NovaAudienciaModal.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `CampanhaComunicacaoModal.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |

**Lote 3 — Fotos e componentes secundários**

| Arquivo | De | Para |
|---|---|---|
| `SinistroAnalise.tsx` | `grid-cols-5` fotos | `grid-cols-3 sm:grid-cols-5` |
| `SindicanteCasoDetalhe.tsx` | `grid-cols-4` fotos | `grid-cols-3 sm:grid-cols-4` |
| `PrestadorDetalhe.tsx` | `grid-cols-3` layout | `grid-cols-1 lg:grid-cols-3` |
| `SimulacaoImpactoCard.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `SimuladorRateio.tsx` | `grid-cols-4` | `grid-cols-2 md:grid-cols-4` |
| `IndicadoresDRE.tsx` | `grid-cols-4` | `grid-cols-2 md:grid-cols-4` |
| `WhatsAppMetaTemplates.tsx` | `grid-cols-4` | `grid-cols-2 md:grid-cols-4` |
| `FormPacoteFechado.tsx` | `grid-cols-4` | `grid-cols-2 md:grid-cols-4` |
| `Sistema.tsx` (config) | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |

**Lote 4 — Outros componentes com grids fixos**
Restante dos ~113 arquivos de componentes que também usam `grid-cols-X` sem breakpoints.

### Regra geral aplicada

- `grid-cols-1` como base mobile
- `grid-cols-2` para KPIs/cards em mobile (quando são cards pequenos)
- `sm:` / `md:` / `lg:` para escalar progressivamente
- Calendários (`grid-cols-7`) e grids de fotos pequenas (`grid-cols-3`) mantidos quando fazem sentido visual

### Arquivos alterados
~43 arquivos em `src/pages/` + ~70 em `src/components/` com correções de grid responsivo.

Dado o volume, sugiro começar pelos **Lotes 1 e 2** (os mais visíveis e impactantes) e depois iterar nos demais.

