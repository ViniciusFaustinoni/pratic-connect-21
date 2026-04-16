

## Diagnóstico

A **Cotação Rápida** mostra "Faixa enquadrada: R$ 0,00 – R$ 20.000,00" para a moto Yamaha XTZ250 (FIPE R$ 18.976), o que está errado segundo o Guia V11 (faixas de moto vão de 3 em 3 mil — a faixa correta seria R$ 18.000,01 – R$ 21.000,00).

Causa raiz, comprovada no banco:

1. O texto "Faixa enquadrada" em `src/components/cotacoes/CotacaoFormDialog.tsx` (linhas 433–442 e 1732–1736) lê da tabela **legada** `tabelas_preco_mensalidade` via `useTabelasPreco()`.
2. Essa tabela tem só 2 baldes amplos: `0 → 20.000` e `20.000,01 → 40.000`. Por isso o R$ 18.976 cai em "0 a 20.000".
3. O **motor de cotação real** (`usePlanosCotacao` → `entity_eligibility_rules` com `rule_type='fipe_range'`) já está correto: as coberturas Advanced (motos) usam `intervalo: 3000, min: 0, max: 51000`. Os preços dos planos exibidos (Advanced R$ 218,70 / Advanced + R$ 238,70) saem desse motor — o que está errado é só o rótulo da faixa.
4. Memória do projeto reforça: `tabelas_preco_mensalidade` é **deprecated** e não deve ser fonte de verdade.

Conclusão: cálculo de preço está correto. O que precisa mudar é a **fonte da exibição da faixa**, passando a derivar de `entity_eligibility_rules` (mesma fonte do motor).

## Mudanças

### 1. `src/components/cotacoes/CotacaoFormDialog.tsx`

- Substituir a derivação de `faixaAtualFipe` (linhas 433–442) para parar de usar `useTabelasPreco()` e passar a usar as regras `fipe_range` de `useAllEligibilityRules()` (já carregadas no hook `usePlanosCotacao`).
- Lógica nova:
  - Tomar o primeiro plano selecionado (ou o primeiro plano calculado).
  - Pegar suas coberturas (via `planos_coberturas`).
  - Para cada cobertura com regra `fipe_range`, encontrar a faixa que contém `valorFipe` (`de ≤ valor < ate`).
  - Se houver várias coberturas (carro/moto), elas têm o mesmo `intervalo`/`min`/`max` por linha, então qualquer uma serve.
  - Resultado: `{ min: faixa.de, max: faixa.ate - 0.01 }` para exibir como "Faixa enquadrada".
- Fallback: se não houver regra `fipe_range` (catálogo antigo), manter o cálculo atual como fallback silencioso.
- Remover `useTabelasPreco` deste componente caso não seja mais necessário em outro lugar (`fipeMenorInfo` também usa — ver passo 2).

### 2. `fipeMenorInfo` (mesmo arquivo, linhas 391–431)

- A lógica de "FIPE menor" também usa `tabelas_preco_mensalidade` para detectar faixa atual e faixa inferior.
- Substituir pela mesma fonte (`fipe_range` em `entity_eligibility_rules`):
  - Faixa atual = faixa onde `valorFipe` se enquadra.
  - Faixa inferior = faixa imediatamente abaixo no array `faixas`.
  - Diferença de mensalidade = soma das coberturas do plano calculadas em cada faixa (já existe util similar em `usePlanosCotacao` linhas 388–417).

### 3. Helper compartilhado

Criar `src/utils/fipeFaixa.ts` com:
- `obterFaixaFipeAtual(planoCoberturas, allEligibilityRules, valorFipe)` → `{ de, ate, intervalo } | null`
- `obterFaixaFipeAnterior(...)` → mesma assinatura
- Reutilizado por `CotacaoFormDialog` e por `usePlanosCotacao` (futuro, sem mudar comportamento).

### 4. Testes manuais (após aplicar)

- Cotação Rápida → moto Yamaha XTZ250 2015/2016 com FIPE R$ 18.976 deve mostrar:
  - "Faixa enquadrada: R$ 18.000,01 – R$ 21.000,00"
  - Planos Advanced (R$ 218,70) e Advanced + (R$ 238,70) — sem regressão.
- Cotação de carro com FIPE R$ 47.000 deve mostrar faixa de 5 em 5 mil (ex.: "R$ 45.000,01 – R$ 50.000,00").
- Lógica FIPE menor deve continuar oferecendo redução quando aplicável.

## Arquivos a editar

- `src/components/cotacoes/CotacaoFormDialog.tsx` (faixa exibida + FIPE menor)
- `src/utils/fipeFaixa.ts` (novo helper)

## Não vou mexer

- `usePlanosCotacao` (motor já correto).
- `entity_eligibility_rules` (dados já configurados com `intervalo: 3000` para Advanced moto).
- Tabela legada `tabelas_preco_mensalidade` (não tocar — apenas parar de ler dela neste componente).

## Resultado esperado

A "Faixa enquadrada" passa a refletir a tabela real do Guia V11 (3 em 3 mil para motos, 5 em 5 mil para carros), sincronizada com o motor de preço. O bug visual desaparece sem alterar nenhum valor de mensalidade.

