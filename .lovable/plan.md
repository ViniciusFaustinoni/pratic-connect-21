

# Sistema de Despacho de Reboque -- "Uber do Guincho"

## Resumo

Criar um sistema automatizado de despacho de reboque onde, ao abrir um chamado de reboque, TODOS os reboquistas ativos recebem um link por WhatsApp. Cada reboquista abre o link em uma pagina publica, ativa a localizacao, ve o valor calculado automaticamente (saida + km x distancia), e decide se aceita. O sistema espera ate 10 minutos e atribui ao mais barato.

---

## Analise do Estado Atual

### O que ja existe
- **Tabela `chamados_assistencia`**: completa com origem_lat/lng, rastreador_lat/lng, destino_lat/lng, prestador_id/nome/telefone, status enum (aberto, aguardando_prestador, prestador_despachado, prestador_a_caminho, em_atendimento, concluido, cancelado_*)
- **Tabela `chamados_assistencia_atendimentos`**: registra acionamentos com hora_acionamento, hora_aceite, hora_chegada, hora_conclusao, valor_servico, valor_total, km_origem_destino
- **Tabela `prestadores_assistencia`**: nome, whatsapp, tipos_servico, tipos_reboque, status, disponivel, raio_atendimento_km
- **Tabela `prestadores_assistencia_valores`**: valor_saida, valor_km, km_franquia, tipo_servico, tipo_reboque, ativo
- **`AtribuirPrestadorModal`**: atribuicao manual (seleciona um prestador da lista)
- **`EnviarLinkPrestadorButton`**: envia localizacao/mensagem via WhatsApp (Evolution API) para UM prestador ja atribuido
- **`MapaChamado`**: componente Leaflet com marcadores, rotas, rastreador
- **`NovoChamadoModal`**: criacao de chamado com busca de localizacao do rastreador via `posicao-veiculo`
- **Pagina publica `/tracking/assistencia/:id`**: ja existe uma rota publica para tracking
- **`publicSupabase`**: cliente Supabase sem autenticacao para paginas publicas
- **Status enum `status_chamado`**: precisa adicionar `aguardando_aceites` (novo status para o timer de 10 min)
- **Edge functions**: `whatsapp-send-text`, `whatsapp-send-location`, `reverse-geocode`, `geocode-endereco`, `posicao-veiculo`

### O que falta
- Tabela de despacho (tokens unicos por reboquista + chamado, aceites, timer)
- Tabela de tracking do reboquista (posicoes periodicas durante o deslocamento)
- Pagina publica do reboquista (`/assistencia/chamado/:token`)
- Edge function para disparo em lote dos links
- Edge function para atribuicao automatica (apos timer)
- Card de "Despacho de Reboque" no painel do analista
- Novo status `aguardando_aceites` no enum

---

## Parte 1: Migracao SQL

### Novo status no enum

```text
ALTER TYPE status_chamado ADD VALUE IF NOT EXISTS 'aguardando_aceites' BEFORE 'aguardando_prestador';
```

### Nova tabela: `despacho_reboque`

Controla o ciclo de despacho (um por chamado).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| chamado_id | uuid FK chamados_assistencia UNIQUE | Chamado vinculado |
| hora_disparo | timestamptz NOT NULL | Quando os links foram disparados |
| hora_limite | timestamptz NOT NULL | hora_disparo + 10 min |
| status | text DEFAULT 'aguardando' | 'aguardando', 'atribuido', 'expirado', 'cancelado' |
| total_enviados | int DEFAULT 0 | Quantos reboquistas receberam link |
| total_aceites | int DEFAULT 0 | Quantos aceitaram |
| total_recusas | int DEFAULT 0 | Quantos recusaram |
| prestador_atribuido_id | uuid FK prestadores_assistencia | Quem foi atribuido |
| valor_atribuido | numeric(12,2) | Valor final atribuido |
| distancia_atribuida_km | numeric(8,2) | Distancia do atribuido |
| ciclo | int DEFAULT 1 | Numero do ciclo (reenvio = ciclo 2, 3...) |
| created_at | timestamptz | Criacao |

### Nova tabela: `despacho_reboque_convites`

Um registro por reboquista por despacho.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| despacho_id | uuid FK despacho_reboque ON DELETE CASCADE | Despacho pai |
| prestador_id | uuid FK prestadores_assistencia | Reboquista |
| token | text NOT NULL UNIQUE | Token unico para o link (uuid) |
| token_expira_em | timestamptz NOT NULL | hora_disparo + 30 min |
| status | text DEFAULT 'enviado' | 'enviado', 'visualizado', 'aceito', 'recusado', 'expirado', 'nao_atribuido' |
| whatsapp_enviado | boolean DEFAULT false | Se a mensagem foi entregue |
| latitude_prestador | numeric(10,7) | Lat do reboquista ao abrir o link |
| longitude_prestador | numeric(10,7) | Lng do reboquista ao abrir o link |
| distancia_km | numeric(8,2) | Distancia calculada ate o veiculo |
| valor_calculado | numeric(12,2) | Valor = saida + (km x distancia) |
| valor_saida | numeric(12,2) | Taxa de saida do prestador |
| valor_km | numeric(12,2) | Valor por km do prestador |
| data_visualizacao | timestamptz | Quando abriu o link |
| data_aceite | timestamptz | Quando aceitou |
| data_recusa | timestamptz | Quando recusou |
| created_at | timestamptz | Criacao |

### Nova tabela: `despacho_reboque_tracking`

Posicoes do reboquista apos ser atribuido.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| chamado_id | uuid FK chamados_assistencia | Chamado |
| prestador_id | uuid FK prestadores_assistencia | Reboquista |
| latitude | numeric(10,7) NOT NULL | Lat |
| longitude | numeric(10,7) NOT NULL | Lng |
| velocidade | numeric(6,2) | Velocidade km/h |
| precisao | numeric(8,2) | Accuracy em metros |
| created_at | timestamptz DEFAULT now() | Timestamp |

### Nova tabela: `despacho_reboque_status_log`

Timeline de progresso do reboquista.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| chamado_id | uuid FK chamados_assistencia | Chamado |
| prestador_id | uuid FK prestadores_assistencia | Reboquista |
| status | text NOT NULL | 'a_caminho', 'chegou_local', 'veiculo_carregado', 'chegou_destino', 'concluido' |
| latitude | numeric(10,7) | Posicao ao registrar |
| longitude | numeric(10,7) | Posicao ao registrar |
| observacao | text | Obs opcional |
| created_at | timestamptz DEFAULT now() | Timestamp |

### RLS Policies

- `despacho_reboque`, `despacho_reboque_convites`: SELECT para analista_eventos, diretor. INSERT/UPDATE via service_role (edge functions).
- `despacho_reboque_convites`: SELECT publico via token (anon pode ler seu proprio convite pelo token). UPDATE anon para status/lat/lng (filtrado por token).
- `despacho_reboque_tracking`: INSERT anon (filtrado por chamado_id + prestador atribuido). SELECT para analista_eventos, diretor.
- `despacho_reboque_status_log`: INSERT anon (via token validado). SELECT para analista_eventos, diretor.

---

## Parte 2: Edge Functions

### 2.1 Nova: `despacho-reboque-disparar`

Dispara o ciclo de despacho para um chamado de reboque:

1. Valida JWT e role (analista_eventos ou diretor)
2. Busca localizacao do veiculo (rastreador ou endereco do chamado)
3. Busca todos os prestadores ativos com tipos_servico incluindo 'reboque' ou 'guincho', whatsapp preenchido, disponivel=true
4. Para cada prestador: gera token UUID, busca valores (valor_saida, valor_km), cria convite
5. Cria registro em `despacho_reboque` com hora_limite = now() + 10 min
6. Envia WhatsApp em lote para cada reboquista (chama `whatsapp-send-text` internamente)
7. Atualiza status do chamado para `aguardando_aceites`
8. Agenda a atribuicao automatica (via pg_cron ou retorno com instrucao de delay)
9. Retorna: total_enviados, despacho_id

### 2.2 Nova: `despacho-reboque-responder`

Endpoint publico (verify_jwt = false) para o reboquista aceitar/recusar:

1. Recebe: token, acao ('aceitar' ou 'recusar'), latitude, longitude
2. Valida token (existe, nao expirado, convite nao ja respondido)
3. Se aceitar: calcula distancia (haversine), calcula valor, salva aceite, incrementa total_aceites no despacho
4. Se 10 aceites atingidos: dispara atribuicao imediata
5. Se recusar: salva recusa
6. Retorna: sucesso + dados do convite atualizado

### 2.3 Nova: `despacho-reboque-atribuir`

Executa a logica de atribuicao (chamada apos timer ou apos 10 aceites):

1. Busca todos os convites com status='aceito' do despacho
2. Ordena por valor_calculado ASC, data_aceite ASC (desempate)
3. Atribui ao mais barato: atualiza despacho, atualiza chamado (prestador_id, status='prestador_a_caminho')
4. Marca convite do atribuido como 'aceito' (ja esta), demais como 'nao_atribuido'
5. Cria atendimento em `chamados_assistencia_atendimentos`
6. Registra historico e notifica analista
7. Se 0 aceites: marca despacho como 'expirado', notifica analista

### 2.4 Nova: `despacho-reboque-tracking`

Endpoint publico (verify_jwt = false) para receber posicoes do reboquista:

1. Recebe: token ou chamado_id + prestador_id, latitude, longitude, velocidade, precisao
2. Valida que o prestador e o atribuido para aquele chamado
3. Insere em `despacho_reboque_tracking`

### 2.5 Nova: `despacho-reboque-status`

Endpoint publico (verify_jwt = false) para o reboquista atualizar progresso:

1. Recebe: token, status ('chegou_local', 'veiculo_carregado', etc.), latitude, longitude, observacao
2. Valida token e que o prestador e o atribuido
3. Insere em `despacho_reboque_status_log`
4. Atualiza status do chamado conforme: chegou_local -> em_atendimento, concluido -> concluido

### 2.6 Nova: `despacho-reboque-consultar`

Endpoint publico (verify_jwt = false) para a pagina do reboquista consultar dados:

1. Recebe: token
2. Retorna: dados do chamado (veiculo, endereco, mapa), status do convite, status do despacho, se ja foi atribuido e a quem
3. Usado para renderizar a pagina publica

### config.toml

```text
[functions.despacho-reboque-responder]
verify_jwt = false

[functions.despacho-reboque-tracking]
verify_jwt = false

[functions.despacho-reboque-status]
verify_jwt = false

[functions.despacho-reboque-consultar]
verify_jwt = false
```

---

## Parte 3: Timer de 10 Minutos

A logica de atribuicao automatica apos 10 minutos sera implementada via **pg_cron**:

1. Ao disparar o despacho, agendar um job unico via `cron.schedule` que chama a edge function `despacho-reboque-atribuir` apos 10 minutos
2. Alternativa mais simples: a edge function `despacho-reboque-responder` verifica, a cada aceite, se ja passou do tempo limite ou se atingiu 10 aceites, e dispara a atribuicao
3. Fallback: a pagina do analista faz polling a cada 10s e, se o timer expirou, chama a atribuicao

Implementacao recomendada: usar `pg_net.http_post` agendado via `pg_cron` para chamar a edge function apos 10 min. Isso garante que a atribuicao aconteca mesmo se ninguem estiver olhando.

---

## Parte 4: Pagina Publica do Reboquista

### Nova rota: `/assistencia/chamado/:token`

Pagina publica (sem login), mobile-first, acessada via link do WhatsApp.

### Novo componente: `src/pages/assistencia/DespachoReboquistaPublico.tsx`

Pagina com 4 estados:

**Estado 1: Permissao de localizacao**
- Fundo escuro, icone de pin grande
- "Ativacao de Localizacao Obrigatoria"
- Botao "Ativar Localizacao" -> `navigator.geolocation.getCurrentPosition()`
- Se negar: tela de erro com "Tentar novamente"

**Estado 2: Detalhes do chamado + valor**
- Chama `despacho-reboque-consultar` com o token
- Card: Dados do veiculo (marca, modelo, placa, cor)
- Card: Mapa Leaflet com dois pins (reboquista azul, veiculo vermelho) + linha
- Card: Valor do servico (destaque grande): "R$ 140,00" com detalhamento (saida + km x distancia)
- Timer regressivo visual (barra de progresso)
- Botao verde "ACEITAR CHAMADO -- R$ 140,00" (sticky bottom)
- Botao vermelho "RECUSAR" (menor)

**Estado 3: Aguardando confirmacao (apos aceite)**
- "Aceite registrado! Aguardando confirmacao..."
- Spinner
- Escuta Supabase Realtime no convite para mudanca de status
- Fallback: polling a cada 5s

**Estado 4a: Chamado confirmado (reboquista atribuido)**
- "CHAMADO CONFIRMADO! Voce foi selecionado!"
- Dados completos: veiculo, endereco, associado nome, telefone (clicavel)
- Mapa com rota
- Botoes: "Ligar para associado", "Abrir no Google Maps"
- Botoes de progresso: "Cheguei no local", "Fotos", "Veiculo carregado", "Cheguei no destino", "Servico concluido"
- Indicador de localizacao ativa (bolinha verde pulsando)
- Aviso: "Mantenha esta pagina aberta"
- `navigator.geolocation.watchPosition()` enviando posicao a cada 15-30s

**Estado 4b: Nao atribuido**
- "Chamado ja aceito por outro prestador. Obrigado!"

**Estado 5: Expirado / Cancelado / Ja atribuido**
- Mensagens correspondentes

### Uso do `publicSupabase`
- A pagina usa o cliente publico (sem auth)
- Chamadas via `supabase.functions.invoke()` para as edge functions publicas

---

## Parte 5: Painel do Analista -- Card "Despacho de Reboque"

### Novo componente: `src/components/assistencia/CardDespachoReboque.tsx`

Integrado na pagina `ChamadoDetalhe.tsx`. Aparece quando o chamado e do tipo reboque/guincho.

**Antes do despacho (chamado aberto):**
- Botao: "Despachar Reboque Automaticamente"
- Ao clicar: confirma e chama `despacho-reboque-disparar`

**Durante o timer (status aguardando_aceites):**
- Timer regressivo visual
- Contadores: Links enviados, Aceites, Recusas, Sem resposta
- Tabela expandivel com cada reboquista: nome, distancia, valor, status, hora
- Botao "Encerrar e atribuir agora"

**Apos atribuicao:**
- Prestador atribuido: nome, valor, distancia
- Status atual do reboquista (a caminho, chegou, etc.)
- Timeline de status do reboquista
- Mini mapa com posicao do reboquista (se tracking ativo)
- Resumo: "X reboquistas aceitaram em Y minutos"

**Se ninguem aceitou:**
- Alerta
- Botoes: "Reenviar para todos" (novo ciclo), "Atribuir manualmente"

**Realtime:** Escuta mudancas em `despacho_reboque` e `despacho_reboque_convites` via Supabase Realtime para atualizar em tempo real.

---

## Parte 6: Integracao no ChamadoDetalhe

### Arquivo: `src/pages/assistencia/ChamadoDetalhe.tsx`

1. Importar `CardDespachoReboque`
2. Renderizar o card quando `tipo_servico` inclui 'reboque' ou 'guincho'
3. Passar chamado_id e dados do chamado como props
4. Manter o fluxo manual (`AtribuirPrestadorModal`) como alternativa -- o analista pode escolher despacho automatico OU manual

---

## Parte 7: Calculo de Distancia

### Funcao utilitaria: Haversine

Calcular distancia em linha reta entre dois pontos (lat/lng). Usar tanto no frontend (pagina do reboquista) quanto no backend (edge functions).

```text
function haversineKm(lat1, lon1, lat2, lon2):
  R = 6371 (raio da Terra em km)
  dLat = (lat2 - lat1) em radianos
  dLon = (lon2 - lon1) em radianos
  a = sin(dLat/2)^2 + cos(lat1) * cos(lat2) * sin(dLon/2)^2
  c = 2 * atan2(sqrt(a), sqrt(1-a))
  return R * c
```

Para o MVP: distancia em linha reta. Futuramente: integrar API de rotas (OSRM/Google) para distancia real.

---

## Parte 8: Rota no App.tsx

Adicionar rota publica:

```text
<Route path="/assistencia/chamado/:token" element={<DespachoReboquistaPublico />} />
```

Colocar junto com as outras rotas publicas (antes das rotas protegidas).

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Tabelas despacho_reboque, convites, tracking, status_log, novo enum status |
| `supabase/functions/despacho-reboque-disparar/index.ts` | Nova edge function (autenticada) |
| `supabase/functions/despacho-reboque-responder/index.ts` | Nova edge function (publica) |
| `supabase/functions/despacho-reboque-atribuir/index.ts` | Nova edge function (chamada internamente) |
| `supabase/functions/despacho-reboque-tracking/index.ts` | Nova edge function (publica) |
| `supabase/functions/despacho-reboque-status/index.ts` | Nova edge function (publica) |
| `supabase/functions/despacho-reboque-consultar/index.ts` | Nova edge function (publica) |
| `supabase/config.toml` | Adicionar verify_jwt = false para funcoes publicas |
| `src/pages/assistencia/DespachoReboquistaPublico.tsx` | Nova pagina publica do reboquista |
| `src/components/assistencia/CardDespachoReboque.tsx` | Novo card para painel do analista |
| `src/pages/assistencia/ChamadoDetalhe.tsx` | Integrar CardDespachoReboque |
| `src/App.tsx` | Adicionar rota publica |

## Sem alteracoes em

- App do associado (nao ve custos, apenas status)
- `AtribuirPrestadorModal` (mantido como alternativa manual)
- `EnviarLinkPrestadorButton` (mantido para envio individual)
- `NovoChamadoModal` (mantido como esta)
- Edge functions existentes de WhatsApp (usadas internamente pelo despacho)
- Cadastro de prestadores (ja tem os campos necessarios: valor_saida, valor_km, whatsapp, tipos_servico)

---

## Ordem de Implementacao Sugerida

Devido a complexidade, recomendo implementar em 3 fases:

**Fase 1 (esta implementacao):** Migracao SQL + Edge functions de disparo/resposta/atribuicao/consulta + Pagina publica do reboquista (estados 1-4) + Card do analista + Rota no App.tsx

**Fase 2 (proxima):** Tracking em tempo real (watchPosition + edge function de tracking + mapa no painel do analista) + Botoes de progresso do reboquista + Timeline de status

**Fase 3 (futura):** Upload de fotos pelo reboquista na pagina publica + Integracao com cron para timer server-side + Distancia por rota real (OSRM)

Este plano cobre a Fase 1 completa.

