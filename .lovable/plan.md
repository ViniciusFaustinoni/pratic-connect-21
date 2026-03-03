

# Plano: Ajustes Finos no Fluxo de Despacho de Reboque

## Analise Tela-a-Tela

Analisei todo o fluxo: **disparar → webhook → CardDespachoReboque → atribuicao**. O codigo esta funcional mas precisa de ajustes finos para robustez e consistencia.

### Problemas Identificados

**1. CardDespachoReboque — Cast e tipagem de `etapa_conversacao`**
- Linha 336-341: usa `(c as any).etapa_conversacao` em varios lugares. O campo ja existe no tipo Supabase (`etapa_conversacao: string | null`), entao o cast e desnecessario e pode mascarar erros.

**2. CardDespachoReboque — Tabela "Todos os prestadores" sem coluna de recusas**
- A coluna "Etapa" mostra status como `aguardando_sim`, `recusado`, etc., mas nao mostra contagem de recusas no counter (linha 337 filtra recusas mas nao exibe no grid de 4 colunas — falta o 4o slot ser recusas em vez de "Sem resp.").
- Atualmente: Enviados | Aceitos | Negociando | Sem resp.
- Melhor: Enviados | Aceitos | Negociando | Recusados (e "sem resposta" fica implicito).

**3. Webhook — Nao usa `token` existente no convite para lookup**
- O webhook busca o convite pelo `prestador_id` + `etapa_conversacao`. Isso funciona, mas se um prestador tiver 2 convites de ciclos diferentes (ciclo 1 cancelado, ciclo 2 ativo), a query pode retornar o errado.
- Fix: adicionar filtro `.eq("despacho.status", "aguardando")` — ja existe na logica (linha 93), mas a query relacional nao filtra na clausula WHERE do Supabase, so valida depois. Precisa de um `.not("despacho_id", "is", null)` com join filter ou query em 2 etapas.

**4. Despacho-disparar — Sem campo `observacoes` no chamado**
- A mensagem ja inclui `chamado.observacoes` (linha 220). OK.

**5. Falta de "valor sugerido" na mensagem inicial de despacho**
- O usuario pediu que a mensagem inclua o "valor sugerido". Atualmente a mensagem NAO inclui valor (so inclui apos o prestador enviar localizacao). Isso esta correto pelo fluxo aprovado (valor depende da distancia do prestador), entao nao e bug.

**6. Teste com dados mockados**
- Precisa testar a edge function de disparo com curl e simular respostas de prestador no webhook para validar o fluxo completo.

### Ajustes Planejados

| # | Ajuste | Arquivo |
|---|--------|---------|
| 1 | Remover casts `as any` para `etapa_conversacao` no CardDespachoReboque | `CardDespachoReboque.tsx` |
| 2 | Melhorar grid de counters: trocar "Sem resp." por "Recusados" + adicionar "Aguardando" | `CardDespachoReboque.tsx` |
| 3 | Adicionar filtro mais robusto no webhook para evitar convites de ciclos anteriores | `whatsapp-meta-webhook/index.ts` |
| 4 | Testar edge function `despacho-reboque-disparar` com curl mockado | Teste via tool |
| 5 | Testar webhook simulando resposta de prestador | Teste via tool |

### Detalhes Tecnicos

**CardDespachoReboque.tsx** — Limpeza de tipos:
- Substituir `(c as any).etapa_conversacao` por `c.etapa_conversacao` (campo ja existe no tipo)
- Melhorar counters grid para 5 colunas ou reorganizar com recusas visíveis

**whatsapp-meta-webhook** — Query mais segura:
- Na funcao `processarRespostaPrestador`, apos buscar o convite, verificar tambem se o `despacho_id` pertence a um despacho com `status = 'aguardando'` de forma mais explicita (a validacao ja existe na linha 93, mas adicionar filtro na query SQL para nao trazer convites de despachos cancelados).

**Testes com curl**:
- Chamar `despacho-reboque-disparar` com um `chamado_id` real de teste
- Chamar o webhook simulando mensagem "SIM", depois localizacao, depois aceite

