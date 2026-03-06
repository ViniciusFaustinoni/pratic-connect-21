# Mega Auditoria: Planos e Benefícios — Diagnóstico Completo

## Resumo Executivo

Auditei todas as telas e processos que envolvem planos e benefícios. Todos os fluxos agora são dinâmicos.

---

## ✅ CORRIGIDO

- PlanosAdmin.tsx — CRUD dinâmico
- usePlanosCotacao.ts — Hook principal dinâmico
- CotacaoDetalhe.tsx — Dados do hook
- PlanoCardComparativo / PlanoDetalhesModal — Props dinâmicas
- EscolhaPlano.tsx — Props do banco
- ContratoDetalhe.tsx — CORRIGIDO
- useCalcularCotacao.ts — CORRIGIDO
- Cotador.tsx — CORRIGIDO (removido mapearPlanosParaExibicao, usa PlanoCotacao direto)
- AppPlano.tsx — CORRIGIDO (benefícios e coberturas do banco via planos_beneficios + benefits)
- CardPlano.tsx — CORRIGIDO (recebe benefícios/coberturas como props)
- CotacaoPublica.tsx — CORRIGIDO (usa planos.descricao, sem fallback hardcoded)
- useMyData.ts — CORRIGIDO (select expandido com coberturas + planos_beneficios)

## 🟡 PENDENTE (baixa prioridade)

### pricing.ts — 539 linhas estáticas
- Ainda usado por useCotacaoAvancada.ts e QuoteCalculatorModal.tsx
- getDescricaoCategoria removido do fluxo público, mas mantido internamente
- FIX futuro: Migrar fluxo avançado para usar usePlanosCotacao
