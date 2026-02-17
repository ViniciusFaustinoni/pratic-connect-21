

# Card de Analise de Risco com IA para Eventos de Colisao

## Resumo

Criar uma edge function que utiliza a Lovable AI (Gemini) para analisar automaticamente um sinistro de colisao e gerar uma pontuacao de risco de fraude (0-10), com relatorio explicativo. O resultado sera exibido como um card destacado no topo da pagina de detalhe do evento, visivel apenas para Analistas de Eventos e Diretores.

## Dados para Analise de Risco

A IA recebera os seguintes dados ja disponiveis no sistema:

| Verificacao | Fonte de Dados | Logica |
|---|---|---|
| Tempo entre evento e comunicacao | `sinistro.data_ocorrencia` vs `sinistro.created_at` | Se > 6h, aumenta risco |
| Velocidade media do veiculo | `rastreador_posicoes` (4h antes do evento) | Velocidades muito baixas ou inconsistentes com colisao |
| Parecer do regulador | `vistorias_evento.dados_vistoria.parecer_tecnico` + `recomendacao` | Se regulador recomenda "analise detalhada", aumenta risco |
| Custo de mao de obra e servicos | `vistorias_evento.dados_vistoria.valor_total_orcamento` vs `veiculo.valor_fipe` | Se custo/FIPE > 40%, sinal de atencao |
| Distancia GPS (local informado vs rastreador) | `sinistro.latitude_informada/longitude_informada` vs `sinistro.rastreador_lat_momento/rastreador_lng_momento` | Se > 10km, aumenta risco |

Dados adicionais enviados como contexto: eventos anteriores do associado, tempo de associacao, status de adimplencia, tipo de dano (parcial/total).

## Arquitetura

```text
Frontend (card)                Edge Function              Lovable AI Gateway
     |                              |                           |
     |--- POST /analise-risco-ia ---|                           |
     |   { sinistro_id }            |--- busca dados DB --------|
     |                              |--- monta prompt --------->|
     |                              |<-- resposta JSON ---------|
     |<-- { score, relatorio } -----|                           |
     |                              |                           |
     |--- renderiza card ---------->|                           |
```

## Mudancas

### 1. Nova Edge Function: `supabase/functions/analise-risco-ia/index.ts`

- Recebe `sinistro_id` via POST (com autenticacao)
- Busca todos os dados necessarios no banco:
  - Sinistro (datas, coordenadas, tipo)
  - Veiculo (valor_fipe)
  - Vistoria do regulador (parecer, orcamento, tipo_dano)
  - Eventos anteriores do associado
  - Posicoes do rastreador (4h antes) para velocidade media
  - Adimplencia
- Calcula previamente no backend (sem depender da IA):
  - Horas entre evento e comunicacao
  - Distancia GPS em km
  - Velocidade media (dos pontos de rastreamento)
  - Ratio custo/FIPE
- Monta um prompt estruturado para a IA com tool calling para extrair:
  - `pontuacao_risco` (0-10, inteiro)
  - `nivel` ("baixo" | "medio" | "alto" | "critico")
  - `resumo` (2-3 frases do relatorio)
  - `fatores` (array com nome do fator, valor encontrado, impacto no risco)
  - `recomendacao` (texto curto para o analista)
- Chama `https://ai.gateway.lovable.dev/v1/chat/completions` com model `google/gemini-3-flash-preview`
- Retorna o JSON estruturado

### 2. Atualizar `supabase/config.toml`

Adicionar:
```text
[functions.analise-risco-ia]
verify_jwt = false
```

### 3. Novo componente: `src/components/analista-eventos/CardAnaliseRiscoIA.tsx`

Card visual que:
- Recebe `sinistroId` como prop
- Faz a chamada via `supabase.functions.invoke('analise-risco-ia', ...)`
- Exibe um estado de loading (skeleton com icone de IA)
- Renderiza o resultado:
  - Barra de risco colorida (verde 0-3, amarelo 4-6, laranja 7-8, vermelho 9-10)
  - Pontuacao grande e nivel textual
  - Lista de fatores analisados com impacto visual (setas, badges)
  - Resumo da IA em texto
  - Recomendacao em destaque
- Botao "Reanalisar" para refazer a chamada

### 4. Integrar na pagina do Analista: `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

- Importar e renderizar `CardAnaliseRiscoIA` logo apos o header (linha 183), antes do Accordion
- Condicional: so exibir se `sinistro.tipo` inclui "colisao"

### 5. Integrar na pagina do Diretor: `src/pages/eventos/SinistroAnalise.tsx`

- Importar e renderizar `CardAnaliseRiscoIA` na area de analise, tambem condicionado a colisao e status `aguardando_analise`

## Exemplo Visual do Card

```text
+-----------------------------------------------------+
|  [icone IA] Analise de Risco - Inteligencia Artificial |
|                                                       |
|  PONTUACAO: [====------] 4/10  MEDIO                 |
|                                                       |
|  Fatores analisados:                                  |
|  [!] Tempo comunicacao: 8h (+2.0 risco)              |
|  [v] Distancia GPS: 0.3km (OK)                       |
|  [v] Velocidade media: 45km/h (compativel)           |
|  [!] Custo/FIPE: 35% (atencao)                      |
|  [v] Parecer regulador: Aprovar                      |
|                                                       |
|  Resumo: O sinistro apresenta risco moderado. O      |
|  tempo de comunicacao acima de 6h e o ponto           |
|  principal de atencao. Demais indicadores normais.    |
|                                                       |
|  Recomendacao: Solicitar justificativa do atraso na   |
|  comunicacao antes de aprovar.                        |
|                                                       |
|  [Reanalisar]                                        |
+-----------------------------------------------------+
```

## Arquivos criados/alterados

1. `supabase/functions/analise-risco-ia/index.ts` -- nova edge function
2. `supabase/config.toml` -- registro da funcao
3. `src/components/analista-eventos/CardAnaliseRiscoIA.tsx` -- novo componente
4. `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` -- integrar card
5. `src/pages/eventos/SinistroAnalise.tsx` -- integrar card (diretor)

