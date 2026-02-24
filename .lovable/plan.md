

# Rastreamento do Reboque em Tempo Real -- Visao do Associado

## Resumo

Criar duas interfaces para o associado acompanhar a posicao do reboquista em tempo real:
1. **Pagina publica via link WhatsApp** (`/acompanhar/reboque/:token`) -- sem login, token expiravel de 2h
2. **Tela do App do Associado** (`/app/assistencia/:id`) -- atualizar a pagina AcompanharChamado existente com mapa de tracking

Ambas compartilham um **componente de mapa reutilizavel** (`MapaRastreamentoReboque`) que escuta posicoes via Supabase Realtime.

---

## Analise do Estado Atual

### O que ja existe
- **Tabela `despacho_reboque_tracking`**: posicoes do reboquista gravadas a cada ~20s (lat, lng, velocidade, precisao)
- **Tabela `despacho_reboque_status_log`**: timeline de progresso (a_caminho, chegou_local, veiculo_carregado, chegou_destino, concluido)
- **Edge function `despacho-reboque-atribuir`**: atribui reboquista e atualiza chamado (status, prestador_nome, prestador_telefone)
- **`AcompanharChamado.tsx`** (app associado): pagina completa com timeline, mapa estatico (apenas origem/destino), card do prestador. Polling 30s.
- **`DespachoReboquistaPublico.tsx`**: pagina do reboquista com tracking ativo (watchPosition + envio a cada 20s)
- **`TrackingAssistencia.tsx`**: pagina publica existente para rastreamento do VEICULO (nao do reboquista) -- sera um modelo de referencia
- **`publicSupabase`**: cliente Supabase sem autenticacao para paginas publicas
- **`CardDespachoReboque.tsx`** (analista): ja tem mapa com tracking do reboquista via Realtime
- **Realtime habilitado** em `despacho_reboque_tracking` e `despacho_reboque_status_log`

### O que falta
- Tabela de tokens de acompanhamento do associado (separada dos tokens do reboquista)
- Pagina publica `/acompanhar/reboque/:token` para o associado
- Edge function para consultar dados de acompanhamento (publica, sem JWT)
- Componente de mapa reutilizavel com animacao suave
- Integracao do mapa de tracking na tela `AcompanharChamado.tsx`
- Envio automatico de WhatsApp ao associado quando reboquista e atribuido
- Envio de WhatsApp em cada mudanca de status (chegou, carregou, entregou)

---

## Parte 1: Migracao SQL

### Nova tabela: `acompanhamento_reboque_tokens`

Tokens para o associado acompanhar via link publico.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| chamado_id | uuid FK chamados_assistencia UNIQUE | Chamado vinculado |
| associado_id | uuid | ID do associado |
| token | text NOT NULL UNIQUE | Token UUID |
| expira_em | timestamptz NOT NULL | created_at + 2h |
| created_at | timestamptz DEFAULT now() | Criacao |

### RLS

- SELECT com role `anon`: apenas via token (filtro `token = token`). Sem exposicao de dados sensíveis.
- INSERT/UPDATE: via service_role (edge functions)
- Habilitar Realtime nesta tabela: NAO necessario (tabela estatica, nao muda)

### Realtime

Confirmar que `despacho_reboque_tracking` e `despacho_reboque_status_log` ja tem Realtime habilitado (ja estao). A pagina publica do associado vai escutar essas tabelas filtradas por `chamado_id`.

---

## Parte 2: Edge Function

### Nova: `acompanhamento-reboque-consultar`

Endpoint publico (`verify_jwt = false`) para a pagina do associado.

Recebe: `{ token }`

Retorna:
- Validacao do token (invalido, expirado, chamado cancelado/concluido)
- Dados do chamado: tipo_servico, status, protocolo
- Dados do veiculo: placa, marca, modelo, cor
- Posicao do veiculo: lat/lng (origem ou rastreador)
- Endereco do veiculo
- Dados do prestador: nome, telefone (para "Ligar")
- Destino: lat/lng, endereco (se existir -- para fase "carregado")
- Ultima posicao do reboquista (da tabela `despacho_reboque_tracking`)
- Status log completo (da tabela `despacho_reboque_status_log`)
- chamado_id (para Realtime subscription no frontend)

NAO retorna: valor do servico, dados de outros reboquistas, CPF do associado.

### Atualizar: `despacho-reboque-atribuir`

Apos atribuir o reboquista, adicionar:

1. Gerar token UUID para o associado
2. Inserir em `acompanhamento_reboque_tokens`
3. Enviar WhatsApp ao associado com link de acompanhamento (Mensagem 1)

### Atualizar: `despacho-reboque-status`

Apos cada mudanca de status do reboquista, enviar WhatsApp ao associado:
- `chegou_local` -> Mensagem 2 ("Reboquista chegou!")
- `veiculo_carregado` -> Mensagem 3 ("Veiculo no guincho!")
- `chegou_destino` ou `concluido` -> Mensagem 4 ("Veiculo entregue!")

Buscar o token de acompanhamento do associado para incluir o mesmo link em todas as mensagens.

### config.toml

```text
[functions.acompanhamento-reboque-consultar]
verify_jwt = false
```

---

## Parte 3: Componente Reutilizavel de Mapa

### Novo: `src/components/assistencia/MapaRastreamentoReboque.tsx`

Props:
- `chamadoId` (string, obrigatorio) -- para filtrar Realtime
- `posicaoVeiculo` ({ lat: number, lng: number } | null) -- pin fixo do veiculo
- `posicaoDestino` ({ lat: number, lng: number } | null) -- pin do destino (oficina)
- `nomeReboquista` (string) -- label do marcador
- `altura` (string, default "300px")
- `expandivel` (boolean, default false) -- botao fullscreen
- `isPublic` (boolean, default false) -- usa publicSupabase vs supabase

Funcionalidade interna:
- Escuta `despacho_reboque_tracking` via Realtime (INSERT, filtro chamado_id)
- Busca ultima posicao como estado inicial
- Anima o icone do reboquista com CSS transition (transicao suave de lat/lng)
- Calcula distancia (Haversine) e tempo estimado entre reboquista e destino
- Emite atualizacoes via callback `onPosicaoAtualizada({ lat, lng, distanciaKm, tempoEstimadoMin })`
- Icone do reboquista: caminhao azul/verde animado
- Indicador de conexao: bolinha verde "Ao vivo" ou vermelha "Reconectando..."
- Fallback: polling a cada 10s se Realtime desconectar
- FitBounds automatico para enquadrar todos os marcadores
- Ao expandir: overlay fullscreen com botao fechar e card flutuante

---

## Parte 4: Pagina Publica do Associado

### Nova rota: `/acompanhar/reboque/:token`

### Novo: `src/pages/public/AcompanhamentoReboquePublico.tsx`

Pagina mobile-first sem login. Usa `publicSupabase`.

**Validacoes iniciais** (ao carregar):
- Token invalido -> "Link invalido"
- Token expirado -> "Este link expirou. Acesse o App Pratic para acompanhar." + Botao "Abrir App"
- Chamado concluido -> Resumo final (prestador, horarios, destino)
- Chamado cancelado -> "Este chamado foi cancelado"

**Layout ativo** (status a_caminho / em_atendimento):

1. Topo fixo: logo pequena + "Acompanhe seu Reboque" + Badge de status (animacao pulse)
2. Mapa (60% da tela): componente `MapaRastreamentoReboque` com expandivel=true, isPublic=true
3. Card de informacoes (dinamico conforme status):
   - "a_caminho": icone caminhao, nome prestador, distancia em tempo real, tempo estimado, botao "Ligar para o reboquista"
   - "chegou_local": "O reboquista chegou!", botao ligar
   - "veiculo_carregado": "Seu veiculo esta no guincho!", destino mostrado no mapa
   - "chegou_destino": "Chegou ao destino!", endereco
   - "concluido": "Servico concluido!", resumo
4. Timeline expansivel (Collapsible): etapas com icones, horas reais, pulsante na atual
5. Rodape: "Central de Assistencia: 0800 980 0001" (tel: clicavel)

**Realtime**: escuta `despacho_reboque_tracking` e `despacho_reboque_status_log` por `chamado_id`. Fallback polling 10s.

**Indicador de conexao**: bolinha no canto "Ao vivo" / "Reconectando..."

---

## Parte 5: Atualizar App do Associado

### Arquivo: `src/pages/app/AcompanharChamado.tsx`

Adicionar o mapa de tracking quando o chamado for reboque/guincho e tiver prestador atribuido.

**Condicao para mostrar o mapa de tracking:**
- `tipo_servico` inclui 'reboque' ou 'guincho'
- `prestador_nome` existe (prestador atribuido)
- status e um de: 'prestador_a_caminho', 'em_atendimento'

**Quando `aguardando_aceites`** (antes da atribuicao):
- Substituir o mapa estatico por card "Buscando reboquista disponivel..." com animacao de loading

**Quando tracking ativo:**
- Renderizar `MapaRastreamentoReboque` com expandivel=true, altura="250px"
- Callback `onPosicaoAtualizada` para atualizar distancia/tempo no card do prestador
- Adicionar distancia e tempo estimado no card do prestador existente
- Manter botoes Ligar e WhatsApp

**Mapa fullscreen:**
- Ao expandir: overlay 100vh com mapa, botao fechar, card flutuante com nome+distancia+botao ligar

**Realtime para status:**
- Adicionar subscription em `despacho_reboque_status_log` (filter chamado_id)
- Atualizar a timeline e o badge de status em tempo real (invalidar queries)
- Adicionar subscription em `chamados_assistencia` para mudancas de status

---

## Parte 6: Mensagens WhatsApp

### Na `despacho-reboque-atribuir` (apos atribuicao bem-sucedida)

Buscar associado do chamado, gerar token, montar link, enviar:

```text
"Reboque a caminho -- Pratic Car

Seu reboque foi acionado e esta a caminho!

Prestador: [nome]
Distancia: [XX km]
Estimativa: [XX min]

Acompanhe em tempo real:
[link]

Ligar para o reboquista: [telefone]"
```

### Na `despacho-reboque-status` (a cada mudanca)

Buscar token existente do associado (por chamado_id) e enviar:

- `chegou_local`: "Reboquista chegou! -- Pratic Car. O reboquista [nome] chegou ao local do seu veiculo. Acompanhe: [link]"
- `veiculo_carregado`: "Veiculo no guincho -- Pratic Car. Seu veiculo foi carregado e esta sendo levado para: [destino]. Acompanhe: [link]"
- `concluido`: "Veiculo entregue -- Pratic Car. Seu veiculo foi entregue em: [destino]. Horario: [HH:mm]. Obrigado por usar a Pratic Car!"

---

## Parte 7: Rota no App.tsx

Adicionar rota publica:

```text
<Route path="/acompanhar/reboque/:token" element={<AcompanhamentoReboquePublico />} />
```

---

## Parte 8: Calculos de Distancia e Tempo

Funcao utilitaria no componente de mapa:
- Haversine para distancia em km
- Tempo estimado: `distancia < 5km -> 4 min/km`, `5-20km -> 3 min/km`, `> 20km -> 2.5 min/km`
- "Quase la!" quando < 1km
- "Chegou!" quando status = chegou_local

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Tabela `acompanhamento_reboque_tokens` + RLS |
| `supabase/functions/acompanhamento-reboque-consultar/index.ts` | Nova edge function publica |
| `supabase/functions/despacho-reboque-atribuir/index.ts` | Gerar token associado + enviar WhatsApp |
| `supabase/functions/despacho-reboque-status/index.ts` | Enviar WhatsApp ao associado a cada status |
| `supabase/config.toml` | Adicionar verify_jwt = false para acompanhamento-reboque-consultar |
| `src/components/assistencia/MapaRastreamentoReboque.tsx` | Novo componente reutilizavel |
| `src/pages/public/AcompanhamentoReboquePublico.tsx` | Nova pagina publica do associado |
| `src/pages/app/AcompanharChamado.tsx` | Integrar mapa de tracking + Realtime |
| `src/App.tsx` | Adicionar rota publica |

## Sem alteracoes em

- `DespachoReboquistaPublico.tsx` (pagina do reboquista -- ja funciona)
- `CardDespachoReboque.tsx` (painel do analista -- ja tem tracking)
- `TrackingAssistencia.tsx` (tracking do VEICULO, diferente do tracking do reboquista)
- Edge functions existentes de WhatsApp
- Cadastro de prestadores

