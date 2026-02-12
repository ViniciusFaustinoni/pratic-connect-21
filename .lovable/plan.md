
# Termo de Entrada de Evento - Assinatura Digital via Autentique

## Resumo

Criar um novo fluxo de assinatura digital para o "Termo de Entrada de Evento", acionado quando um sinistro e aprovado (parecer aprovado). O termo sera gerado via Autentique, e o link de assinatura sera exibido no painel e enviado ao associado via IA/WhatsApp. A pagina do associado reconhecera automaticamente a assinatura, atualizando o status.

---

## Arquitetura do Fluxo

```text
Parecer Aprovado (EmitirParecerModal)
        |
        v
Edge Function: autentique-evento-create
  - Busca template do tipo "termo_entrada_evento" no banco
  - Substitui variaveis (sinistro, associado, veiculo)
  - Envia HTML para Autentique API
  - Salva autentique_documento_id e link na tabela sinistros
        |
        v
Link de assinatura disponivel
  - Exibido no SinistroDetalhe.tsx (card + botao copiar/enviar)
  - Enviado via WhatsApp/IA ao associado
        |
        v
Webhook Autentique (autentique-webhook)
  - Detecta que o documento pertence a um sinistro (nao contrato)
  - Atualiza sinistros: termo_anuencia_assinado = true
  - Baixa PDF assinado e anexa ao sinistro
```

---

## Alteracoes Necessarias

### 1. Banco de Dados

**Adicionar colunas na tabela `sinistros`:**
- `autentique_documento_id` (text, nullable) - ID do documento no Autentique
- `autentique_url` (text, nullable) - Link de assinatura

**Adicionar novo `document_type`:**
- Inserir na tabela `document_types` um registro com `code: 'termo_entrada_evento'`

Nota: as colunas `termo_anuencia_assinado`, `termo_anuencia_url` e `termo_anuencia_assinado_em` ja existem na tabela sinistros e serao reutilizadas.

### 2. Nova Edge Function: `autentique-evento-create`

Baseada na mesma logica do `autentique-create`, mas adaptada para sinistros:

- Recebe `sinistro_id` como parametro
- Busca sinistro com associado, veiculo e contrato ativo
- Busca template do banco por `document_type_id` do tipo `termo_entrada_evento` (ou pelo campo `is_default` dentro desse tipo)
- Cria mapeamento de variaveis especificas do evento (protocolo, tipo sinistro, valor aprovado, parecer, dados do veiculo e associado)
- Gera HTML usando `generateStyles()`, `generateHeader()`, `markdownParaHTML()` e `generateFooter()`
- Envia para Autentique API via GraphQL multipart
- Atualiza `sinistros` com `autentique_documento_id` e `autentique_url`
- Registra no `sinistro_historico`

### 3. Atualizar `autentique-webhook`

O webhook atualmente so busca contratos. Precisa tambem buscar sinistros:

- Apos nao encontrar contrato pelo `autentique_documento_id`, fazer fallback buscando em `sinistros.autentique_documento_id`
- Se encontrar sinistro:
  - No evento `signature.accepted`: atualizar `termo_anuencia_assinado = true`, `termo_anuencia_assinado_em`, `termo_anuencia_url` (PDF)
  - Baixar PDF assinado e salvar no storage
  - Registrar no `sinistro_historico`
  - Enviar notificacao ao responsavel do evento

### 4. Integrar no `EmitirParecerModal`

Quando o parecer for "aprovado":
- Apos salvar o parecer com sucesso, chamar `autentique-evento-create` automaticamente
- Exibir toast informando que o termo foi enviado para assinatura
- Se falhar, exibir aviso mas nao bloquear a aprovacao

### 5. Exibir no `SinistroDetalhe.tsx`

Adicionar um card/secao visivel quando `sinistro.autentique_url` existir:

- Mostrar status da assinatura (Aguardando / Assinado)
- Botao para copiar link de assinatura
- Botao para enviar via WhatsApp
- Se `termo_anuencia_assinado = true`, mostrar badge verde e link para o PDF
- Polling automatico via `useAutentiqueStatus` para atualizar em tempo real

### 6. Template de Variaveis do Evento

Criar funcao `criarMapeamentoVariaveisEvento()` em `template-utils.ts` com:

```text
evento.protocolo
evento.tipo (colisao, roubo, etc.)
evento.data_ocorrencia
evento.local
evento.descricao
evento.parecer
evento.valor_aprovado
evento.tipo_dano (parcial / perda_total)
associado.nome, cpf, telefone, email, endereco
veiculo.placa, marca, modelo, ano, cor, chassi, valor_fipe
empresa.* (mesmos campos existentes)
sistema.data_atual, hora_atual
```

### 7. Permitir criar template no painel de Documentos

- O novo `document_type` "Termo de Entrada de Evento" aparecera automaticamente na listagem de tipos
- O usuario podera criar/editar templates para esse tipo usando o editor rich-text existente
- O template marcado como `is_default` dentro desse tipo sera usado pela edge function

---

## Arquivos Modificados/Criados

| Arquivo | Acao |
|---|---|
| Migration SQL | Adicionar colunas + inserir document_type |
| `supabase/functions/autentique-evento-create/index.ts` | NOVO - Edge function |
| `supabase/functions/_shared/template-utils.ts` | Adicionar `criarMapeamentoVariaveisEvento()` |
| `supabase/functions/autentique-webhook/index.ts` | Buscar sinistros alem de contratos |
| `src/components/eventos/EmitirParecerModal.tsx` | Chamar autentique-evento-create apos aprovacao |
| `src/pages/eventos/SinistroDetalhe.tsx` | Card de assinatura do termo |
| `supabase/config.toml` | Registrar nova edge function |

---

## Observacoes

- O template do termo devera ser criado pelo usuario no painel de documentos, usando o editor TipTap com as variaveis de evento
- O webhook do Autentique ja esta configurado e recebera os eventos normalmente - apenas precisamos adicionar a logica de busca por sinistros
- A mesma logica de auto-refresh usada na assinatura de contratos (polling) sera reutilizada na tela do sinistro
