

# Diagnóstico: Filtro de elegibilidade Especial/Select por região

## Investigação completa realizada

Analisei exaustivamente todos os componentes envolvidos na filtragem de planos:

### Código verificado (sem condição regional encontrada)

| Arquivo | Função | Usa região para elegibilidade? |
|---------|--------|-------------------------------|
| `src/hooks/usePlanosCotacao.ts` | `verificarElegibilidadeModelo()` | Não |
| `src/hooks/usePlanosCotacao.ts` | loop principal de filtragem | Não |
| `src/hooks/useCalcularCotacao.ts` | cotação pública | Não (e nem tem elegibilidade) |
| `src/components/planos/CalculadoraPreco.tsx` | calculadora | Não |
| `src/pages/vendas/Cotador.tsx` | parametrosPlanos | Passa região mas só para preço |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | planosCotacao | Idem |

### Dados verificados (idênticos entre regiões)

- `tabelas_preco_mensalidade`: linhas `especial` e `especial-plus` existem para rj, sp e lagos com faixas FIPE 0-120.000, combustível gasolina e diesel
- `plano_elegibilidade_modelos`: dados vinculados a `plano_id`, sem campo de região — a whitelist é global
- `plano_preco_map`: mapeamento correto para `especial` e `especial-plus`
- Exemplo concreto: CHEVROLET CELTA 2003 → aceito na linha `especial` (ano_min=2002, ano_max=2004), negado na linha `select` (ano_min=2005)

### Conclusão

O código de elegibilidade é **100% idêntico para todas as regiões**. Não existe nenhuma condição `if (regiao === 'rj')` ou similar em nenhum lugar do fluxo. A região é usada exclusivamente para buscar o preço na `tabelas_preco_mensalidade`, nunca para a elegibilidade.

## Possíveis causas do problema relatado

1. **Fail-safe mascarando o sintoma para RJ**: O fix de fail-safe aplicado anteriormente (quando `elegibilidadeData` falha, negar planos) pode estar agindo de forma intermitente — se a query falha, TODOS os planos com regras são negados (tanto Especial quanto Select). Para RJ isso pode parecer "correto" por coincidência, mas para SP pode parecer "errado"

2. **Cache stale do react-query**: A query `['plano_elegibilidade_modelos']` tem `staleTime: 5min`. Se os dados carregaram com sucesso uma vez para RJ mas falharam na primeira tentativa com SP (ou vice-versa), o cache pode persistir resultados incorretos

3. **Veículo/ano diferente nos testes**: Se o teste para SP foi feito com um veículo/ano diferente do teste para RJ, os resultados seriam naturalmente diferentes

## Recomendação

Para avançar, preciso de um cenário de teste específico: qual veículo (marca, modelo, ano) foi usado na cotação SP que mostrou planos incorretos? Com essa informação, posso adicionar logging diagnóstico e identificar exatamente onde o fluxo diverge.

Alternativamente, posso adicionar **logs de diagnóstico detalhados** ao `usePlanosCotacao.ts` que imprimam no console, para cada plano, o motivo pelo qual foi aprovado ou negado — permitindo comparar RJ vs SP lado a lado.

### Plano de ação proposto

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePlanosCotacao.ts` | Adicionar `console.log` detalhado para cada plano mostrando: região, linha, resultado de elegibilidade, motivo de inclusão/exclusão |

Com esses logs, basta fazer uma cotação com o mesmo veículo em RJ e SP, comparar a saída no console, e identificar a divergência exata.

