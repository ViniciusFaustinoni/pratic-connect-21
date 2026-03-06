# Auditoria Completa: Planos, Benefícios e Precificação

## Resumo

A maioria dos fluxos de planos/benefícios já é dinâmica. Restam 4 áreas pendentes: `pricing.ts` estático, `formatarMoeda` duplicada/espalhada, valores FIPE/idade hardcoded, e níveis hardcoded em `EscolhaPlano.tsx`.

---

## ✅ CORRIGIDO (não mexer)

- `PlanosAdmin.tsx` — CRUD dinâmico de planos, benefícios, coberturas, linhas
- `usePlanosCotacao.ts` — Hook principal dinâmico
- `useCalcularCotacao.ts` — Busca planos e tabelas_preco do banco
- `CotacaoDetalhe.tsx` — Dados do hook
- `PlanoCardComparativo` / `PlanoDetalhesModal` — Props dinâmicas
- `ContratoDetalhe.tsx` — Dinâmico
- `Cotador.tsx` — Usa PlanoCotacao direto
- `AppPlano.tsx` — Benefícios/coberturas do banco via planos_beneficios + benefits
- `CardPlano.tsx` — Recebe benefícios/coberturas como props
- `useMyData.ts` — Select expandido com coberturas + planos_beneficios
- `ComparadorNiveis.tsx` — Dinâmico (usa `usePlans` + `useProductLines` do banco)
- `CotacaoPublicaCompleta.tsx` — Dinâmico (define `formatarMoeda` local, sem pricing.ts)

---

## 🟡 PENDENTE

### 1. `pricing.ts` — 539 linhas estáticas (prioridade média)

**Problema:** Categorias fixas (BASIC/PREMIUM/EXCLUSIVE), faixas FIPE hardcoded, preços estáticos por região/combustível, cidades fixas por região.

**Usado por:**
| Arquivo | O que importa |
|---------|--------------|
| `QuoteCalculatorModal.tsx` | `calcularCotacao`, `formatarMoeda`, `ADICIONAIS`, tipos `Categoria`, `ResultadoCotacao` |
| `useCotacaoAvancada.ts` | `calcularCotacao`, `ResultadoCotacao`, `Categoria` |
| `CotacaoPublica.tsx` | Apenas `formatarMoeda` |
| `CotacaoContratacao.tsx` | Apenas `formatarMoeda` |

**Solução:**
1. Extrair `formatarMoeda` para local centralizado (já existe em `usePlanosPrecificacao.ts` L68)
2. Migrar `QuoteCalculatorModal` + `useCotacaoAvancada` para usar hooks dinâmicos
3. Remover `pricing.ts`

### 2. `formatarMoeda` duplicada em 5+ locais (prioridade média)

| Local | Tipo |
|-------|------|
| `src/config/pricing.ts` | Exportada, usada por 2 páginas públicas |
| `src/hooks/usePlanosPrecificacao.ts` L68 | Exportada |
| `src/pages/public/CotacaoPublicaCompleta.tsx` L196 | Local |
| `src/components/cotacao-publica/EscolhaPlano.tsx` L33 | Local |
| `src/components/beneficios/TabelaSaudeBeneficios.tsx` L23 | Local |

**Solução:** Criar `src/utils/format.ts` com `formatarMoeda` e substituir todas as ocorrências.

### 3. ✅ Valores FIPE/idade hardcoded — CORRIGIDO

Criado hook `useConfigLimitesVeiculo` que lê 4 chaves da tabela `configuracoes`:
- `fipe_limite_autorizacao` (120000) — usado em StepNovoVeiculo, SubstituicoesPendentesPage, SubstituicaoDetalhePage
- `perfil_veiculo_idade_limite` (15), `perfil_veiculo_fipe_minimo` (15000), `perfil_veiculo_fipe_maximo` (500000) — VeiculoPerfilAlert


### 4. Níveis hardcoded em `EscolhaPlano.tsx` (prioridade baixa)

- L19: `nivel?: 'basic' | 'premium' | 'exclusive'` — tipo fixo
- L40-59: `getNivelIcon` e `getNivelLabel` com switch hardcoded
- L151-152: Cores fixas por nível (yellow para exclusive, purple para premium)

**Nota:** Os dados vêm do banco (props), mas a UI de ícones/labels/cores é fixa para 3 níveis. Se no futuro houver mais níveis, precisará refatorar.

**Solução futura:** Mover ícone/cor/label para a tabela `planos` ou `product_lines` no banco.

### 5. Blindado como aditivo (decisão pendente)

- `useAvaliarAditivos.ts` L24-27: trata veículo blindado como aditivo (permite)
- Comportamento correto: deve bloquear cadastro
- **Aguarda decisão de negócio**

---

## ❌ NÃO FAZER AGORA

- Tabelas novas de regras de aceitação — complexidade alta, sem demanda imediata
- Página de autorizações da diretoria — depende das tabelas acima
- Campos de vistoria (rebaixado/turbinado) — escopo separado

---

## 📋 ORDEM DE EXECUÇÃO SUGERIDA

1. **Unificar `formatarMoeda`** → cria `src/utils/format.ts`, substitui 5+ locais (rápido, zero risco)
2. **Migrar `pricing.ts`** → refatorar `QuoteCalculatorModal` + `useCotacaoAvancada` para hooks dinâmicos
3. **Dinamizar limites FIPE/idade** → inserir chaves em `configuracoes`, criar hook, substituir hardcoded
4. **Níveis `EscolhaPlano`** → mover metadata de nível para banco (se necessário)
