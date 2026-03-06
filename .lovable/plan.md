# Auditoria: Planos, Benefícios e Precificação — Status Atualizado

## Resumo

A maioria dos fluxos de planos/benefícios já é dinâmica (banco de dados). Resta migrar o fluxo avançado de cotação (`pricing.ts`) e remover valores hardcoded de FIPE/idade espalhados em componentes.

---

## ✅ CORRIGIDO (não mexer)

- `PlanosAdmin.tsx` — CRUD dinâmico de planos, benefícios, coberturas, linhas
- `usePlanosCotacao.ts` — Hook principal dinâmico
- `useCalcularCotacao.ts` — Busca planos e tabelas_preco do banco
- `CotacaoDetalhe.tsx` — Dados do hook
- `PlanoCardComparativo` / `PlanoDetalhesModal` — Props dinâmicas
- `EscolhaPlano.tsx` — Props do banco
- `ContratoDetalhe.tsx` — Dinâmico
- `Cotador.tsx` — Usa PlanoCotacao direto
- `AppPlano.tsx` — Benefícios/coberturas do banco via planos_beneficios + benefits
- `CardPlano.tsx` — Recebe benefícios/coberturas como props
- `CotacaoPublica.tsx` — Usa planos.descricao, sem fallback hardcoded
- `useMyData.ts` — Select expandido com coberturas + planos_beneficios

---

## 🟡 PENDENTE

### 1. `pricing.ts` — 539 linhas estáticas (prioridade média)

**Problema:** Arquivo com categorias fixas (BASIC/PREMIUM/EXCLUSIVE), faixas FIPE hardcoded, preços estáticos por região/combustível, e cidades fixas por região.

**Usado por:**
- `useCotacaoAvancada.ts` — Hook que calcula cotação avançada usando pricing.ts
- `QuoteCalculatorModal.tsx` — Modal de cotação na tela de vendas (importa tipos + useCotacaoAvancada)
- `CotacaoPublica.tsx` — Apenas `formatarMoeda` (função utilitária)
- `CotacaoContratacao.tsx` — Apenas `formatarMoeda` (função utilitária)

**Solução proposta:**
1. Extrair `formatarMoeda` para `src/utils/format.ts` (elimina dependência das páginas públicas)
2. Migrar `QuoteCalculatorModal` + `useCotacaoAvancada` para usar `usePlanosCotacao` / `useCalcularCotacao`
3. Após migração, remover `pricing.ts`

### 2. Valores FIPE/idade hardcoded (prioridade baixa)

| Arquivo | Linha | Valor hardcoded |
|---------|-------|----------------|
| `SubstituicoesPendentesPage.tsx` | L158 | `> 120000` (badge FIPE ALTA) |
| `VeiculoPerfilAlert.tsx` | L16-18 | `LIMITE_IDADE=15`, `FIPE_MIN=15000`, `FIPE_MAX=500000` |

**Solução proposta:** Ler da tabela `configuracoes` (chaves `aceitacao_*`) com fallback para os valores atuais.

### 3. Blindado como aditivo (prioridade baixa)

- `useAvaliarAditivos.ts` L24-27: trata veículo blindado como aditivo em vez de bloqueio
- Precisa de decisão de negócio antes de alterar

---

## ❌ NÃO FAZER AGORA

- Tabelas novas (`regras_aceitacao`, `modelos_aceitacao_limitada`, `autorizacoes_veiculo`) — complexidade alta, sem demanda imediata
- Página de autorizações da diretoria — depende das tabelas acima
- Campos de vistoria (rebaixado/turbinado) — escopo separado
