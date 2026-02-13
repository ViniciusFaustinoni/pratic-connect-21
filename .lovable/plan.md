
# Ocultar botoes de Aprovar e Solicitar Documentos enquanto documentos solicitados estiverem pendentes

## Contexto

Quando documentos sao solicitados para um sinistro, os registros ficam na tabela `sinistro_documentos` com `status = 'pendente'`. Enquanto houver documentos pendentes de envio, os botoes "Aprovar Sinistro" e "Solicitar Documentos" nao devem aparecer, pois nao faz sentido aprovar sem os documentos nem solicitar novos enquanto os anteriores nao foram enviados.

Os botoes voltam a ser exibidos quando todos os documentos tiverem sido enviados (status `enviado` ou `aprovado`).

## Alteracao

| Arquivo | Descricao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar logica condicional para ocultar botoes "Aprovar Sinistro" e "Solicitar Documentos" quando existirem documentos com status `pendente` |

## Detalhes tecnicos

No arquivo `SinistroAnalise.tsx`, na secao de acoes (linha ~495):

1. Calcular se ha documentos pendentes a partir do array `documentos` ja disponivel no hook `useSinistroAnalise`:

```typescript
const temDocsPendentes = documentos.some(doc => doc.status === 'pendente');
```

2. Envolver os botoes "Aprovar Sinistro" e "Solicitar Documentos" com a condicao `!temDocsPendentes`, mantendo apenas o botao "Reprovar Sinistro" sempre visivel.

3. Quando houver documentos pendentes, exibir um aviso informativo no lugar dos botoes ocultos, como:

```
"Aguardando envio de X documento(s) solicitado(s)"
```

Isso usa dados ja carregados pelo hook existente, sem necessidade de queries adicionais.
