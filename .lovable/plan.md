

# Acompanhamento Diario, Conclusao e Entrega do Veiculo

## Resumo

Este plano cobre 7 partes: (1) atualizacoes diarias obrigatorias com fotos, (2) notificacoes WhatsApp por etapa concluida, (3) vistoria presencial do regulador, (4) conclusao do reparo, (5) link publico de retirada com assinatura, (6) timeline completa do evento e (7) controle de garantia de 90 dias.

---

## Etapa 1 — Tabela `os_atualizacoes_diarias`

Nova tabela para registrar cada atualizacao do regulador:

```text
CREATE TABLE os_atualizacoes_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid REFERENCES ordens_servico(id) NOT NULL,
  regulador_id uuid REFERENCES profiles(id) NOT NULL,
  descricao text NOT NULL,
  fotos_urls jsonb NOT NULL DEFAULT '[]',
  video_url text,
  etapa_concluida text,
  etapa_iniciada text,
  tem_problema boolean DEFAULT false,
  tipo_problema text,
  descricao_problema text,
  created_at timestamptz DEFAULT now()
);
```

RLS: authenticated users full access.

---

## Etapa 2 — Tabela `os_vistorias_presenciais`

```text
CREATE TABLE os_vistorias_presenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid REFERENCES ordens_servico(id) NOT NULL,
  regulador_id uuid REFERENCES profiles(id) NOT NULL,
  video_url text,
  latitude numeric,
  longitude numeric,
  observacoes text,
  created_at timestamptz DEFAULT now()
);
```

---

## Etapa 3 — Colunas adicionais em `ordens_servico`

```text
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS data_conclusao_real timestamptz,
  ADD COLUMN IF NOT EXISTS tempo_total_dias integer,
  ADD COLUMN IF NOT EXISTS token_retirada text,
  ADD COLUMN IF NOT EXISTS token_retirada_expira timestamptz,
  ADD COLUMN IF NOT EXISTS data_retirada timestamptz,
  ADD COLUMN IF NOT EXISTS garantia_ate date,
  ADD COLUMN IF NOT EXISTS assinatura_retirada_url text;
```

Adicionar status `entregue` e `concluido` ja existem no enum. Verificar: `entregue` NAO existe no enum atual. Adicionar:

```text
ALTER TYPE status_ordem_servico ADD VALUE IF NOT EXISTS 'entregue';
```

Tambem adicionar status `finalizado` e `em_garantia` no enum de sinistro — ja existem (`encerrado` e `em_garantia`).

---

## Etapa 4 — Componente `RegistrarAtualizacaoDialog.tsx`

Arquivo: `src/components/sinistros/RegistrarAtualizacaoDialog.tsx`

Modal com 4 secoes:

**Comprovacao Visual (obrigatoria):**
- Upload de 2-10 fotos (upload para bucket `sinistro-eventos` na pasta `{os_id}/atualizacoes/{timestamp}/`)
- Upload de video opcional
- Validacao: minimo 2 fotos antes de salvar

**Descricao (obrigatoria):**
- Textarea com placeholder de exemplo

**Mudanca de Etapa (condicional):**
- So aparece se ha etapa pendente ou em andamento
- Mostra etapa atual e proxima
- Toggle "Etapa atual concluida?"
- Se sim: atualiza `etapas_reparo` no `ordens_servico` (etapa atual -> concluida, proxima -> em_andamento)
- Se ultima etapa concluida: status OS -> `concluido`

**Problemas (opcional):**
- Toggle "Ha problema ou atraso?"
- Select de tipo: Aguardando peca / Problema de qualidade / Atraso da oficina / Outro
- Textarea para descricao

Ao salvar:
1. Faz upload das fotos/video para storage
2. Insere em `os_atualizacoes_diarias`
3. Se etapa concluida: atualiza `etapas_reparo` e chama edge function para WhatsApp
4. Se problema: chama edge function para notificar associado
5. Se ultima etapa: status OS -> `concluido`, registra `data_conclusao_real` e `tempo_total_dias`

---

## Etapa 5 — Edge Function `notificar-etapa-os`

Arquivo: `supabase/functions/notificar-etapa-os/index.ts`

Recebe: `ordem_servico_id`, `etapa_concluida`, `proxima_etapa`, `tipo` (etapa_concluida | problema | conclusao | retirada_pronta | lembrete_retirada)

Logica:
- Busca OS com veiculo e associado
- Monta mensagem personalizada baseada na etapa (Lanternagem, Pintura, Mecanica, Eletrica, Polimento, Lavagem)
- Lavagem = mensagem especial "ultima etapa"
- Se tipo=conclusao: gera token de retirada e envia link
- Se tipo=problema: envia notificacao de atraso com motivo
- Envia via `whatsapp-send-text`

---

## Etapa 6 — Componente `VistoriaPresencialDialog.tsx`

Arquivo: `src/components/sinistros/VistoriaPresencialDialog.tsx`

- Gravacao de video (ate 3 min) usando MediaRecorder API
- Captura GPS via navigator.geolocation
- Upload do video para `sinistro-eventos/{os_id}/vistorias-presenciais/`
- Campo observacoes
- Salva em `os_vistorias_presenciais`
- Registra na timeline da OS

---

## Etapa 7 — Atualizar `ReguladorOficina.tsx`

Adicionar botoes nos cards:
- "Registrar Atualizacao" -> abre `RegistrarAtualizacaoDialog`
- "Vistoria Presencial" -> abre `VistoriaPresencialDialog`

Adicionar badge de atualizacao diaria:
- Query em `os_atualizacoes_diarias` para verificar se ja tem atualizacao de HOJE
- Verde "Atualizado" vs Vermelho "Pendente!"

Adicionar status `concluido` no STATUS_MAP e nos contadores.

---

## Etapa 8 — Pagina Publica de Retirada

Arquivo: `src/pages/public/RetiradaVeiculo.tsx`

Pagina acessada via token unico (rota `/retirada/:token`).

Conteudo:
- Logo Pratic Car + "Seu veiculo esta pronto!"
- Dados do veiculo (placa, marca, modelo)
- Oficina + endereco + botao "Ver no Mapa" (link Google Maps)
- Resumo das etapas com datas de conclusao
- Tempo total em oficina

Formulario:
- Campo data (default hoje)
- Observacoes (opcional)
- Checkbox: "Recebi meu veiculo em perfeitas condicoes"
- Checkbox: "Ciente da garantia de 90 dias"
- `SignaturePad` (componente ja existente em `src/components/instalador/SignaturePad.tsx`)
- Botao "Confirmar Retirada"

Ao confirmar:
- Salva assinatura no storage
- Update OS: status -> `entregue`, `data_retirada`, `garantia_ate` (retirada + 90 dias), `assinatura_retirada_url`
- Update sinistro: status -> `em_garantia`
- Edge function envia WhatsApp confirmando retirada e garantia

---

## Etapa 9 — Edge Function `gerar-link-retirada`

Chamada quando OS status muda para `concluido`.

Gera token unico, salva na OS (`token_retirada`, `token_retirada_expira` = +72h), envia WhatsApp com link.

---

## Etapa 10 — Edge Function `confirmar-retirada`

Recebe token + dados do formulario. Valida token, salva assinatura no storage, atualiza OS e sinistro, envia WhatsApp de confirmacao.

---

## Etapa 11 — Aba "Timeline" no SinistroAnalise

Nova aba ao lado de "Detalhes" e "Cotacoes Recebidas".

Componente: `src/components/sinistros/TimelineEventoTab.tsx`

Busca dados de multiplas tabelas para montar timeline cronologica:
- `sinistros` (created_at, status changes)
- `sinistro_evento_links` (etapas do link)
- `vistorias_evento` (agendamento, execucao)
- `sinistro_historico` (todas mudancas de status)
- `evento_cotacoes_pecas` (envio, respostas, aprovacao)
- `ordens_servico` + `ordens_servico_historico` (geracao, entrada, conclusao)
- `os_atualizacoes_diarias` (cada atualizacao com fotos)
- `os_vistorias_presenciais` (cada vistoria)
- Data de retirada e garantia

Cada item mostra icone + data/hora + descricao + badge. Items clicaveis para ver detalhes (fotos, videos, documentos em modal).

---

## Etapa 12 — Garantia de 90 dias

Na aba "Oficina" do regulador, adicionar secao "Garantias":
- Lista de OS com garantia ativa (`garantia_ate >= hoje`)
- Alerta para garantias vencendo em 7 dias

No `SinistroAnalise.tsx`, quando status e `em_garantia`:
- Mostrar card com data de retirada, data fim garantia, dias restantes
- Botao "Registrar Retorno de Garantia" (cria novo sinistro vinculado ao original)

---

## Etapa 13 — Rota publica

No `App.tsx`, adicionar rota:

```text
<Route path="/retirada/:token" element={<RetiradaVeiculo />} />
```

---

## Etapa 14 — Registrar novas edge functions no `config.toml`

```text
[functions.notificar-etapa-os]
verify_jwt = false

[functions.gerar-link-retirada]
verify_jwt = false

[functions.confirmar-retirada]
verify_jwt = false
```

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Migration SQL | Criar tabelas `os_atualizacoes_diarias` e `os_vistorias_presenciais`; adicionar colunas em `ordens_servico`; adicionar `entregue` ao enum |
| Criar | `src/components/sinistros/RegistrarAtualizacaoDialog.tsx` |
| Criar | `src/components/sinistros/VistoriaPresencialDialog.tsx` |
| Criar | `src/components/sinistros/TimelineEventoTab.tsx` |
| Criar | `src/pages/public/RetiradaVeiculo.tsx` |
| Criar | `supabase/functions/notificar-etapa-os/index.ts` |
| Criar | `supabase/functions/gerar-link-retirada/index.ts` |
| Criar | `supabase/functions/confirmar-retirada/index.ts` |
| Modificar | `src/pages/regulador/ReguladorOficina.tsx` — botoes de atualizacao, vistoria, badges, secao garantias |
| Modificar | `src/pages/eventos/SinistroAnalise.tsx` — aba Timeline + card garantia |
| Modificar | `src/App.tsx` — rota `/retirada/:token` |
| Modificar | `supabase/config.toml` — registrar 3 novas edge functions |

---

## Fluxo Completo

```text
Veiculo na oficina (OS em_execucao)
  |
  v
Regulador: Registrar Atualizacao (2+ fotos + descricao)
  -> Badge verde "Atualizado"
  -> Se etapa concluida: IA notifica associado via WhatsApp
  -> Se problema: IA notifica associado sobre atraso
  |
  v
Regulador: Vistoria Presencial (video + GPS — interno)
  |
  v
Ultima etapa concluida -> OS status "concluido"
  -> Edge function gera token de retirada (72h)
  -> IA envia WhatsApp com link de retirada
  |
  v
Associado acessa link publico
  -> Ve resumo completo do reparo
  -> Preenche formulario de retirada
  -> Assina digitalmente
  -> Confirma
  |
  v
OS status "entregue" + Sinistro status "em_garantia"
  -> Garantia 90 dias inicia na data de retirada
  -> IA confirma via WhatsApp
  |
  v
Garantia ativa: regulador monitora no painel
  -> Retorno? Novo sinistro vinculado ao original
```
