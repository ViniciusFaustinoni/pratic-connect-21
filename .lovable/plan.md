

## Plano de correção (foco: novos contratos, sem mexer na Vitória)

### Causa raiz confirmada
A API `placas.fipeapi.com.br` devolve um único campo `ano`, e em 3 pontos do código esse valor é espelhado para `ano_fabricacao` e `ano_modelo`, gerando "Fab=Mod" mesmo quando o CRLV diz o contrário (ex: 2014/2015 virou 2014/2014).

### Mudanças

**1. `supabase/functions/plate-lookup/index.ts`**
- Logar payload bruto da API e mapear separadamente `ano_fabricacao` e `ano_modelo` quando disponíveis.
- Aceitar formato `"2014/2015"` em `veiculo.ano` → split em dois campos.
- Retornar `vehicleData.ano_fabricacao` e `vehicleData.ano_modelo` distintos (com fallback para o mesmo valor quando a API só entregar um).

**2. `src/hooks/useFipe.ts`**
- Adicionar `ano_fabricacao` e `ano_modelo` à interface `PlateResult.vehicleData`.
- Em `getByPlacaLegacy`, parar de fazer `anoFabricacao = anoModelo = parseInt(ano)` — usar os campos separados do retorno.

**3. `src/hooks/useCotacaoContratacao.ts`**
- Em `criarCotacao` e `atualizarCotacao`: sempre que houver retorno de placa/FIPE, persistir `veiculo_ano_fabricacao` e `veiculo_ano` separadamente (não espelhar).

**4. `src/components/contratos/ContratoWizard.tsx` (linhas 207-214 e 263-270)**
- Remover o espelhamento `form.setValue('ano_fabricacao', lead.veiculo_ano)`.
- Quando só existir um ano no lead, preencher só o `ano_modelo` e deixar `ano_fabricacao` vazio para o usuário/CRLV completar.

**5. `src/components/cotacao-publica/EtapaVeiculo*.tsx`**
- Adicionar microcampo opcional "Ano Modelo" ao lado de "Ano Fabricação", com tooltip "veja no CRLV — pode ser diferente".
- Garantia adicional caso a API entregue só um valor.

**6. `supabase/functions/_shared/termo-afiliacao-utils.ts`**
- Reforçar a hierarquia: `contrato.veiculo_ano_fabricacao || veiculoDB.ano_fabricacao || ...` (incluir `ano_fabricacao, ano_modelo` no SELECT do `veiculoDB` em `autentique-create` e `autentique-create-by-token`).

### Validação
1. Cotar 3 placas variadas (carro 2014/2015, moto 2020/2021, carro 0km 2024/2025) e conferir no banco se `veiculo_ano_fabricacao ≠ veiculo_ano` quando aplicável.
2. Gerar termo de uma dessas cotações e confirmar "Ano Fab. XXXX - Ano Mod. YYYY" corretos.
3. Logar resposta crua do `plate-lookup` para auditar quais campos a API entrega de fato.

### Vitória
Mantida como está — nenhum UPDATE no banco, nenhuma reemissão de termo.

