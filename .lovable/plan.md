

## Plano: Regra Geral Unificada de Filtros — Cotação, Calculadora e Termos

### Diagnóstico Atual

Existem **3 motores de filtro independentes** que precisam seguir a mesma regra, mas hoje cada um usa lógica diferente:

| Motor | Arquivo | Problema |
|-------|---------|----------|
| **Cotador** (usePlanosCotacao) | `src/hooks/usePlanosCotacao.ts` | ✅ Já refatorado — segue a hierarquia Linha→Plano(sem regra)→Itens(filtra) |
| **Calculadora** | `src/components/planos/CalculadoraPreco.tsx` | ❌ Usa `plano_elegibilidade_modelos`, `tabelas_preco_mensalidade`, `plano_preco_map`, filtros por `tipo_uso`, `categoria`, `supports_app`, `blocked_categories`, `fipe_minima/maxima` do plano — tudo fora da estrutura unificada |
| **Termos** (contrato-gerar) | `supabase/functions/contrato-gerar/index.ts` | ⚠️ Usa `plano_elegibilidade_modelos` para detecção de moto. Preços vêm da cotação já salva, não recalcula |

### Tabelas/Lógicas que Devem Ser Inutilizadas

Segundo a regra, **toda filtragem deve vir exclusivamente de `entity_eligibility_rules`**. As seguintes fontes de filtragem são **extras e devem ser removidas**:

1. **`plano_elegibilidade_modelos`** — tabela legada de elegibilidade por modelo
   - Usada em: `CalculadoraPreco.tsx`, `ElegibilidadeVeiculos.tsx`, `ElegibilidadeTab.tsx`, `useDetectarTipoVeiculo.ts`, `contrato-gerar/index.ts`
   - **Ação**: Substituir por consulta a `entity_eligibility_rules` onde aplicável; para detecção de moto, usar `marcas_modelos` + configurações

2. **`tabelas_preco_mensalidade` + `plano_preco_map`** — tabelas de preço por faixa FIPE legadas
   - Usada em: `CalculadoraPreco.tsx`, `usePlanos.ts`, `ProdutosPlanos.tsx`, `FaixaPrecoModal.tsx`
   - **Ação**: A Calculadora deve usar o mesmo motor do Cotador (`usePlanosCotacao`) — preço = Σ coberturas + Σ benefícios com fipe_range

3. **Filtros legados no plano** (campos no registro do plano):
   - `tipo_uso`, `categoria`, `fipe_minima`, `fipe_maxima`, `ano_minimo`, `supports_app`, `blocked_categories`
   - Usados em: `CalculadoraPreco.tsx` (linhas 476-543)
   - **Ação**: Remover — planos NÃO têm restrições próprias

### Mudanças

**1. Calculadora (`src/components/planos/CalculadoraPreco.tsx`)**
- Substituir todo o motor de cálculo interno pela chamada ao `usePlanosCotacao` (mesmo hook do Cotador)
- Remover: query a `plano_elegibilidade_modelos`, query a `tabelas_preco_mensalidade`, query a `plano_preco_map`
- Remover: filtros por `tipo_uso`, `categoria`, `supports_app`, `blocked_categories`, `fipe_minima/maxima`
- A Calculadora passa a ser apenas uma UI que monta os parâmetros e consome `usePlanosCotacao`
- Os resultados já virão com coberturas filtradas e preços corretos

**2. Detecção de tipo de veículo (`src/hooks/useDetectarTipoVeiculo.ts`)**
- Substituir consulta a `plano_elegibilidade_modelos` por consulta a `marcas_modelos` (tabela já usada no VeiculosAceitosEditor)
- Lógica: se o modelo existe em `marcas_modelos` com categoria moto → é moto
- Manter fallback por keywords como está

**3. Edge function contrato-gerar (`supabase/functions/contrato-gerar/index.ts`)**
- Na função `detectarCategoriaVeiculo`: substituir consulta a `plano_elegibilidade_modelos` por `marcas_modelos`
- Resto da função não muda (preços vêm da cotação salva)

**4. Telas admin de elegibilidade legada**
- `src/components/gestao-comercial/ElegibilidadeVeiculos.tsx` — marcar como deprecated, adicionar banner de aviso direcionando para o editor de Veículos Aceitos na Linha
- `src/components/admin/planos/ElegibilidadeTab.tsx` — mesma ação

**5. Hooks legados**
- `src/hooks/usePlanos.ts` → `useTabelasPreco` e `useTabelaPrecoByFipe` — não remover ainda mas marcar como `@deprecated`

### Fluxo Unificado Final

```text
COTAÇÃO / CALCULADORA / TERMOS — mesma regra:

1. Linha (entity_eligibility_rules, entity_type='linha')
   ├── tipo de veículo (via product_lines.vehicle_type)
   ├── ano de fabricação (rule_type='ano_range')
   └── marca/modelo (rule_type='marca_modelo', rule_config.modelos[])
       → Falhou? Descarta TODOS os planos dessa linha

2. Plano
   └── SEM restrições — nunca filtra

3. Coberturas/Benefícios (entity_type='cobertura'/'beneficio')
   ├── FIPE (rule_type='fipe_range' ou 'fipe_eligibility')
   ├── Região (rule_type='regiao')
   ├── Tipo de Placa (rule_type='tipo_placa')
   ├── Combustível (rule_type='combustivel')
   └── Tipo de Uso (rule_type='tipo_uso')
       → Falhou? Remove o item, mantém o plano
       → Preço = soma apenas dos itens elegíveis
```

### Arquivos Alterados
- `src/components/planos/CalculadoraPreco.tsx` — refatorar para usar `usePlanosCotacao`
- `src/hooks/useDetectarTipoVeiculo.ts` — trocar `plano_elegibilidade_modelos` por `marcas_modelos`
- `supabase/functions/contrato-gerar/index.ts` — trocar `plano_elegibilidade_modelos` por `marcas_modelos`
- `src/components/gestao-comercial/ElegibilidadeVeiculos.tsx` — adicionar banner deprecated
- `src/components/admin/planos/ElegibilidadeTab.tsx` — adicionar banner deprecated
- `src/hooks/usePlanos.ts` — marcar hooks de tabela preço como `@deprecated`

### Não Alterado
- `src/hooks/usePlanosCotacao.ts` — já está correto
- `src/hooks/useEntityEligibilityRules.ts` — motor de regras permanece igual
- Tabelas do banco — nenhuma migração (tabelas legadas ficam mas não são usadas)
- UI dos cards de plano/cotação — já suporta a estrutura atual
- Gestão de coberturas e benefícios no admin

