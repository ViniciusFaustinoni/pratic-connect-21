

# Plano: Link Tokenizado para Prestador com WhatsApp Meta

## Resumo

Criar link publico tokenizado para prestadores confirmarem chegada e conclusao de instalacoes com foto. Envio automatico via WhatsApp usando a API Meta ja integrada (template aprovado), sem n8n. Acompanhamento em tempo real no drawer do coordenador.

---

## PARTE 1 — Tabela + Storage (Migration)

### 1a. Tabela `instalacao_prestador_links`

```text
id uuid PK
instalacao_id uuid FK instalacoes(id) ON DELETE CASCADE
prestador_id uuid FK prestadores_assistencia(id)
token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex')
status text DEFAULT 'aguardando' CHECK IN ('aguardando','em_execucao','concluida','expirado')
expires_at timestamptz DEFAULT now() + interval '7 days'
chegada_em timestamptz
concluida_em timestamptz
foto_comprovante_url text
created_at timestamptz DEFAULT now()
```

RLS: SELECT publico por token (anon), INSERT/UPDATE para authenticated.

### 1b. Storage bucket `prestador-fotos`

Bucket publico para leitura. RLS permite INSERT para anon (upload pelo prestador via link publico).

### 1c. Config `webhook_prestador_url` removida — nao necessaria

### 1d. Template Meta `prestador_nova_instalacao_v1`

Inserir na tabela `whatsapp_meta_templates` um template DRAFT categoria UTILITY:
- Corpo com variaveis: nome prestador, nome associado, municipio, endereco, link
- Rodape fixo no final (regra Meta)
- Status DRAFT — o operador envia para aprovacao pelo painel existente

---

## PARTE 2 — Edge Function `gerar-link-prestador`

**Novo**: `supabase/functions/gerar-link-prestador/index.ts`

Recebe `{ instalacao_id, prestador_id }`:

1. Buscar dados da instalacao (associado, endereco, data agendada)
2. Buscar dados do prestador (nome, whatsapp) da `prestadores_assistencia`
3. Inserir registro em `instalacao_prestador_links` gerando token
4. Construir URL: `https://pratic-connect-21.lovable.app/prestador/instalacao/{token}`
5. Enviar WhatsApp via `whatsapp-send-text` (invocacao interna) usando o template `prestador_nova_instalacao_v1` com as variaveis preenchidas
6. Retornar token e URL

Se o template ainda estiver DRAFT, o sistema de fallback do `whatsapp-send-text` ja lida com isso (usa `notificacao_geral_v1` como fallback).

---

## PARTE 3 — Pagina Publica `/prestador/instalacao/:token`

**Novo**: `src/pages/public/PrestadorInstalacao.tsx`

Pagina mobile-first usando `publicSupabase` (sem autenticacao):

1. Valida token (existe + nao expirado)
2. Se invalido: card com mensagem de erro
3. Se valido, exibe card com:
   - Nome do associado, endereco completo, data/hora agendada
   - Telefone do associado com botao "Ligar" (`tel:`)
4. Acoes por status:
   - `aguardando`: Botao "Confirmar Chegada" → update status `em_execucao`, registrar `chegada_em`
   - `em_execucao`: Upload de foto + botao "Marcar como Concluido" (exige 1 foto minimo) → upload para bucket `prestador-fotos`, update status `concluida`, registrar `concluida_em` e `foto_comprovante_url`
   - `concluida`: Mensagem "Instalacao concluida com sucesso"

**Rota no App.tsx**: `<Route path="/prestador/instalacao/:token" element={<PrestadorInstalacao />} />`

---

## PARTE 4 — Secao Prestador no InstalacaoDetailDrawer

**Arquivo**: `src/components/instalacoes/InstalacaoDetailDrawer.tsx`

Quando `tipo_deslocamento === 'prestador'`, adicionar secao apos Endereco:

- Query `instalacao_prestador_links` pelo `instalacao_id` (ultimo registro)
- Badge de status colorido (amarelo=aguardando, azul=em_execucao, verde=concluida)
- Horarios de chegada e conclusao (quando houver)
- Foto comprovante: miniatura clicavel (Dialog com imagem grande)
- Botao "Enviar Link WhatsApp": chama edge function `gerar-link-prestador` (gera novo token + envia WhatsApp)
- Botao "Copiar Link": copia URL para clipboard

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB migration | Tabela + bucket + template Meta |
| `supabase/functions/gerar-link-prestador/index.ts` | **Nova** edge function |
| `src/pages/public/PrestadorInstalacao.tsx` | **Nova** pagina publica |
| `src/App.tsx` | Rota `/prestador/instalacao/:token` |
| `src/components/instalacoes/InstalacaoDetailDrawer.tsx` | Secao prestador |

