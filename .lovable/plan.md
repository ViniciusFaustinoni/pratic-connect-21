

# Glossário, Regiões e Ranking — Revisão Completa

## Problemas Identificados

### 1. Ranking — Totalmente vazio (BUG CRÍTICO)
- O hook `useRankingVendedores` filtra `contratos.status = 'ativo'`, mas os contratos no banco possuem `status = 'assinado'`. Resultado: ranking sempre vazio.
- Deve incluir também cotações (enviadas/aceitas) como indicador de performance, não apenas contratos fechados.
- Vendedores sem contratos mas com cotações não aparecem.

### 2. Ranking — Dados insuficientes para motivar equipe
- Mostrar apenas contratos limita a visão. Incluir cotações como métrica secundária ("pipeline") dá visibilidade da atividade comercial.
- Adicionar métricas: cotações criadas, cotações aceitas, taxa de conversão cotação→contrato.

### 3. Glossário — Funcional mas com dados desatualizados
- A `TabelaCotasTaxas` mostra "Adesão padrão: R$350" mas a regra real V12 é **1% do FIPE** (mín. R$100). Isso confunde vendedores.
- Atualizar o JSON no banco para refletir a regra correta.

### 4. Regiões — Funcional mas sem visibilidade útil
- O componente CRUD funciona, mas falta mostrar quantos planos/faixas de preço estão vinculados a cada região.
- Falta indicador visual de cobertura: quais linhas de produto operam em cada região.

## Plano de Correção

### A. Corrigir Ranking — Status do contrato + incluir cotações

**Arquivo**: `src/hooks/useRankingVendedores.ts`
- Mudar filtro de `.eq('status', 'ativo')` para `.in('status', ['ativo', 'assinado'])` para capturar todos os contratos válidos.
- Buscar cotações do período e incluir como métrica adicional (cotações criadas, aceitas).

**Arquivo**: `src/components/planos/RankingVendedores.tsx`
- Adicionar colunas de cotações (criadas/aceitas) ao ranking.
- Mostrar taxa de conversão cotação→contrato no lugar de leads→contrato (mais relevante).

### B. Corrigir Glossário — Atualizar taxas no banco

- Atualizar registro `taxas_procedimentos` para mostrar "Adesão: 1% da FIPE (mín. R$100)" em vez de "R$350" fixo.
- Executar UPDATE via SQL para corrigir os dados.

### C. Melhorar Regiões — Mostrar vínculo com tabelas de preço

**Arquivo**: `src/components/planos/RegioesConfig.tsx`
- Adicionar coluna "Faixas de preço" que mostra quantas faixas em `tabelas_preco_mensalidade` usam cada região (query count).
- Expandir row para mostrar quais linhas de produto (select, especial, etc.) operam na região.

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useRankingVendedores.ts` | Fix status filter, add cotações |
| `src/components/planos/RankingVendedores.tsx` | Exibir cotações, melhorar métricas |
| `src/components/planos/RegioesConfig.tsx` | Mostrar faixas vinculadas por região |
| SQL (configuracoes) | Atualizar taxas_procedimentos |

