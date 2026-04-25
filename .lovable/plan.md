## Planilha: Planos × Coberturas × Benefícios × Códigos Hinova

Vou gerar um arquivo `.xlsx` em `/mnt/documents/` com **2 abas**, usando os dados atuais do banco.

### Dados disponíveis no banco
- **287 planos** ativos e visíveis (`planos`)
- **2.865 coberturas** (`coberturas` — campo `codigo_sga` para Hinova, campo `valor` fixo)
- **1.770 benefícios** (`benefits` — campo `codigo_sga`, campo `preco_sugerido`)
- **2.241 vínculos** plano↔cobertura (`planos_coberturas`)
- **1.330 vínculos** plano↔benefício (`planos_beneficios`)
- **2.759 regras de faixa FIPE** em `entity_eligibility_rules` (rule_type='fipe_range') — quando uma cobertura tem essa regra, o valor varia por faixa de FIPE em vez de ser fixo
- Código Hinova do plano: `planos.codigo_sga_plano`

---

### Aba 1 — "Mapa Hinova" (matriz de códigos)

Uma linha por plano. Colunas:

| A | B | C | D | E... |
|---|---|---|---|---|
| Plano (nome) | Coberturas (lista) | Benefícios (lista) | Código Hinova Plano | Código Hinova Cobertura 1, 2, 3... |

- **Coluna B**: nomes das coberturas do plano, separados por `;`
- **Coluna C**: nomes dos benefícios do plano, separados por `;`
- **Coluna D**: `planos.codigo_sga_plano` (vazio quando não configurado)
- **Colunas E em diante**: uma coluna por cobertura do plano, no formato `Nome da Cobertura → código_sga` (ou em branco quando o código não estiver cadastrado). Como o número de coberturas varia por plano, a largura da matriz será o máximo encontrado (ex.: até ~12 coberturas por plano).

### Aba 2 — "Estrutura e Valores"

Uma linha por **item** (cobertura ou benefício) de cada plano, mais o valor do plano:

| Plano | Valor do Plano | Tipo | Item | Valor do Item |
|---|---|---|---|---|
| Select Bronze | R$ 87,50 a R$ 245,30 | Cobertura | Roubo e Furto | R$ 2,50 a R$ 45,00 (varia FIPE) |
| Select Bronze | R$ 87,50 a R$ 245,30 | Cobertura | Colisão | R$ 30,00 (fixo) |
| Select Bronze | R$ 87,50 a R$ 245,30 | Benefício | Carro Reserva 7 dias | R$ 12,00 (fixo) |
| ... | ... | ... | ... | ... |

Lógica de valor:
- **Item com valor fixo**: pega `coberturas.valor` ou `benefits.preco_sugerido`
- **Item com regra `fipe_range`** (entity_eligibility_rules): formata como `R$ MIN a R$ MAX (varia por FIPE)` usando o menor e maior `valor` das faixas
- **Valor do Plano** (coluna B, repetida por linha do mesmo plano): soma de todos os itens
  - Se nenhum item varia por FIPE → valor fixo único
  - Se algum item varia → faixa `R$ MIN a R$ MAX` (somando mínimos vs. somando máximos das faixas)

### Critérios e exclusões
- Apenas planos `ativo=true` e `visivel_gestao=true`
- Apenas coberturas/benefícios efetivamente vinculados ao plano
- Sem coluna de slug, sem IDs UUID, sem categoria, sem demais metadados — apenas o que foi pedido
- Códigos Hinova ausentes ficam como célula vazia (não como "null" ou "—")

### Detalhe técnico
- Script Python com `openpyxl`, executado via `code--exec`
- Consultas SQL para puxar planos + joins de coberturas/benefícios + regras `fipe_range` em uma única passagem
- Formatação: cabeçalhos em negrito, congelar primeira linha, larguras automáticas
- Saída: `/mnt/documents/planos_hinova.xlsx` entregue via `<presentation-artifact>`

Posso prosseguir?
