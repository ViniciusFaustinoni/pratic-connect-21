## Problema

No modal de Troca de Titularidade aparece "Erro de comunicação com o rastreador / Serviço de rastreamento temporariamente indisponível" e "Última comunicação" fica em branco — embora o rastreador esteja funcionando e o mapa em outras telas mostre a posição.

## Causa raiz

A edge `rastreador-posicao` foi desenhada para *degradar bem*: quando a API da plataforma (Softruck/Rede) falha, ela responde **HTTP 200** com `success: false` + `fallback: true` + a **última posição conhecida do banco** em `data.posicao` e uma `mensagem` explicativa.

Mas o hook `useRastreadorTempoReal` (`src/hooks/useRastreadorPosicao.ts`) faz:

```ts
if (!data.success) throw new Error(data.error);
```

Isso **descarta o fallback** e força a UI a renderizar estado de erro mesmo quando há posição conhecida. Como o `RastreadorBlock` da troca lê `posicao?.data_posicao` (que vira `null` por causa do throw) e depois mostra o bloco vermelho de erro, o usuário vê "Erro" + "Última comunicação: —".

O `MapaRastreador` "parece funcionar" porque, para os rastreadores testados naquela tela, a edge retorna `success: true`. Mas o mesmo problema afetaria o mapa quando a plataforma tivesse uma falha transitória.

## Solução

Alinhar a UI à intenção do backend: tratar `success: false` **com fallback** como degradação aceitável (mostrar última posição conhecida + aviso suave), não como erro fatal.

### 1. `src/hooks/useRastreadorPosicao.ts` — `useRastreadorTempoReal`

- Não jogar exceção quando o body retornar `success: false` + `posicao` (fallback).
- Expor um novo flag `serviceError: boolean` (true só quando a plataforma falhou) junto com `mensagem`.
- Manter `error` apenas para falhas reais de rede/edge (sem body).
- Ajustar o `atualizarManual` para usar a mesma lógica e informar via `toast.info` quando for fallback.

Resultado: `posicao`, `tempoReal`, `mensagem` continuam disponíveis; a UI passa a renderizar a última posição conhecida sempre que existir — exatamente o comportamento que o usuário descreve como "lógica do mapa".

### 2. `src/components/troca-titularidade/VeiculoCompletoCard.tsx` — `RastreadorBlock`

- Usar `posicao?.data_posicao` como "Última comunicação" (já feito, mas agora vai vir preenchido pelo fallback).
- Mostrar o bloco vermelho **apenas** quando não há posição alguma (`!posicao && (error || serviceError)`).
- Quando `serviceError && posicao` existir, mostrar um aviso suave (texto âmbar pequeno) tipo: *"Tempo real indisponível — exibindo última posição conhecida"* — mantém transparência sem alarmar.

### 3. (Opcional, sem mudança visual) `MapaRastreador.tsx`

Mesma melhoria de mensagem suave já encaixa porque o hook agora entrega `posicao` + `mensagem` em vez de `error`. Não é necessário tocar no JSX a menos que queira; deixo de fora desta entrega.

## Arquivos alterados

- `src/hooks/useRastreadorPosicao.ts` — não-throw em fallback, novo `serviceError`.
- `src/components/troca-titularidade/VeiculoCompletoCard.tsx` — render condicional do bloco de erro / aviso suave.

## Fora de escopo

- Edge function `rastreador-posicao` (já se comporta corretamente).
- Schema, cron, lógica de plataforma.
- Outros consumidores do hook continuarão recebendo `posicao` quando antes recebiam `null` — comportamento mais correto em todos os casos.