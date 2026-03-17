

## Plano: Remover nomenclaturas hardcoded de planos e tornar dinâmico

### Problema
Vários arquivos contêm nomes de planos hardcoded ("Select", "Select One", "Advanced", "Lançamento") e regras de negócio escritas diretamente no código em vez de virem do banco de dados. Isso causa inconsistências quando planos são renomeados ou novos são criados.

### Arquivos afetados e correções

#### 1. `src/components/planos/VeiculosAceitos.tsx`
- **Linha 35**: Texto hardcoded `"Válido para Select, Select One e Lançamento"` → Buscar as linhas de produto do banco (`useProductLines`) e montar o texto dinamicamente com os nomes reais.
- **Linha 113**: `"Honda/Yamaha acima de R$35.000: Apenas Advanced"` → Buscar essa regra da tabela `configuracoes` (ou ao menos usar o nome da linha vindo do banco). Se não existir configuração, manter como fallback mas usando nomes dinâmicos das product_lines.

#### 2. `src/components/diretoria/FaixaPrecoModal.tsx`
- **Linha 252**: Texto `"Select One usa NULL (aceita qualquer combustível)"` → Trocar por texto genérico: `"NULL = aceita qualquer combustível"` (não referenciar nome de plano específico).

#### 3. `src/components/planos/PlanoLineSection.tsx`
- **Linhas 20-26**: `SLUG_ICONS` com slugs hardcoded (`select`, `select-one`, `especial`, `lancamento`, `advanced`) → Manter como fallback visual (são apenas ícones decorativos), mas o componente já usa `productLine.icon` como prioridade — isso está OK. Apenas remover os slugs obsoletos e usar um ícone genérico como fallback.

#### 4. `src/components/planos/BeneficioAdicionalModal.tsx`
- **Linhas 36-43**: `LINHAS_FALLBACK` com nomes hardcoded → Já usa `useProductLines()` como fonte principal (linhas 48-53). O fallback é aceitável mas deve ser atualizado para refletir os slugs atuais do banco. Melhor: remover o fallback e mostrar loading se `productLines` ainda não carregou.

### Resumo das mudanças

| Arquivo | O que tem hardcoded | Correção |
|---|---|---|
| `VeiculosAceitos.tsx` | Nomes de linhas no texto | Usar `useProductLines()` para montar texto dinâmico |
| `VeiculosAceitos.tsx` | Regra "Honda/Yamaha → Advanced" | Buscar de `configuracoes` ou usar nome dinâmico da linha |
| `FaixaPrecoModal.tsx` | "Select One usa NULL" | Texto genérico sem nome de plano |
| `PlanoLineSection.tsx` | Mapa de ícones por slug | Simplificar fallback, usar ícone genérico |
| `BeneficioAdicionalModal.tsx` | `LINHAS_FALLBACK` array | Remover fallback, usar apenas `useProductLines()` |

Nenhuma migração de banco necessária. Apenas substituição de strings hardcoded por dados dinâmicos já disponíveis via hooks existentes.

