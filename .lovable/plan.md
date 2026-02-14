

# Contato Automatico Pos-Sinistro + Link Unico Expiravel

## Resumo

Criar o fluxo automatizado que, apos a criacao de um sinistro de colisao, agenda o envio de uma mensagem WhatsApp para o associado no dia seguinte as 8h da manha. A mensagem contem explicacoes sobre a cota de coparticipacao (calculada dinamicamente a partir do plano e FIPE do veiculo) e um link unico expiravel de 72h para o associado completar etapas obrigatorias. O painel administrativo mostra o status do link e permite gerar novos.

---

## 1. Banco de Dados

### Tabela `sinistro_evento_links`

Armazena os links unicos expiraveis para cada sinistro:

- `id` (uuid, PK)
- `sinistro_id` (uuid, FK -> sinistros, NOT NULL)
- `token` (uuid, UNIQUE, NOT NULL, default gen_random_uuid())
- `tipo` (text, NOT NULL, default 'colisao_etapas') -- para diferenciar tipos futuros de link
- `status` (text, NOT NULL, default 'ativo') -- 'ativo', 'expirado', 'completado', 'invalidado'
- `etapa_atual` (integer, default 0) -- 0=nao iniciou, 1, 2, 3
- `etapa1_completada_em` (timestamptz)
- `etapa2_completada_em` (timestamptz)
- `etapa3_completada_em` (timestamptz)
- `dados_etapa1` (jsonb) -- fotos da auto vistoria
- `dados_etapa2` (jsonb) -- B.O. numero, relato extraido
- `dados_etapa3` (jsonb) -- relato completo, audio_url, endereco
- `expira_em` (timestamptz, NOT NULL) -- created_at + 72h
- `created_at` (timestamptz, default now())
- `created_by` (uuid) -- quem gerou o link (sistema ou usuario admin)

RLS: acesso anon para SELECT/UPDATE filtrado por token valido + acesso autenticado para administradores.

### Tabela `sinistro_contatos_agendados`

Registra o agendamento do contato automatico:

- `id` (uuid, PK)
- `sinistro_id` (uuid, FK -> sinistros, NOT NULL)
- `tipo_contato` (text, default 'whatsapp_pos_colisao')
- `agendado_para` (timestamptz, NOT NULL) -- dia seguinte as 08:00
- `status` (text, default 'agendado') -- 'agendado', 'enviado', 'erro', 'cancelado'
- `link_id` (uuid, FK -> sinistro_evento_links)
- `mensagem_enviada` (text)
- `erro_detalhes` (text)
- `enviado_em` (timestamptz)
- `created_at` (timestamptz, default now())

RLS: apenas usuarios autenticados.

### Alteracao na tabela `sinistros`

Adicionar coluna:
- `link_evento_id` (uuid, FK -> sinistro_evento_links) -- link ativo atual

---

## 2. Edge Function: `agendar-contato-sinistro`

Chamada automaticamente ao final de `criar-sinistro` quando `tipo = 'colisao'`.

Logica:
1. Cria um registro em `sinistro_evento_links` com `expira_em = now() + 72h`
2. Atualiza `sinistros.link_evento_id` com o link criado
3. Cria um registro em `sinistro_contatos_agendados` com `agendado_para` = dia seguinte as 08:00 (horario de Brasilia)
4. Retorna o link_id e token gerado

---

## 3. Edge Function: `cron-contato-sinistro`

Executada via pg_cron a cada minuto (ou a cada 5 min). Verifica `sinistro_contatos_agendados` com `status = 'agendado'` e `agendado_para <= now()`.

Para cada registro encontrado:

1. Busca o sinistro com dados do associado, veiculo e plano
2. Calcula a cota de coparticipacao:
   - Se veiculo `uso_aplicativo = true` e plano tem `cota_app_percent`: usa `cota_app_percent` e `cota_app_min`
   - Senao: usa `cota_participacao` e `cota_minima` do plano
   - Valor da cota = MAX(valor_fipe * percentual / 100, valor_minimo)
3. Monta a mensagem WhatsApp com:
   - Confirmacao de recebimento do sinistro
   - Explicacao da cota (plano, percentual, valor calculado)
   - Orientacao sobre auto vistoria, B.O., relato
   - Prazo de 30 dias (e que ja esta correndo)
   - Informacao de que ja pode dar entrada no conserto
   - Link unico: `{SITE_URL}/evento/{token}`
4. Envia via `whatsapp-send-text`
5. Atualiza o status do agendamento para 'enviado' ou 'erro'

---

## 4. Edge Function: `gerar-link-evento`

Permite que administradores gerem um novo link para um sinistro (invalidando o anterior).

1. Invalida todos os links ativos do sinistro (`status = 'invalidado'`)
2. Cria novo link com `expira_em = now() + 72h`
3. Atualiza `sinistros.link_evento_id`
4. Retorna o novo token

---

## 5. Edge Function: `validar-link-evento`

Chamada pela pagina publica ao acessar o link. Recebe o token e retorna:
- Se valido: dados do sinistro, associado, veiculo, etapa atual
- Se expirado/invalido: mensagem amigavel

---

## 6. Pagina Publica: `/evento/:token`

Rota publica (sem autenticacao) que renderiza as etapas do sinistro. Neste prompt, as etapas serao apenas estruturais (placeholder). O conteudo detalhado de cada etapa (auto vistoria, B.O., relato) sera implementado no proximo prompt.

A pagina:
- Valida o token via `validar-link-evento`
- Mostra stepper com 3 etapas
- Se token invalido/expirado: mensagem amigavel com orientacao de contato

---

## 7. Modificacao na `criar-sinistro`

Apos criar o sinistro com `tipo = 'colisao'`:
- Invocar `agendar-contato-sinistro` passando o `sinistro_id`

---

## 8. Painel Administrativo - Card do Evento

Modificar a pagina de detalhe do sinistro (`SinistroDetalhe`) para exibir:
- Status do link (ativo/expirado/completado/sem link)
- Data de envio e expiracao
- Etapa atual do associado (1, 2 ou 3)
- Botao "Gerar Novo Link" que invalida o anterior e cria um novo
- Badge visual indicando o progresso

---

## 9. Cron Job (pg_cron)

Agendar a edge function `cron-contato-sinistro` para rodar a cada 5 minutos:

```text
*/5 * * * *  ->  POST /functions/v1/cron-contato-sinistro
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| Migracao SQL | Tabelas `sinistro_evento_links`, `sinistro_contatos_agendados` + coluna `link_evento_id` em sinistros |
| `supabase/functions/agendar-contato-sinistro/index.ts` | Cria link + agenda contato para 8h do dia seguinte |
| `supabase/functions/cron-contato-sinistro/index.ts` | Verifica agendamentos pendentes e envia WhatsApp |
| `supabase/functions/gerar-link-evento/index.ts` | Gera novo link (invalida anterior) |
| `supabase/functions/validar-link-evento/index.ts` | Valida token e retorna dados para pagina publica |
| `src/pages/public/EventoColisao.tsx` | Pagina publica com stepper (placeholder das etapas) |
| `src/hooks/useEventoLink.ts` | Hook para gerenciar links no painel admin |
| `src/components/eventos/EventoLinkCard.tsx` | Card no detalhe do sinistro com status do link |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/criar-sinistro/index.ts` | Invocar `agendar-contato-sinistro` apos criar sinistro de colisao |
| `src/App.tsx` | Adicionar rota `/evento/:token` |
| Pagina `SinistroDetalhe` | Incluir `EventoLinkCard` |
| `supabase/config.toml` | Adicionar `verify_jwt = false` para `validar-link-evento` |

---

## Calculo da Cota de Coparticipacao

```text
plano = associado.plano_id -> planos
veiculo_app = veiculo.uso_aplicativo

Se veiculo_app E plano.cota_app_percent existe:
  percentual = plano.cota_app_percent
  minimo = plano.cota_app_min
Senao:
  percentual = plano.cota_participacao
  minimo = plano.cota_minima

valor_cota = MAX(valor_fipe * percentual / 100, minimo)
```

Exemplo mensagem WhatsApp:
```text
Ola, [Nome]! Aqui e a Pratic Car.

Recebemos a comunicacao do seu sinistro de colisao.
Protocolo: SIN-20260215-1234

Sobre a cota de coparticipacao:
Seu plano e SELECT BASIC (Passeio), com cota de 6% da FIPE.
Valor FIPE do veiculo: R$ 40.000,00
Sua cota de coparticipacao: R$ 2.400,00

Proximos passos obrigatorios:
1. Realizar auto vistoria (fotos do veiculo)
2. Enviar Boletim de Ocorrencia
3. Relato completo do ocorrido

Prazo: voce tem 30 dias a partir da data do evento para
concluir o processo. O prazo ja esta correndo, mas fique
tranquilo - vamos te auxiliar em tudo!

Ja e possivel dar entrada no conserto do veiculo.

Acesse o link abaixo para completar as etapas:
https://pratic-connect-21.lovable.app/evento/abc123-token

O link e valido por 72 horas.
Em caso de duvidas, estamos a disposicao!
```

