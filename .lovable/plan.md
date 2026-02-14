
# Revisao Completa do Fluxo de Eventos (Prompts 1-6)

## Resumo da Revisao

Analisei todos os arquivos criados nos Prompts 1 a 6, incluindo edge functions, paginas publicas, componentes frontend, hooks de dados e integracoes. Identifiquei **11 problemas** organizados por severidade.

---

## PROBLEMAS CRITICOS (impedem o funcionamento)

### 1. URL do link no WhatsApp esta ERRADA (`analisar-evento`)

**Arquivo:** `supabase/functions/analisar-evento/index.ts` (linha 179)

O link enviado ao associado quando o evento e aprovado usa:
```text
supabaseUrl.replace('.supabase.co', '.lovable.app')
```
Isso gera algo como `https://iyxdgmukrrdkffraptsx.lovable.app/evento-aprovado/...` que NAO existe.

A URL correta do app publicado e `https://pratic-connect-21.lovable.app`.

**Correcao:** Usar a URL real do app publicado (hard-coded ou via variavel de ambiente).

---

### 2. Campo `dados_etapa1.fotos_urls` nao corresponde ao campo real salvo

**Arquivo:** `supabase/functions/salvar-etapa-evento/index.ts` (linha 115)

O `salvar-etapa-evento` salva as fotos dentro de `dados_etapaN.arquivos_urls` (com prefixo `arquivos_`), mas o analista (`EventoAnaliseDetalhe.tsx` linha 325) busca por `dadosEtapa1?.fotos_urls`.

O mesmo vale para a etapa 2 — o B.O. e salvo em `dados_etapa2.arquivos_urls[0]`, mas o analista tenta acessar `dadosEtapa2?.bo_url`.

**Impacto:** Fotos da auto vistoria e B.O. NAO aparecem no painel do analista.

**Correcao:** Alinhar os nomes dos campos. No frontend (`EventoAnaliseDetalhe.tsx`):
- Usar `dadosEtapa1?.arquivos_urls` em vez de `dadosEtapa1?.fotos_urls`
- Usar `dadosEtapa2?.arquivos_urls?.[0]` em vez de `dadosEtapa2?.bo_url`
- Usar `dadosEtapa2?.numero_bo` em vez de `dadosEtapa2?.bo_numero`
- Usar `dadosEtapa2?.resumo_bo` em vez de `dadosEtapa2?.bo_resumo`

---

### 3. Campo de audio da etapa 3 — nome incorreto

**Arquivo:** `EventoAnaliseDetalhe.tsx` (linha 270)

O analista busca `dadosEtapa3?.audio_url`, mas o `salvar-etapa-evento` salva o audio dentro de `dadosEtapa3.arquivos_urls` (e o arquivo e um dos URLs genéricos, nao num campo chamado `audio_url`).

**Correcao:** Verificar se o arquivo de audio esta em `dadosEtapa3.arquivos_urls` e filtrar pelo tipo (ou usar o primeiro arquivo que comeca com audio/).

---

### 4. Campo `dadosEtapa3.terceiro_envolvido` vs `dadosEtapa3.houve_terceiro`

O `EventoEtapa3Relato.tsx` salva como `houve_terceiro`, mas o analista (`EventoAnaliseDetalhe.tsx` linha 282) busca por `dadosEtapa3?.terceiro_envolvido`.

Os campos do terceiro tambem divergem:
- Frontend salva: `dadosEtapa3.terceiro.nome`, `terceiro.placa`, `terceiro.telefone`
- Analista busca: `dadosEtapa3?.terceiro_nome`, `terceiro_placa`, `terceiro_telefone`

**Correcao:** Alinhar para usar os nomes corretos (os que realmente estao salvos no banco).

---

## PROBLEMAS MEDIOS (funcionalidade parcial)

### 5. Link do analista pega o link MAIS RECENTE, nao necessariamente o correto

**Arquivo:** `src/hooks/useEventoAnaliseDetalhe.ts` (linhas 35-41)

O hook busca o link mais recente por `sinistro_id` com `order('created_at', desc)`. Apos a aprovacao, o `analisar-evento` cria um NOVO link. Se o analista voltar a ver o evento ja aprovado, vera os dados do novo link (que nao tem dados das etapas preenchidos), nao do link original que contem as fotos/B.O./relato.

**Correcao:** Buscar o link com status `completado` (que contem os dados das 3 etapas), nao apenas o mais recente. Alternativamente, buscar o link que tenha `etapa_atual >= 3`.

---

### 6. Bucket `sinistro-eventos` pode nao existir

**Arquivo:** `supabase/functions/processar-termo-evento/index.ts` (linhas 163-183)

Ha um fallback para criar o bucket se o upload falhar, mas o bucket e criado como `public: false`. Depois o codigo usa `getPublicUrl()` (linha 186-187), que NAO funciona em buckets privados.

**Correcao:** Ou criar o bucket como publico via migracao SQL, ou usar `createSignedUrl()` em vez de `getPublicUrl()`.

---

### 7. IP do cliente sempre "browser"

**Arquivo:** `src/components/evento/EventoTermoAssinatura.tsx` (linha 98)

O IP do cliente e enviado como `ip_cliente: 'browser'` (string fixa), o que nao tem valor para auditoria.

**Correcao:** Buscar o IP real via servico externo (ex: `https://api.ipify.org?format=json`) antes de enviar, ou capturar no edge function via `req.headers.get('x-forwarded-for')`.

---

### 8. Simulacao de parcelas com juros hard-coded no frontend

**Arquivo:** `src/components/evento/EventoPagamentoCota.tsx` (linha 304)

O calculo de parcelas usa fator fixo `1.0299`, que pode nao corresponder ao valor real cobrado pelo ASAAS. O plano era buscar os valores reais do ASAAS.

**Correcao:** Criar acao `simular_parcelas` na edge function que consulta o ASAAS para obter valores reais, ou aceitar a aproximacao e adicionar disclaimer "valores aproximados".

---

## PROBLEMAS MENORES (UX/cosmeticos)

### 9. Analista nao ve o campo `dadosEtapa3.completada_em`

**Arquivo:** `EventoAnaliseDetalhe.tsx` (linha 237)

O campo `dadosEtapa3?.completada_em` nao existe — a data de conclusao da etapa 3 esta em `link.etapa3_completada_em` (no proprio link, nao dentro do JSONB). Ja ha um segundo bloco (linha 243) que mostra `link?.etapa3_completada_em`, entao este primeiro bloco e redundante e nunca mostra nada.

**Correcao:** Remover o bloco com `dadosEtapa3?.completada_em`.

---

### 10. Regulador — `window.location.reload()` em vez de invalidar query

**Arquivo:** `src/pages/regulador/ExecutarVistoriaEvento.tsx` (linha 67)

Ao iniciar a vistoria, o codigo faz `window.location.reload()` em vez de invalidar a query do React Query. Isso causa uma experiencia de reload brusco.

**Correcao:** Usar `queryClient.invalidateQueries({ queryKey: ['vistoria-evento-detalhe', id] })`.

---

### 11. CORS headers incompletos nas edge functions

**Arquivo:** Varias edge functions (`processar-termo-evento`, `analisar-evento`, `salvar-etapa-evento`)

Os CORS headers nao incluem os headers recentes do Supabase client:
```text
x-supabase-client-platform, x-supabase-client-platform-version, 
x-supabase-client-runtime, x-supabase-client-runtime-version
```

Isso pode causar falhas de CORS em versoes mais recentes do SDK.

**Correcao:** Atualizar os CORS headers em todas as edge functions envolvidas.

---

## Tabela Resumo

| # | Severidade | Problema | Arquivo Principal |
|---|---|---|---|
| 1 | CRITICO | URL errada no WhatsApp pos-aprovacao | analisar-evento |
| 2 | CRITICO | Nomes de campos `fotos_urls` vs `arquivos_urls` | EventoAnaliseDetalhe / salvar-etapa-evento |
| 3 | CRITICO | Campo `audio_url` nao existe | EventoAnaliseDetalhe |
| 4 | CRITICO | `terceiro_envolvido` vs `houve_terceiro` | EventoAnaliseDetalhe |
| 5 | MEDIO | Link errado selecionado pelo analista | useEventoAnaliseDetalhe |
| 6 | MEDIO | Bucket privado + getPublicUrl | processar-termo-evento |
| 7 | MEDIO | IP sempre "browser" | EventoTermoAssinatura |
| 8 | MEDIO | Juros de parcelas hard-coded | EventoPagamentoCota |
| 9 | MENOR | Campo redundante que nunca renderiza | EventoAnaliseDetalhe |
| 10 | MENOR | Reload brusco no regulador | ExecutarVistoriaEvento |
| 11 | MENOR | CORS headers incompletos | Varias edge functions |

---

## Plano de Correcao

### Etapa 1 — Corrigir nomes de campos no analista (problemas 2, 3, 4, 9)

Atualizar `EventoAnaliseDetalhe.tsx`:
- `dadosEtapa1?.fotos_urls` para `dadosEtapa1?.arquivos_urls`
- `dadosEtapa2?.bo_url` para `dadosEtapa2?.arquivos_urls?.[0]`
- `dadosEtapa2?.bo_numero` para `dadosEtapa2?.numero_bo`
- `dadosEtapa2?.bo_resumo` para `dadosEtapa2?.resumo_bo`
- `dadosEtapa3?.audio_url` para buscar audio em `dadosEtapa3?.arquivos_urls`
- `dadosEtapa3?.terceiro_envolvido` para `dadosEtapa3?.houve_terceiro`
- `dadosEtapa3?.terceiro_nome` para `dadosEtapa3?.terceiro?.nome`
- Remover bloco `dadosEtapa3?.completada_em`

### Etapa 2 — Corrigir URL do WhatsApp (problema 1)

Atualizar `analisar-evento/index.ts` para usar a URL real publicada do app.

### Etapa 3 — Corrigir busca do link no analista (problema 5)

Atualizar `useEventoAnaliseDetalhe.ts` para buscar o link que tem `etapa_atual >= 3` (completado com dados), nao apenas o mais recente.

### Etapa 4 — Corrigir bucket/URL de assinatura (problema 6)

Atualizar `processar-termo-evento` para usar `createSignedUrl` ou garantir que o bucket existe e e publico via migracao SQL.

### Etapa 5 — Capturar IP real (problema 7)

Atualizar `processar-termo-evento` para extrair IP de `req.headers.get('x-forwarded-for')` em vez de receber do frontend.

### Etapa 6 — Corrigir reload brusco (problema 10)

Atualizar `ExecutarVistoriaEvento.tsx` para usar invalidacao do React Query.

### Etapa 7 — Atualizar CORS headers (problema 11)

Atualizar os corsHeaders em `processar-termo-evento`, `analisar-evento`, `salvar-etapa-evento` e `salvar-vistoria-regulador`.

### Etapa 8 — Adicionar disclaimer de parcelas (problema 8)

Adicionar texto "valores aproximados" no seletor de parcelas do `EventoPagamentoCota.tsx`.
