# Mega Auditoria: Planos e Benefícios — Diagnóstico Completo

## Resumo Executivo

Auditei todas as telas e processos que envolvem planos e benefícios. O admin (PlanosAdmin.tsx) é 100% dinâmico, mas 6 telas/componentes ainda usam dados hardcoded.

---

## ✅ JÁ CORRETO

- PlanosAdmin.tsx — CRUD dinâmico
- usePlanosCotacao.ts — Hook principal dinâmico
- CotacaoDetalhe.tsx — Dados do hook
- PlanoCardComparativo / PlanoDetalhesModal — Props dinâmicas
- EscolhaPlano.tsx — Props do banco
- ContratoDetalhe.tsx — CORRIGIDO
- useCalcularCotacao.ts — CORRIGIDO

## ❌ PROBLEMAS

### 🔴 P1: Cotador.tsx — mapearPlanosParaExibicao hardcoded
- Coberturas fallback por código (BASICO/TOTAL/PREMIUM)
- Preços com percentuais fixos (0.004/0.0055/0.007)
- Descrição e destaque fixos
- FIX: Usar usePlanosCotacao

### 🔴 P2: AppPlano.tsx — BENEFICIOS_POR_TIPO hardcoded
- App mostra benefícios fixos, ignora banco
- FIX: Buscar planos_beneficios + benefits

### 🔴 P3: CardPlano.tsx — Duplicação de P2
- FIX: Receber props do banco

### 🟡 P4: CotacaoPublica.tsx — getDescricaoCategoria estático
- FIX: Usar planos.descricao do banco

### 🟡 P5: pricing.ts — 539 linhas estáticas
- FIX: Extrair utilitários, deprecar tabelas

## Plano

| Fase | Arquivo | Ação |
|---|---|---|
| A | Cotador.tsx | Substituir mapearPlanosParaExibicao por usePlanosCotacao |
| B | AppPlano.tsx | Buscar benefícios do plano via banco |
| B | CardPlano.tsx | Receber benefícios como props |
| C | CotacaoPublica.tsx | Usar planos.descricao |
| D | pricing.ts | Extrair utilitários |
