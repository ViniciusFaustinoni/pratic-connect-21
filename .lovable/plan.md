

## Plano: Revisão Completa da Regra Geral Unificada + Carências

### Estado Atual

Após as refatorações anteriores, o sistema está parcialmente unificado:

| Motor | Estado | Problemas Remanescentes |
|-------|--------|------------------------|
| **Cotador** (`usePlanosCotacao.ts`) | ✅ Correto | Segue hierarquia Linha→Plano(sem regra)→Itens(filtra) |
| **Calculadora** (`CalculadoraPreco.tsx`) | ✅ Correto | Usa `usePlanosCotacao` |
| **Termos** (`contrato-gerar/index.ts`) | ✅ OK | Preços vêm da cotação salva, detecção de moto usa `marcas_modelos` |
| **Cotação Avançada** (`useCotacaoAvancada.ts`) | ❌ LEGADO | Usa `plano_preco_map` + `tabelas_preco_mensalidade` para calcular preços. Não usa `entity_eligibility_rules` |
| **SGA Hinova Sync** (`sga-hinova-sync/index.ts`) | ❌ LEGADO | Usa `plano_elegibilidade_modelos` para detecção de moto (linha 670) |
| **Parse Elegibilidade** (`parse-elegibilidade-pdf/xlsx`) | ⚠️ LEGADO | Importam dados para `plano_elegibilidade_modelos` — tabela que não deveria mais ser usada |
| **Carências** (`carenciaResidual.ts`) | ⚠️ Isolado | Calcula carências por item mas não é chamado no fluxo de cotação/termos |

### Problemas Identificados

1. **`useCotacaoAvancada.ts`** — motor de cotação paralelo que usa `plano_preco_map` + `tabelas_preco_mensalidade`. Deveria usar `usePlanosCotacao` ou ser eliminado se não for mais chamado.

2. **`sga-hinova-sync/index.ts`** — ainda consulta `plano_elegibilidade_modelos` (linha 670) para detectar tipo de veículo. Deveria usar `marcas_modelos` + `configuracoes`.

3. **`parse-elegibilidade-pdf/xlsx`** — edge functions que importam planilhas para `plano_elegibilidade_modelos`. Tabela legada — se ninguém mais a consome, essas funções ficam órfãs.

4. **Carências não verificadas na cotação/termos** — O arquivo `carenciaResidual.ts` existe mas não é referenciado em nenhum fluxo. O `contrato-gerar` calcula carência geral (120 dias) e carência de vidros, mas **não verifica carências por cobertura/benefício individual** conforme configurado no catálogo (`coberturas.carencia_ativa`, `coberturas.carencia_dias`).

5. **Termos (Autentique)** — As funções `autentique-create` e `autentique-create-by-token` leem `planos_coberturas.carencia_dias` para compor o documento, mas não aplicam a regra de elegibilidade unificada sobre os itens. Os itens do termo vêm do plano salvo na cotação, sem filtrar os inelegíveis.

### Mudanças

**1. Eliminar `useCotacaoAvancada` como motor de preços**
- Arquivo: `src/hooks/useCotacaoAvancada.ts`
- A função `usePlanosParaCotacao` usa `plano_preco_map` + `tabelas_preco_mensalidade`
- Verificar quem a chama. Se for substituível por `usePlanosCotacao`, marcar como `@deprecated` e migrar os chamadores

**2. Corrigir `sga-hinova-sync` — trocar `plano_elegibilidade_modelos` por `marcas_modelos`**
- Arquivo: `supabase/functions/sga-hinova-sync/index.ts` (linhas 667-679)
- Substituir consulta a `plano_elegibilidade_modelos` por `marcas_modelos` (mesmo padrão já aplicado em `contrato-gerar`)

**3. Deprecar functions de importação legada**
- `supabase/functions/parse-elegibilidade-pdf/index.ts`
- `supabase/functions/parse-elegibilidade-xlsx/index.ts`
- Adicionar log de warning "DEPRECATED" no início e continuar funcionando para não quebrar nada, mas sinalizando que a tabela alvo é legada

**4. Integrar carências por item no `contrato-gerar`**
- Arquivo: `supabase/functions/contrato-gerar/index.ts`
- Após criar o contrato, buscar `coberturas` vinculadas ao plano e suas configurações de carência (`carencia_ativa`, `carencia_dias`)
- Salvar carência individual por cobertura no contrato (se houver campo) ou ao menos aplicar o max de carências como `data_carencia_fim`
- Para substituição de veículo: chamar lógica equivalente a `calcularCarenciaResidual`

**5. Filtrar itens inelegíveis nos Termos (Autentique)**
- Arquivos: `supabase/functions/autentique-create/index.ts`, `autentique-create-by-token/index.ts`
- Ao montar a lista de coberturas/benefícios para o documento, aplicar as regras de `entity_eligibility_rules` para o veículo do contrato
- Itens inelegíveis (por FIPE, região, combustível, placa) não devem aparecer no termo
- Isso garante que o documento reflita exatamente os itens cobertos

### Fluxo Final Completo

```text
COTAÇÃO / CALCULADORA / TERMOS — regra única:

1. Linha (entity_eligibility_rules, entity_type='linha')
   ├── tipo de veículo
   ├── ano de fabricação
   └── marca/modelo
       → Falhou? Descarta toda a linha

2. Plano
   └── SEM restrições

3. Coberturas/Benefícios (entity_type='cobertura'/'beneficio')
   ├── FIPE (min/max + faixas)
   ├── Região
   ├── Tipo de Placa
   ├── Combustível
   └── Tipo de Uso
       → Falhou? Remove item, mantém plano
       → Preço = soma dos elegíveis
       → Carência = conforme catálogo do item

4. Carências
   ├── Geral: max(carencia_dias de cada cobertura ativa)
   ├── Por item: coberturas.carencia_dias se carencia_ativa
   ├── Vidros: config separada (carencia_beneficio_vidros_dias)
   └── Migração: isenção se aprovada
```

### Arquivos Alterados
- `src/hooks/useCotacaoAvancada.ts` — deprecar `usePlanosParaCotacao`, migrar chamadores
- `supabase/functions/sga-hinova-sync/index.ts` — trocar `plano_elegibilidade_modelos` por `marcas_modelos`
- `supabase/functions/parse-elegibilidade-pdf/index.ts` — adicionar warning deprecated
- `supabase/functions/parse-elegibilidade-xlsx/index.ts` — adicionar warning deprecated
- `supabase/functions/contrato-gerar/index.ts` — integrar carências por item do catálogo
- `supabase/functions/autentique-create/index.ts` — filtrar itens por elegibilidade do veículo
- `supabase/functions/autentique-create-by-token/index.ts` — mesma filtragem

### Não Alterado
- `src/hooks/usePlanosCotacao.ts` — já correto
- `src/hooks/useEntityEligibilityRules.ts` — motor permanece igual
- `src/components/planos/CalculadoraPreco.tsx` — já usa motor unificado
- Tabelas do banco — nenhuma migração
- UI de cotação/cards — já suporta estrutura atual

