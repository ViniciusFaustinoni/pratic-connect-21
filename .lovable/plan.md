

## Plano: Remover aba "Associados" do mapa de monitoramento

### O que muda
Remover a aba "Associados" (mapa de veículos rastreados) da página `/monitoramento/mapa`, mantendo apenas "Equipe" e "Atribuições".

### Correção em `src/pages/monitoramento/Mapa.tsx`

1. Mudar o estado inicial `abaAtiva` de `"associados"` para `"atribuicoes"` (linha 105)
2. Remover o `TabsTrigger` de "associados" (linhas 474-478)
3. Remover o `TabsContent` de "associados" (linhas 491-499)
4. Opcionalmente, remover código morto: `renderMapaVeiculos`, `renderSearchBar`, `renderTrajetoBadge`, `renderVeiculoInfo`, e estados/variáveis relacionados (busca de veículos, trajeto, etc.) — reduz ~300 linhas

### Resultado
A página abrirá direto na aba "Atribuições", com apenas duas abas visíveis: Equipe e Atribuições.

