

## Plano: Substituir alertas de categoria hardcoded por dados reais

### Problema

O alerta "Veículo de leilão: sem cobertura de incêndio" exibido na Cotação Rápida vem de um texto estático gravado na tabela `configuracoes` (chave `observacoes_categoria`). Não é baseado em coberturas ou benefícios reais. A tabela `benefit_category_exclusions` está vazia. As restrições reais estão em `entity_eligibility_rules`.

### Solução

Remover o alerta estático e gerar a mensagem dinamicamente a partir das regras de elegibilidade reais. Quando o usuário seleciona uma categoria (ex: leilão), o sistema identifica quais coberturas/benefícios seriam filtrados para aquele tipo de placa e exibe a lista real.

### Arquivos alterados

**1. `src/components/cotacoes/CotacaoFormDialog.tsx`**
- Remover uso de `useObservacoesCategoria` para o alerta
- Substituir `alertaCategoria` por lógica que consulta as regras de elegibilidade carregadas (via `useAllEligibilityRules`) e identifica coberturas que excluem o tipo de placa selecionado
- Cruzar coberturas dos planos visíveis com regras `tipo_placa` para listar nomes reais de itens não cobertos

**2. `src/components/cotacao/EtapaCategoriaVeiculo.tsx`** (cotação multi-step)
- Mesmo ajuste: substituir `getRestricaoCategoria` (que já retorna `null`) por lógica dinâmica baseada nas regras reais

**3. Criar utilitário `src/utils/alertaCategoriaElegibilidade.ts`**
- Função reutilizável que recebe: categoria selecionada, regras de elegibilidade, lista de coberturas/benefícios
- Retorna lista de nomes de itens inelegíveis para aquela categoria
- Gera mensagem formatada: "Veículo de leilão: sem [Incêndio], [Alagamento]" (nomes reais do banco)

### Lógica do utilitário

```text
Para cada cobertura/benefício no catálogo:
  1. Buscar regras tipo_placa do item em entity_eligibility_rules
  2. Se o item TEM regra tipo_placa E a categoria selecionada NÃO está na lista de values → item é inelegível
  3. Coletar nomes dos itens inelegíveis
  4. Gerar mensagem: "{Label da categoria}: sem {lista de itens}"
```

### Não alterado
- Tabela `configuracoes` (campo `observacoes_categoria` pode ser mantido para outros usos futuros)
- Motor de cotação (`usePlanosCotacao`) — já filtra corretamente
- `benefit_category_exclusions` — não é usada neste fluxo
- Alertas de depreciação (bloco separado, já correto)

### Resultado esperado
O alerta exibirá dinamicamente os nomes reais de coberturas/benefícios excluídos para a categoria selecionada, baseado nas regras de elegibilidade do banco.

