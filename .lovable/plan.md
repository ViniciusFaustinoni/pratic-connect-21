
# Esconder botao "Gerar Novo Link" quando a auto-vistoria foi completada

## Problema

Quando o associado completa a auto-vistoria de evento (status "Completado"), o botao "Gerar Novo Link" continua aparecendo no card "Link do Evento". Para o analista de eventos, nao faz sentido gerar um novo link se a etapa ja foi concluida.

## Solucao

Adicionar uma prop opcional `hideGerarNovoLink` ao componente `EventoLinkCard`. Quando `true`, o botao "Gerar Novo Link" nao sera exibido.

Nas paginas onde o analista de eventos acessa (`SinistroAnalise.tsx` e `SinistroDetalhe.tsx`), passar essa prop como `true` quando o status do link for `completado`.

## Alteracoes

### 1. `src/components/eventos/EventoLinkCard.tsx`

- Adicionar prop `hideGerarNovoLink?: boolean` na interface
- Na condicao que renderiza o botao (linha 203), adicionar `&& !hideGerarNovoLink` para esconde-lo quando a prop for true

### 2. `src/pages/eventos/SinistroAnalise.tsx`

- Passar `hideGerarNovoLink` ao `EventoLinkCard` quando o link estiver completado (a logica sera dentro do proprio componente, entao basta passar a prop estaticamente como `true` para o perfil analista, ou alternativamente, esconder apenas quando completado)

### 3. `src/pages/eventos/SinistroDetalhe.tsx`

- Mesma alteracao: passar a prop para esconder o botao quando completado

## Abordagem escolhida

A forma mais simples: esconder o botao "Gerar Novo Link" **sempre que o status for `completado`**, independente do perfil. Se a vistoria ja foi completada com sucesso, nao ha motivo para gerar outro link. Isso sera feito diretamente no componente `EventoLinkCard.tsx`, alterando a condicao da linha 203 de:

```
(statusFinal === 'expirado' || statusFinal === 'invalidado' || statusFinal === 'completado')
```

Para:

```
(statusFinal === 'expirado' || statusFinal === 'invalidado')
```

Assim o botao so aparece quando o link expirou ou foi invalidado, nunca quando ja foi completado. Apenas 1 arquivo precisa ser alterado.
