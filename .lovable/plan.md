## Problema

A aba "Veículos Suspensos" mostra vazio, mas o banco tem 12 veículos elegíveis (3× "Adesão cancelada — não instalou no prazo", 4× "Instalação não realizada no prazo de 48h/72h após assinatura/agendamento", 1× "Recusa do instalador", etc.).

O hook `useVeiculosSuspensos.ts` usa:

```ts
.not('status', 'in', '(cancelado,inativo)')
```

`inativo` **não existe** no enum `status_veiculo` (valores reais: `em_analise`, `aprovado`, `instalacao_pendente`, `ativo`, `suspenso`, `cancelado`, `sinistrado`, `recusado`). O PostgREST rejeita a query inteira (`invalid input value for enum status_veiculo: "inativo"`), e o React Query devolve erro silencioso — por isso a lista fica vazia.

## Correção

Editar `src/hooks/useVeiculosSuspensos.ts`:

1. Trocar `.not('status', 'in', '(cancelado,inativo)')` por `.not('status', 'in', '(cancelado)')` (única terminal real para esta fila — `sinistrado` e `recusado` ainda podem demandar vistoria interna; `cancelado` é o único que deve sumir).
2. Adicionar `console.error` ou `throw` explícito em caso de erro pra evitar regressão silenciosa futura (o `throw error` já existe — manter).

Sem mudanças em UI, edge function, ou critério de motivo (os patterns ILIKE já cobrem todos os motivos vistos no banco).

## Verificação após o fix

Recarregar a aba — devem aparecer ~12 cards com placas reais, badge vermelho de contagem no TabsTrigger e botão "Realizar Vistoria Interna" habilitado para o diretor de teste.

## Arquivos

- Editar: `src/hooks/useVeiculosSuspensos.ts` (uma linha)
