

# Mapa no Card de Posicoes GPS + Trajeto via Cron Job

## Problema Atual

1. O card "Trajeto" chama a edge function `rastreador-historico` (API Softruck) em vez de usar os dados ja salvos pelo cron job na tabela `rastreador_posicoes`
2. O card "Posicoes GPS - Evidencia" mostra apenas coordenadas em texto, sem mapa

## Alteracoes

### 1. Card de Trajeto - Usar dados do cron job (`rastreador_posicoes`)

**Arquivo:** `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

Substituir o `TrajetoSinistroCard` (que chama edge function) por um novo componente inline ou dedicado que:
- Busca o `rastreador_id` do veiculo via tabela `rastreadores`
- Consulta `rastreador_posicoes` filtrando por `rastreador_id` e `data_posicao` nas ultimas 4h antes do evento
- Renderiza `MapContainer` com `Polyline` dos pontos
- Calcula e exibe velocidade media
- Mostra marcadores de inicio (verde) e fim (vermelho)

A query sera:
```sql
SELECT latitude, longitude, velocidade, data_posicao
FROM rastreador_posicoes
WHERE rastreador_id = :id
  AND data_posicao BETWEEN :data_inicio AND :data_fim
ORDER BY data_posicao ASC
```

### 2. Card de Posicoes GPS - Adicionar Mapa

**Arquivo:** `src/components/sinistros/ComparacaoPosicoes.tsx`

Adicionar um mini-mapa Leaflet dentro do card existente que mostra:
- Marcador da posicao do rastreador (verde) no horario do evento
- Marcador da posicao informada pelo associado (azul), se disponivel
- Linha conectando os dois pontos quando ambos existem
- O mapa centralizado automaticamente nos pontos disponiveis

### 3. Reorganizar a pagina do analista

**Arquivo:** `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

- O card de trajeto mostra o percurso (4h) usando dados locais do banco
- O card de posicoes GPS (ComparacaoPosicoes) ganha o mini-mapa com a posicao na hora do evento

## Detalhes Tecnicos

### Novo componente: `TrajetoLocalCard`

Sera criado em `src/components/sinistros/TrajetoLocalCard.tsx` para separar a logica de buscar trajeto do banco local (cron) vs API (edge function).

Props:
- `veiculoId: string`
- `dataOcorrencia: string | null`
- `horasAnteriores: number` (default 4)

Logica:
1. Query `rastreadores` para obter `rastreador_id` do veiculo
2. Query `rastreador_posicoes` com filtro de data
3. Renderizar mapa com Polyline + badges de velocidade media e total de pontos

### ComparacaoPosicoes com mapa

Adicionar `MapContainer` de 200px de altura mostrando os marcadores das posicoes. Importar Leaflet apenas quando ha coordenadas disponiveis.

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/components/sinistros/TrajetoLocalCard.tsx` | **Novo** - Card de trajeto usando dados locais do `rastreador_posicoes` |
| `src/components/sinistros/ComparacaoPosicoes.tsx` | Adicionar mini-mapa Leaflet mostrando posicao do veiculo na hora do evento |
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Trocar `TrajetoSinistroCard` por `TrajetoLocalCard` e garantir que `ComparacaoPosicoes` esta presente com mapa |
