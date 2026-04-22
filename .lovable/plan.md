

## Resolver o bloqueio "Vistoria sem coordenadas GPS" no mapa de monitoramento

### Diagnóstico

**Por que vistorias ficam sem coordenadas GPS?**

Na criação do serviço (`criar-instalacao-pos-pagamento`, `aprovar-proposta`), o sistema chama `geocode-endereco` (Nominatim/OpenStreetMap). Quando essa chamada falha — Nominatim retorna `429 rate limited`, ou não encontra o endereço (CEP genérico, número fora da base, logradouro mal escrito, bairro novo) — `latitude/longitude` são gravados como `null` e o serviço fica "órfão" no mapa. Não há retry posterior nem fila de re-geocodificação.

**Por que a "reatribuição" parece não funcionar?**

Os botões de **Realocar** (`MapPinned`), **Atribuir Técnico** e **Atribuir Prestador** têm dois pontos de entrada:

| Local | Existe quando GPS é null? |
|---|---|
| Popup do Marker no mapa | ❌ Não — sem coordenada não há marker |
| Card na lista lateral | ⚠️ Parcial — só `Atribuir Técnico/Prestador` (UserPlus) e `Pencil` (alterar endereço) aparecem; **Realocar e Reagendar não estão na lista** |

Resultado: no card da lista, **clicar no card** dispara `selecionarVistoria()` → toast de erro porque tenta posicionar o mapa numa coordenada inexistente. O usuário interpreta como "a função quebrou", mas os botões à direita do card (`UserPlus` azul, `Send` verde, `Pencil` roxo) **funcionam** e não dependem de GPS — o `Pencil` (Alterar endereço/tipo) inclusive **re-geocodifica automaticamente** ao salvar via `useAlterarEnderecoTipo`.

Falta apenas: (1) deixar isso óbvio na UI, (2) parar de bloquear o card inteiro com o toast, (3) oferecer um botão direto de "Corrigir GPS" e (4) ter uma rotina que reprocesse vistorias sem coordenadas em lote.

### Correção

**1. Não tratar mais clique no card como erro quando falta GPS**

Em `MapaVistoriasContent.tsx → selecionarVistoria`, trocar o `toast.error('Vistoria sem coordenadas GPS')` por um comportamento útil: marcar a vistoria como selecionada (highlight visual) e mostrar um toast informativo com ação "Corrigir endereço" que abre direto o `AlterarEnderecoTipoDialog` pré-preenchido com o endereço atual.

**2. Adicionar botões "Realocar" e "Reagendar" também no card da lista**

Hoje só estão dentro do Popup do Marker. Para serviços `tipo_servico='instalacao'` no card da lista, adicionar os mesmos dois botões (já existe state e handlers; é só renderizar). Sem GPS, esses botões continuam funcionando porque não dependem de coordenadas — o problema atual é que estão escondidos.

**3. Botão dedicado "Corrigir GPS" no card quando `latitude` é null**

Substituir o atual `<p>⚠️ Sem coordenadas GPS</p>` por um botão amarelo "⚠️ Corrigir endereço para liberar GPS" que abre o `AlterarEnderecoTipoDialog` (que já chama `geocode-endereco` ao salvar). Atalho de 1 clique para o caminho que já existe.

**4. Re-tentar geocodificação automática on-demand**

Criar uma edge function nova `geocode-servico-retry` que recebe `servicoId`, lê o endereço atual de `servicos`, chama `geocode-endereco` e atualiza `latitude/longitude` se obtiver resultado. Expor um botão "Tentar geolocalizar de novo" no mesmo lugar do "Corrigir endereço" — útil quando o endereço está correto e a falha foi transiente (rate limit do Nominatim).

**5. Aliviar a fonte do problema na criação**

Em `geocode-endereco`:
- Aumentar o retry para 2 tentativas com 2s de intervalo em caso de 429.
- Adicionar fallback final por **CEP-only** via ViaCEP/BrasilAPI quando Nominatim retornar zero resultados (já existe a lógica de "bairro+cidade", adicionar CEP como último recurso).

Isso reduz o volume de serviços que nascem sem coordenada, mas **não substitui** a UI de correção (vai sempre haver casos limites).

**6. Indicador de fila no topo do mapa**

Adicionar um chip discreto no header da página `/monitoramento/mapa` com a contagem de "Vistorias sem GPS" e um botão "Ver todas" que filtra a lista lateral. Hoje as vistorias órfãs ficam diluídas no meio das outras e ninguém repara até elas vencerem o prazo.

### Critérios de aceitação

1. Clicar num card de vistoria sem GPS na lista lateral **não** mostra mais toast de erro — em vez disso destaca o card e oferece ação de correção.
2. Card da lista para `tipo_servico='instalacao'` mostra os botões "Realocar" e "Reagendar" (paridade com o popup).
3. Quando `latitude` é null, o card mostra um botão amarelo "Corrigir endereço" que abre o `AlterarEnderecoTipoDialog`.
4. Há um botão "Tentar geolocalizar de novo" que invoca a nova edge function `geocode-servico-retry` e atualiza o serviço no lugar (sem precisar reabrir endereço).
5. `geocode-endereco` faz fallback por CEP via ViaCEP quando Nominatim não encontra nada.
6. Header do mapa mostra "X sem GPS" como chip clicável que filtra a lista para esses casos.
7. O coordenador de monitoramento da imagem (KAIKE) consegue, a partir do card da vistoria sem GPS, em até 2 cliques: (a) corrigir o endereço e gerar GPS, ou (b) realocá-la para outra rota/base.

### Fora de escopo

- Migrar fluxo legado da tabela `vistorias` (a view já cobre, e os mesmos botões já operam sobre `servicos`).
- Trocar o provider de geocodificação (Nominatim → Google Maps Geocoding API) — pode ser feito depois, é decisão de custo/precisão.
- Mexer no fluxo de cadastro do consultor (a captura inicial do endereço continua igual; o reforço é no servidor).

