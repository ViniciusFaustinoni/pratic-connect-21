
# Corrigir Card do Link do Evento para status "completado"

## Problema

O banco de dados mostra `status = 'completado'` para o link do evento, mas `etapa_atual = 2`. O card exibe "Etapa 2/3" e a barra de progresso em 66% porque usa `linkAtivo.etapa_atual` sem verificar se o link ja foi concluido.

## Solucao

No componente `src/components/eventos/EventoLinkCard.tsx`, quando o status for `completado`, forcar a exibicao como concluido independente do valor de `etapa_atual`.

### Alteracoes em `src/components/eventos/EventoLinkCard.tsx`

1. **Badge de etapa (linha 173-175)**: Quando `completado`, mostrar "Concluido" em vez de "Etapa X/Y"

2. **Barra de progresso (linhas 178-190)**: Quando `completado`, preencher 100% e mostrar label "Concluido"

3. **Acoes (linhas 236-276)**: Quando `completado`, nao mostrar botoes de "Copiar Link" ou "Gerar Novo" -- o fluxo ja terminou

### Logica

```text
const isCompletado = linkAtivo?.status === 'completado';
const etapaExibida = isCompletado ? totalEtapas : linkAtivo.etapa_atual;
const progressoPct = isCompletado ? 100 : (linkAtivo.etapa_atual / totalEtapas) * 100;
```

## Arquivo alterado

- `src/components/eventos/EventoLinkCard.tsx`
