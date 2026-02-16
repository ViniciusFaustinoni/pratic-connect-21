

# Trajeto do Veiculo no Mapa de Monitoramento e na Analise de Eventos

## 1. Mapa de Monitoramento - Botao "Ver Trajeto" no Popup do Veiculo

### O que muda

Ao clicar no marcador de um veiculo no mapa (`src/pages/monitoramento/Mapa.tsx`), o popup atual ja mostra info do veiculo, WhatsApp e Google Maps. Sera adicionado um botao **"Ver Trajeto"** que, ao ser clicado:

1. Busca as posicoes das ultimas 4 horas da tabela `rastreador_posicoes` (dados ja salvos pelo cron)
2. Renderiza uma `Polyline` no mapa conectando os pontos
3. Mostra badges com total de pontos e velocidade media
4. Permite fechar/limpar o trajeto clicando novamente

### Implementacao

**Novo estado no componente `Mapa`:**
- `trajetoAtivo: string | null` (rastreador_id do veiculo cujo trajeto esta visivel)
- `pontosTrajetoAtivo: Array<{ latitude, longitude, velocidade, data_posicao }>` (pontos carregados)

**Query sob demanda:** Ao clicar "Ver Trajeto", faz uma query direta ao banco:
```sql
SELECT latitude, longitude, velocidade, data_posicao
FROM rastreador_posicoes
WHERE rastreador_id = :id
  AND data_posicao >= NOW() - INTERVAL '4 hours'
ORDER BY data_posicao ASC
```

**Renderizacao:** Adicionar `<Polyline>` e `<CircleMarker>` (inicio/fim) dentro do `MapContainer` existente, condicionado a `trajetoAtivo`.

### Arquivo alterado
| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/Mapa.tsx` | Adicionar estado de trajeto, botao no popup, query sob demanda, Polyline + marcadores de inicio/fim, badge de velocidade media |

---

## 2. Analise de Eventos (Analista) - Trajeto de 4h com Velocidade Media

### O que muda

O `TrajetoSinistroCard` atualmente mostra 24h de historico. Para o analista de eventos, o card na pagina `EventoAnaliseDetalhe.tsx` passara a usar **4 horas** antes da ocorrencia (em vez de 24h) e exibira a **velocidade media** calculada a partir dos pontos.

### Implementacao

**Adicionar prop `horasAnteriores` ao `TrajetoSinistroCard`:**
- Default: 24 (manter comportamento atual em `SinistroDetalhe` e `SinistroAnalise`)
- Na chamada em `EventoAnaliseDetalhe.tsx`: passar `horasAnteriores={4}`

**Calcular velocidade media:** A partir do array `trajeto`, calcular a media das velocidades dos pontos onde `velocidade > 0` (para excluir paradas). Exibir como badge: `"Vel. media: XX km/h"`.

**Atualizar titulo:** Quando `horasAnteriores={4}`, o titulo muda para "Trajeto - 4h Antes do Evento".

### Arquivos alterados
| Arquivo | Alteracao |
|---|---|
| `src/components/sinistros/TrajetoSinistroCard.tsx` | Adicionar prop `horasAnteriores` (default 24), usar no `subHours`, calcular e exibir velocidade media, ajustar titulo dinamicamente |
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Passar `horasAnteriores={4}` ao `TrajetoSinistroCard` |

---

## Resumo de Alteracoes

| Arquivo | Descricao |
|---|---|
| `src/pages/monitoramento/Mapa.tsx` | Botao "Ver Trajeto" no popup, query ao `rastreador_posicoes` (4h), renderizar Polyline com velocidade media |
| `src/components/sinistros/TrajetoSinistroCard.tsx` | Nova prop `horasAnteriores`, calculo de velocidade media, titulo dinamico |
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Passar `horasAnteriores={4}` |

Nenhuma migration necessaria - os dados ja estao na tabela `rastreador_posicoes` alimentada pelo cron job.

