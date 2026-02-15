

# Mostrar Valores Individuais de Servico e Mao de Obra na Tabela de Orcamento

## Problema

Atualmente, a tabela "Itens do Orcamento" na pagina de Analise do Evento exibe os itens de mao de obra e servico com valor unitario como texto cinza discreto ("---" quando nulo). O rodape mostra apenas o total agregado ("Custo medio estimado de mao de obra: R$ 300,00"), sem detalhar quanto custa cada servico individualmente.

O analista de eventos precisa ver o custo de **cada** item de mao de obra e servico preenchido pelo regulador.

## Alteracoes

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

**1. Exibir valor unitario de servico/mao de obra com destaque (linhas 1065-1069)**

Substituir o bloco que mostra o valor de itens nao-peca (atualmente texto cinza discreto) por uma exibicao mais clara:
- Se `item.valor_unitario` existir: mostrar valor formatado em negrito (sem ser cinza)
- Se nao existir: manter "---"

**2. Adicionar coluna "Valor Total" na tabela (apos a coluna "Valor Unit.")**

Adicionar uma nova coluna "Total" que calcula `valor_unitario * quantidade` para cada item:
- Para pecas: usa o valor da IA (se disponivel) ou o valor manual multiplicado pela quantidade
- Para mao de obra/servico: `item.valor_unitario * item.quantidade`

**3. Atualizar rodape com resumo por categoria (linhas 1077-1081)**

Substituir o resumo unico por um detalhamento:
- Total Mao de Obra: R$ X (soma dos itens tipo mao_de_obra)
- Total Servicos: R$ Y (soma dos itens tipo servico)
- Total Pecas: R$ Z (soma dos valores de pecas, quando preenchidos)

Manter o total geral ao final.

## Resultado Visual Esperado

```text
| Descricao                    | Tipo         | Qtd | Fornecedor | Valor Unit. | Total    |
|------------------------------|--------------|-----|------------|-------------|----------|
| Para-choque Dianteiro - ...  | Peca         |  1  | [Select]   | R$ 0,00     | R$ 0,00  |
| Troca de peca                | Mao de Obra  |  1  | --         | R$ 150,00   | R$ 150,00|
| troca do para choque         | servico      |  1  | --         | R$ 150,00   | R$ 150,00|

Mao de obra: R$ 150,00 | Servicos: R$ 150,00
Custo medio estimado (mao de obra + servicos): R$ 300,00
```

## Detalhes Tecnicos

| Local | Alteracao |
|---|---|
| Linha 982-986 (thead) | Adicionar coluna `<th>Total</th>` |
| Linha 1065-1069 (valor nao-peca) | Exibir `item.valor_unitario` com fonte normal (nao cinza) quando existir |
| Apos linha 1070 (nova td) | Adicionar celula com calculo `valor_unitario * quantidade` |
| Linhas 1077-1081 (rodape) | Detalhar totais por categoria: mao de obra, servicos e pecas separadamente |

