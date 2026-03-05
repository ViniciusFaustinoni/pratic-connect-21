

# Mapa de Monitoramento — Busca individual + Aba padrao Veiculos

## Problema

1. A aba "Veiculos" carrega TODOS os veiculos da view `view_rastreadores_posicao` e renderiza todos os markers no mapa — lento com muitos registros.
2. A aba padrao e "vistorias" (`abaAtiva` inicializa com `"vistorias"`), mas o pedido e que "veiculos" seja a primeira aba.

## Alteracoes

### 1. Trocar aba padrao para "veiculos"

Linha 137: mudar `useState<string>("vistorias")` para `useState<string>("veiculos")`.

Reordenar os `TabsTrigger` no JSX para que "Veiculos" apareca primeiro (linhas 670-679).

### 2. Remover carregamento automatico de todos os veiculos

Substituir a query atual (que busca todos) por uma busca sob demanda: o mapa inicia vazio, o usuario digita uma placa na barra de busca, e so entao o sistema busca aquele veiculo especifico.

**Fluxo:**
- Barra de busca por placa no topo do mapa (campo de texto + botao buscar)
- Ao digitar >= 3 caracteres e submeter, busca na `view_rastreadores_posicao` com filtro `placa.ilike.%termo%`
- Exibe resultados em dropdown/lista abaixo do campo (maximo 10 resultados)
- Ao selecionar um resultado, mostra apenas aquele marker no mapa e centraliza
- Botoes de acao no popup permanecem (WhatsApp, Google Maps, Trajeto, Atualizar posicao)

### 3. Remover sidebar de lista e drawer mobile

Como so um veiculo e exibido por vez, a sidebar com lista completa e o drawer mobile nao sao mais necessarios. Substituidos pela barra de busca flutuante sobre o mapa.

## Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/Mapa.tsx` | Aba padrao "veiculos", remover query de todos, adicionar busca por placa, mostrar 1 veiculo no mapa, reordenar tabs |

1 arquivo.

