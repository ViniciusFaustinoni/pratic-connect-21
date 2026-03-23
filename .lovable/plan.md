

# Plano Unificado: Boas-vindas Agencia — Email + WhatsApp + Template Meta

## Resumo

Ao criar um usuario do tipo `agencia`, o sistema enviara automaticamente:
1. **Email** com template especifico `acesso-agencia` (linguagem empresarial)
2. **WhatsApp** com template Meta `boas_vindas_agencia_v1` (com fallback para `notificacao_geral_v1`)

## Implementacao

### 1. Migration — Inserir template Meta como DRAFT

```sql
INSERT INTO public.whatsapp_meta_templates (nome, categoria, corpo, header_tipo, header_texto, rodape, status, idioma)
VALUES (
  'boas_vindas_agencia_v1', 'UTILITY',
  'Olá {{1}}, bem-vindo(a) ao Painel PRATIC! Seu acesso foi criado com sucesso. Utilize o link abaixo para acessar sua conta: {{2}}. Em caso de dúvidas, entre em contato com nosso suporte.',
  'text', 'PRATIC - Acesso Criado', 'PRATIC Associação de Proteção Veicular', 'DRAFT', 'pt_BR'
);
```

Apos implementacao, enviar para aprovacao da Meta pelo painel (Integracoes > WhatsApp > Templates).

### 2. `send-email/index.ts` — Novo template `acesso-agencia`

Adicionar ao objeto `TEMPLATES` um novo template com:
- Assunto: "Seu acesso ao Painel PRATIC foi criado"
- Saudacao usando nome fantasia ou razao social (com fallback para nome)
- Mensagem: "Seu acesso ao Painel de Agencia PRATIC foi criado"
- Botao: "Acessar Painel da Agencia"
- Aviso de expiracao do link
- Visual identico aos templates existentes

### 3. `create-user/index.ts` — Tipo `agencia` + email condicional + WhatsApp

- Adicionar `'agencia'` ao tipo na interface `CreateUserRequest` (linha 20)
- No bloco de envio de email (linhas 216-231), escolher template condicional:
  - `tipo === 'agencia'` → template `acesso-agencia`, dados incluem `nomeFantasia` e `razaoSocial`
  - demais → template `acesso-funcionario` (como hoje)
- Apos o email, enviar WhatsApp via `whatsapp-send-text` com:
  - Template: `boas_vindas_agencia_v1`
  - Params: `[nome_fantasia || razao_social || nome, magic_link]`
  - Telefone do cadastro
  - Fallback automatico para `notificacao_geral_v1` (ja implementado no `whatsapp-send-text`)

### Fluxo completo

```text
Criar usuario (tipo=agencia)
  → Auth + Profile (cnpj, razao_social, nome_fantasia) + Roles
  → Gerar magic link
  → Enviar email (template acesso-agencia)
  → Enviar WhatsApp (template boas_vindas_agencia_v1 via whatsapp-send-text)
```

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Insert template `boas_vindas_agencia_v1` como DRAFT |
| `supabase/functions/send-email/index.ts` | Novo template `acesso-agencia` |
| `supabase/functions/create-user/index.ts` | Tipo `agencia` na interface + email condicional + envio WhatsApp |

## Pos-implementacao

O template WhatsApp sera criado como **DRAFT**. O usuario deve ir em **Integracoes > WhatsApp > Templates Meta** e clicar "Enviar para aprovacao". Enquanto nao aprovado, o fallback `notificacao_geral_v1` sera usado automaticamente.

