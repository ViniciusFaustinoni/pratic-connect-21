## Problema

Na tela `app/rastreamento` (área do associado), o overlay **"Rastreador ativado / Aguardando primeira posição GPS / Verificar agora"** cobre o mapa inteiro com `position: absolute inset-0 z-[1000]` e fundo `bg-background/90 backdrop-blur-sm`. Mesmo quando o veículo já tem posição (badge "PARADO" visível) ou quando o associado quer apenas ver o mapa em segundo plano, o card permanece bloqueando — sem botão de fechar.

Arquivo: `src/pages/app/AppRastreamento.tsx`, linhas 374-391.

## O que mudar

Transformar o overlay bloqueante em uma **faixa (banner) não-bloqueante** no topo do mapa, no mesmo padrão já usado para "Sem comunicação há Xh" (linhas 397-414):

1. Remover o `absolute inset-0` + `bg-background/90 backdrop-blur-sm` que cobre tudo.
2. Renderizar uma faixa compacta no topo (`absolute top-2 left-2 right-2 z-[1000]`) com:
   - Ícone `Radio` pulsante
   - Texto curto: "Rastreador ativado — aguardando primeira posição GPS"
   - Botão "Verificar agora" (mantém `handleRefresh`)
   - Botão "X" para o associado fechar e ver o mapa por baixo (estado local `dismissAguardando`)
3. O mapa continua renderizando atrás (centralizado em SP/Brasil quando não há posição), permitindo interação.
4. Quando a primeira posição chegar (`hasValidPosition === true`), o banner some automaticamente.

Sem mudanças em lógica de backend, hook de posição ou polling — apenas a apresentação da camada de aviso.

## Critério de pronto

- Abrindo o app como associado em veículo recém-instalado, vê-se o mapa com banner curto no topo e o mapa interativo embaixo.
- Botão "X" oculta o banner até refresh; "Verificar agora" continua disparando `handleRefresh`.
- Se já houver posição, o banner não aparece (comportamento atual preservado).