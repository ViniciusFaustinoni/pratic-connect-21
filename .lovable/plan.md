
# Posicao do Veiculo na Hora do Evento para o Analista

## Contexto

A API Softruck ja esta integrada via edge function `rastreador-historico`, que consulta `/v2/vehicles/{id}/trajectories/` com filtros de data. Isso permite buscar posicoes retroativas sob demanda, sem depender do polling de 10 em 10 minutos.

O componente `TrajetoSinistroCard` ja usa essa edge function para exibir o trajeto das 24h anteriores ao evento -- porem so aparece nas telas `SinistroAnalise.tsx` e `SinistroDetalhe.tsx`. A tela do analista de eventos (`EventoAnaliseDetalhe.tsx`) nao possui nenhum componente de mapa ou trajeto.

## Sobre o polling de 10 em 10 minutos

O `sync-rastreadores` (cron) grava posicoes no banco a cada 10 minutos. Isso e util para o monitoramento geral, mas para analise de eventos **nao e necessario** -- a API de trajetos da Softruck retorna o historico completo com granularidade muito maior (pontos a cada poucos segundos). Portanto, para o caso de uso de analise, a consulta sob demanda ja resolve sem depender do cron.

## Alteracoes

### 1. Adicionar secao de Mapa/Trajeto na tela do Analista de Eventos

**Arquivo:** `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

- Importar `TrajetoSinistroCard` (componente ja existente e funcional)
- Adicionar uma nova secao no Accordion (entre "Cronologia" e "Relato") com o card de trajeto
- Passar `veiculoId`, `dataOcorrencia`, `localOcorrencia`, `sinistroId` e dados do veiculo como props
- Condicionar a exibicao a existencia de `sinistro.veiculo_id`

### 2. Verificar RLS da tabela `rastreadores`

A tela do analista precisa consultar a tabela `rastreadores` (via `TrajetoSinistroCard` internamente) para descobrir o ID do rastreador do veiculo. Verificar se o role `analista_eventos` tem permissao SELECT nessa tabela. Se nao tiver, criar migration para adicionar.

## Resultado esperado

O analista de eventos vera, na tela de analise do sinistro:

1. Mapa com o trajeto das 24h anteriores ao evento (dados vindos diretamente da API Softruck)
2. Marcador no local do sinistro (ultima posicao antes do horario do evento)
3. Paradas identificadas ao longo do trajeto
4. Badge indicando se os dados vieram da API ou do banco local
5. Opcao de expandir o mapa em tela cheia

Tudo isso sem depender do polling de 10 em 10 minutos -- a consulta e feita sob demanda usando o endpoint de trajetos da Softruck.

## Secao tecnica

```text
EventoAnaliseDetalhe.tsx
  |
  +-- AccordionItem "trajeto-veiculo" (novo)
  |     |
  |     +-- TrajetoSinistroCard (componente existente)
  |           |
  |           +-- useQuery -> rastreadores (busca rastreador do veiculo)
  |           +-- useQuery -> supabase.functions.invoke('rastreador-historico')
  |                 |
  |                 +-- Edge Function rastreador-historico
  |                       |
  |                       +-- Softruck API: /v2/vehicles/{id}/trajectories/
  |                             (filtros: 24h antes da data_ocorrencia)
```

Nenhuma nova edge function ou tabela sera criada. Apenas:
- 1 alteracao de arquivo (EventoAnaliseDetalhe.tsx)
- 1 possivel migration RLS (se necessario para tabela rastreadores)
