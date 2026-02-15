

# Mostrar numero do B.O. preenchido pelo associado

## Problema

O campo "N B.O." na secao "Informacoes do Sinistro" mostra `sinistro.bo_numero`, que esta vazio porque o numero foi preenchido pelo associado atraves do link de auto-vistoria e ficou armazenado em `linkEvento.dados_etapa2.numero_bo`.

## Solucao

Arquivo: `src/pages/eventos/SinistroAnalise.tsx` (linha 571)

Alterar o valor exibido para usar o numero do B.O. do link de evento como fallback:

- Antes: `sinistro.bo_numero`
- Depois: `sinistro.bo_numero || linkEvento?.dados_etapa2?.numero_bo`

Isso garante que, se o campo `bo_numero` do sinistro estiver vazio, o numero preenchido pelo associado na etapa 2 do link de evento sera exibido.

Alteracao de uma unica linha, sem impacto em outros componentes.

