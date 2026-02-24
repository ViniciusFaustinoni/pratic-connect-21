
# Seletor de Provedor WhatsApp + Gerenciador de Templates Meta

## Resumo

Implementar duas funcionalidades na tela de Integracoes > WhatsApp:
1. **Seletor de Provedor**: permitir ao Diretor escolher entre Evolution API (Baileys) e API Oficial da Meta como provedor ativo de WhatsApp
2. **Gerenciador de Templates**: interface completa para criar, editar, sincronizar e gerenciar templates da API Oficial da Meta

O envio de mensagens pelo sistema sera transparente -- as ~26 edge functions que chamam `whatsapp-send-text` continuarao funcionando sem alteracao. A logica de roteamento entre provedores ficara centralizada na propria edge function `whatsapp-send-text`.

---

## Parte 1: Migracao SQL

### Alteracoes na tabela `whatsapp_instancias`

Adicionar coluna para identificar o provedor ativo:

```text
ALTER TABLE whatsapp_instancias ADD COLUMN provedor text DEFAULT 'evolution'
  CHECK (provedor IN ('evolution', 'meta_oficial'));
```

### Nova tabela: `whatsapp_meta_config`

Armazena a configuracao da API Oficial da Meta (uma unica linha).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| phone_number_id | text NOT NULL | ID do telefone na Meta |
| waba_id | text NOT NULL | WhatsApp Business Account ID |
| verify_token | text DEFAULT 'sga_pratic_meta_webhook' | Token de verificacao do webhook |
| testado | boolean DEFAULT false | Se o teste de conexao foi bem-sucedido |
| testado_em | timestamptz | Data do ultimo teste |
| ativo | boolean DEFAULT false | Se este e o provedor ativo |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

O Access Token sera armazenado como secret do Supabase (`META_WHATSAPP_ACCESS_TOKEN`), nao no banco.

RLS: SELECT/INSERT/UPDATE apenas para `has_role(auth.uid(), 'diretor')`.

### Nova tabela: `whatsapp_meta_templates`

Templates da API Oficial da Meta (separada da tabela `whatsapp_templates` existente que e para templates internos do Evolution).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| nome | text NOT NULL UNIQUE | Nome do template (snake_case) |
| categoria | text NOT NULL | 'UTILITY', 'MARKETING', 'AUTHENTICATION' |
| idioma | text DEFAULT 'pt_BR' | Idioma |
| status | text DEFAULT 'DRAFT' | 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED' |
| header_tipo | text | 'none', 'text', 'image', 'document' |
| header_texto | text | Texto do cabecalho (se tipo text) |
| corpo | text NOT NULL | Corpo da mensagem com variaveis {{1}} |
| rodape | text | Texto do rodape |
| botoes | jsonb | Array de botoes [{tipo, texto, url/telefone}] |
| variaveis_exemplo | jsonb | Valores de exemplo para cada variavel |
| meta_template_id | text | ID retornado pela Meta apos envio |
| motivo_rejeicao | text | Motivo se rejeitado pela Meta |
| enviado_em | timestamptz | Data de envio para aprovacao |
| aprovado_em | timestamptz | Data de aprovacao |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

RLS: SELECT para `regulador`, `analista_eventos`, `diretor`. INSERT/UPDATE/DELETE apenas `diretor`.

---

## Parte 2: Secrets

Solicitar ao usuario o secret `META_WHATSAPP_ACCESS_TOKEN` para armazenar o Access Token da API da Meta. Esse token sera usado pelas edge functions ao enviar via API Oficial.

---

## Parte 3: Edge Functions

### 3.1 Nova: `whatsapp-meta-test`

Testa conexao com a API da Meta:
- Faz GET em `https://graph.facebook.com/v21.0/{phone_number_id}` com Bearer token
- Retorna sucesso/erro e dados do numero (nome, status de verificacao)
- Atualiza `whatsapp_meta_config.testado = true`

### 3.2 Nova: `whatsapp-meta-templates`

CRUD de templates na API da Meta:
- **POST (criar/enviar)**: envia template para a Meta via `POST /v21.0/{waba_id}/message_templates`
- **GET (sincronizar)**: busca status de todos os templates via `GET /v21.0/{waba_id}/message_templates`
- **DELETE**: exclui template na Meta via `DELETE /v21.0/{waba_id}/message_templates?name={nome}`

### 3.3 Nova: `whatsapp-meta-webhook`

Webhook para receber eventos da Meta:
- GET: verificacao do webhook (verify_token)
- POST: recebe eventos de mensagens, delivery reports, status de templates
- Ao receber `message_template_status_update`: atualiza status do template no banco
- Ao receber mensagens: registra em `whatsapp_mensagens` e encaminha para IA (se habilitada)

config.toml: `verify_jwt = false` (webhook publico)

### 3.4 Atualizar: `whatsapp-send-text`

Adicionar logica de roteamento por provedor:

```text
1. Buscar provedor ativo: SELECT provedor FROM whatsapp_meta_config WHERE ativo = true
   (se nao existir ou ativo = false, usar 'evolution' como default)
2. Se provedor = 'evolution': fluxo atual (sem mudancas)
3. Se provedor = 'meta_oficial':
   a. Buscar phone_number_id e access_token
   b. Buscar template correspondente ao tipo de mensagem (ou enviar como texto livre se dentro de janela 24h)
   c. POST em https://graph.facebook.com/v21.0/{phone_number_id}/messages
   d. Registrar em whatsapp_mensagens
```

Para a Meta, como mensagens proativas exigem template, a funcao deve:
- Receber campo opcional `template_name` e `template_params`
- Se `template_name` for informado: enviar como template
- Se nao for informado: enviar como texto livre (so funciona dentro de janela 24h)
- Se fora de janela e sem template: logar alerta e retornar erro

### 3.5 Atualizar: `whatsapp-send-media`

Mesma logica de roteamento. Para a Meta, midias sao enviadas via `POST /messages` com tipo `image`/`document`/`audio`/`video` usando URL publica ou upload previo.

---

## Parte 4: Componentes Frontend

### 4.1 Refatorar: `WhatsAppTab.tsx`

Reorganizar a tela em 3 secoes:
1. **Provedor de WhatsApp** (nova secao no topo)
2. **IA e Estatisticas** (mantido)
3. **Templates de Mensagem (API Oficial Meta)** (nova secao)

### 4.2 Novo: `src/components/integracoes/WhatsAppProvedorSelector.tsx`

Secao com dois cards lado a lado:

**Card 1 -- Evolution API / Baileys:**
- Exibe URL, instancia, status de conexao (dados existentes, somente leitura)
- Badge "CONECTADO" se status = open
- Badge "ATIVO" se e o provedor ativo
- Botao "Usar este provedor" (desabilitado se ja ativo)

**Card 2 -- API Oficial da Meta:**
- Formulario: Phone Number ID, WABA ID, Access Token (campo senha com show/hide)
- Verify Token (readonly, valor fixo)
- URL do Webhook (readonly, gerada: `https://{project_id}.supabase.co/functions/v1/whatsapp-meta-webhook`, com botao copiar)
- Botoes: "Salvar Configuracao", "Testar Conexao"
- Badge "ATIVO" se e o provedor ativo
- Botao "Usar este provedor" (habilitado apos teste bem-sucedido)
- Secao colapsavel "Como configurar" com instrucoes passo a passo

**Troca de provedor:** AlertDialog com confirmacao "Todos os envios passarao a usar [nome]. Deseja continuar?"

### 4.3 Novo: `src/components/integracoes/WhatsAppMetaTemplates.tsx`

Secao completa de gerenciamento de templates:

**Cabecalho:**
- Aviso sobre obrigatoriedade de templates
- Cards de resumo: Total | Aprovados | Pendentes | Rejeitados
- Botoes: "Novo Template" e "Sincronizar com a Meta"

**Tabela:**
- Colunas: Nome, Categoria, Status (badge colorido), Previa, Enviado em, Atualizado em, Acoes
- Acoes: Visualizar, Editar (se REJECTED/DRAFT), Reenviar (se REJECTED), Excluir (se REJECTED/PENDING/DRAFT)
- Filtro por status e busca por nome

### 4.4 Novo: `src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx`

Drawer (Sheet) lateral para criar/editar template:

**Lado esquerdo -- Formulario:**
- Nome (snake_case, auto-gerado a partir da descricao)
- Categoria (UTILITY/MARKETING/AUTHENTICATION com tooltips)
- Idioma (fixo pt_BR)
- Header tipo (select: Nenhum/Texto/Imagem/Documento) + campo texto se tipo = text
- Corpo (textarea com contador de caracteres, limite 1024)
- Botao "+ Variavel" que insere {{N}} e cria campo "Exemplo para {{N}}"
- Rodape (texto simples, limite 60 chars)
- Botoes (ate 3: Resposta Rapida / URL / Telefone)

**Lado direito -- Preview:**
- Bolha estilizada do WhatsApp com cabecalho, corpo (variaveis substituidas pelos exemplos), rodape e botoes
- Atualiza em tempo real

**Acoes:**
- "Salvar rascunho" (status DRAFT, so local)
- "Enviar para aprovacao" (chama edge function, status vira PENDING)

### 4.5 Novo: `src/hooks/useWhatsAppMeta.ts`

Hooks:
- `useMetaConfig()` -- busca configuracao da Meta
- `useSalvarMetaConfig()` -- mutation para salvar config
- `useTestarMetaConexao()` -- mutation para testar conexao
- `useTrocarProvedor()` -- mutation para ativar/desativar provedor
- `useMetaTemplates()` -- query para listar templates
- `useCriarMetaTemplate()` -- mutation para criar/enviar template
- `useExcluirMetaTemplate()` -- mutation para excluir
- `useSincronizarMetaTemplates()` -- mutation para buscar status atualizados

---

## Parte 5: Templates Padrao

Inserir na migracao SQL os 8 templates padrao como rascunho (status = 'DRAFT'):

1. `boas_vindas_associado` (UTILITY)
2. `cobranca_mensalidade` (UTILITY)
3. `sinistro_aberto` (UTILITY)
4. `sinistro_atualizado` (UTILITY)
5. `assistencia_confirmada` (UTILITY)
6. `tarefa_vistoriador` (UTILITY)
7. `orcamento_oficina` (UTILITY)
8. `documentacao_pendente` (UTILITY)

Cada um com corpo, variaveis e exemplos pre-preenchidos conforme especificado.

---

## Parte 6: Webhook da Meta

### config.toml

```text
[functions.whatsapp-meta-webhook]
verify_jwt = false
```

### Fluxo do webhook

1. **GET** (verificacao): Meta envia `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. Validar verify_token e retornar challenge.
2. **POST** (eventos):
   - `message_template_status_update`: atualizar status do template no banco
   - `messages`: registrar mensagem recebida + encaminhar para IA (reutilizar logica do `whatsapp-webhook` existente)
   - `statuses` (delivery/read): atualizar status da mensagem no banco

---

## Parte 7: Roteamento Transparente

A mudanca critica e no `whatsapp-send-text` e `whatsapp-send-media`. As ~26 edge functions que chamam essas funcoes NAO precisam ser alteradas. O roteamento e interno:

```text
whatsapp-send-text recebe { telefone, mensagem, template_name?, template_params? }
  |
  v
  Qual provedor esta ativo?
  |
  +--> evolution --> fluxo atual (Evolution API)
  |
  +--> meta_oficial --> enviar via Graph API
       |
       +--> template_name informado? --> enviar como template
       |
       +--> sem template --> enviar como texto livre (se dentro de janela 24h)
       |
       +--> fora de janela e sem template --> logar erro, retornar falha
```

Para a fase inicial, as edge functions existentes continuam enviando texto livre. Quando o provedor ativo for Meta e a mensagem for proativa (fora de janela), o sistema logara o alerta. O Diretor precisara mapear gradualmente quais envios usam qual template.

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Tabelas `whatsapp_meta_config`, `whatsapp_meta_templates`, coluna `provedor`, templates padrao |
| `supabase/functions/whatsapp-meta-test/index.ts` | Nova edge function |
| `supabase/functions/whatsapp-meta-templates/index.ts` | Nova edge function |
| `supabase/functions/whatsapp-meta-webhook/index.ts` | Nova edge function |
| `supabase/functions/whatsapp-send-text/index.ts` | Adicionar roteamento por provedor |
| `supabase/functions/whatsapp-send-media/index.ts` | Adicionar roteamento por provedor |
| `supabase/config.toml` | Adicionar `whatsapp-meta-webhook` com verify_jwt = false |
| `src/hooks/useWhatsAppMeta.ts` | Novo hook |
| `src/components/integracoes/WhatsAppProvedorSelector.tsx` | Novo componente |
| `src/components/integracoes/WhatsAppMetaTemplates.tsx` | Novo componente |
| `src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx` | Novo componente |
| `src/components/integracoes/WhatsAppTab.tsx` | Integrar novos componentes |
| `src/integrations/supabase/types.ts` | Tipos das novas tabelas |

## Sem alteracoes em

- As ~26 edge functions que chamam `whatsapp-send-text` (roteamento transparente)
- App do associado
- Webhook existente do Evolution (`whatsapp-webhook`)
- Tabela `whatsapp_templates` existente (templates internos do Evolution)
- Tabela `whatsapp_instancias` (apenas adicionada coluna `provedor`)

---

## Detalhes Tecnicos

### API da Meta -- Endpoints usados

```text
-- Testar conexao
GET https://graph.facebook.com/v21.0/{phone_number_id}
Authorization: Bearer {access_token}

-- Enviar mensagem template
POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "boas_vindas_associado",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "ABC-1234" }
        ]
      }
    ]
  }
}

-- Enviar mensagem texto livre (dentro de janela 24h)
POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": { "body": "Mensagem livre" }
}

-- Criar template
POST https://graph.facebook.com/v21.0/{waba_id}/message_templates
{
  "name": "boas_vindas_associado",
  "language": "pt_BR",
  "category": "UTILITY",
  "components": [...]
}

-- Listar templates (sincronizar status)
GET https://graph.facebook.com/v21.0/{waba_id}/message_templates

-- Excluir template
DELETE https://graph.facebook.com/v21.0/{waba_id}/message_templates?name={nome}
```

### Permissoes

```text
canAccessProvedor = has_role(diretor)
canAccessTemplates = has_role(diretor)
canSwitchProvider = has_role(diretor)
```

### Secret necessario

`META_WHATSAPP_ACCESS_TOKEN` -- token de acesso permanente gerado no painel de desenvolvedores da Meta.
