

# Fluxo pos-imprevisto: transicao suave para proxima tarefa

## Situacao Atual

Quando o instalador confirma o imprevisto (duplo check), o status do servico muda para `nao_compareceu`. A RPC `buscar_tarefa_atual_profissional` so retorna servicos com status `em_rota`, `em_andamento` ou `agendada`, entao a tarefa desaparece imediatamente e o instalador ve a tela "Aguardando tarefas".

Tecnicamente o fluxo esta correto -- o servico foi encerrado e o profissional deve receber a proxima tarefa. Porem a transicao e abrupta: a tela muda instantaneamente sem feedback, deixando o instalador sem saber o que aconteceu.

## Problemas de UX

1. **Transicao abrupta**: a tarefa simplesmente some sem confirmacao visual
2. **Sem busca imediata**: o sistema espera o polling de 30s para tentar atribuir a proxima tarefa, em vez de buscar imediatamente
3. **Sem resumo**: o instalador nao ve um feedback claro de que o imprevisto foi registrado com sucesso e o que acontecera a seguir

## Solucao Proposta

### 1. Tela de confirmacao temporaria apos duplo check

Apos confirmar o duplo check, em vez de fechar o dialog e voltar direto para "Aguardando", mostrar uma tela de transicao por 4 segundos com:
- Icone de sucesso
- "Imprevisto registrado com sucesso"
- "O associado recebera o link de reagendamento"
- "Buscando proxima tarefa..."

### 2. Disparo imediato de busca da proxima tarefa

Apos o duplo check, chamar a edge function `atribuir-proxima-tarefa` imediatamente (com a localizacao atual), em vez de esperar os 30 segundos do polling. Isso reduz o tempo ocioso.

### 3. Invalidar queries com timing correto

Garantir que a invalidacao de `tarefa-atual` so aconteca apos a tela de transicao, para evitar a mudanca abrupta.

## Arquivos a Modificar

### `src/components/vistoriador/DuploCheckImprevisto.tsx`
- Apos `handleConfirmar` com sucesso, trocar o dialog de duplo check por um dialog de "sucesso/transicao"
- Adicionar estado `etapa: 'contato' | 'sucesso'` para controlar o que o dialog mostra
- Na etapa `sucesso`, exibir mensagem de confirmacao e spinner de "buscando proxima tarefa"
- Chamar `atribuir-proxima-tarefa` via edge function com a geolocalizacao atual
- Apos 3-4 segundos (ou apos resposta da edge function), fechar o dialog e invalidar as queries

### `src/components/vistoriador/ImprevistoBotao.tsx`
- Ajustar para manter o dialog de duplo check controlando toda a transicao (nao fechar prematuramente)

## Fluxo Revisado

```text
Imprevisto registrado
        |
  Duplo Check (contato + confirmar)
        |
  Status -> nao_compareceu
        |
  Dialog muda para tela de sucesso:
  "Imprevisto registrado com sucesso"
  "Buscando proxima tarefa..."
        |
  Chama atribuir-proxima-tarefa (background)
        |
  Apos 3s ou resposta: fecha dialog, invalida queries
        |
  Se ha proxima tarefa -> aparece automaticamente
  Se nao ha -> tela "Aguardando tarefas" (comportamento normal)
```

## Resultado Esperado

O instalador tera uma transicao suave e informativa: ve a confirmacao do imprevisto, entende que o reagendamento foi enviado, e o sistema ja busca automaticamente a proxima tarefa sem esperar o ciclo de polling.

