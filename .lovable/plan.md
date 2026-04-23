

## Corrigir URL do template `termo_filiacao_assinatura_v2` para o link real da Autentique

### Diagnóstico

Confirmado o bug que você apontou. O template **`termo_filiacao_assinatura_v2`** (migration `20260421233246`) foi cadastrado com:

```json
{ "url": "https://app.praticcar.org/contrato/{{1}}",
  "exemplo": "https://app.praticcar.org/contrato/abc123" }
```

E o helper `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts` (linha 61) extrai apenas o **último segmento** da URL Autentique (`https://assina.ae/<token>`) e injeta esse token como `{{1}}`. Resultado: o cliente recebe um link `https://app.praticcar.org/contrato/<token-da-autentique>` — **rota inexistente no app**, não abre Autentique e não permite assinatura.

**Padrão Meta-aprovado já usado no projeto** (e que é o modelo correto):

| Template (já aprovado) | URL do botão |
|---|---|
| `assinatura_documento_v2` (migration 20260316212103) | `https://assina.ae/{{1}}` |
| Termo de filiação v1 (migration 20260420200536) | `https://assina.ae/{{1}}` |

→ A Autentique encurta o link de assinatura para `https://assina.ae/<token>`. Esse é o domínio padrão e foi o usado em todas as aprovações Meta anteriores. **`v2` divergiu sem motivo** e ficou com URL inválida.

### Correção

**1. Recriar `termo_filiacao_assinatura_v2` com a URL correta** (nova migration)

- `DELETE` do registro atual em `whatsapp_meta_templates` (status `DRAFT`/`RASCUNHO`, ainda não foi aprovado pela Meta — confirmar status antes do delete).
- `INSERT` da nova versão idêntica em corpo/rodapé/variáveis, **trocando apenas o botão URL**:

```json
[{
  "tipo": "url",
  "texto": "Assinar termo",
  "url":   "https://assina.ae/{{1}}",
  "exemplo": "https://assina.ae/abc123"
}]
```

Status inicial `RASCUNHO` (precisa ser submetido à Meta novamente — ciclo padrão).

**2. Helper `enviar-termo-filiacao-whatsapp.ts` — sem mudança funcional**

Já extrai corretamente o token da `autentiqueUrl` (`https://assina.ae/abc123` → `abc123`) e passa em `template_button_params: [token]`. Com a URL do template apontando agora para `https://assina.ae/{{1}}`, o link final renderizado pela Meta volta a ser exatamente o link Autentique original. Apenas atualizar o comentário do topo (linha 4) que ainda referencia o template v1.

**3. Aplicar o mesmo padrão em `autorizacao_fipe_diretoria_v4` (mesma migration `…233246`)**

Esse template é diferente — não é assinatura Autentique, é link interno do painel admin. URL `https://app.praticcar.org/vendas/aprovacoes-fipe/{{1}}` está correta (rota existe em `src/pages/vendas/AprovacoesFipe.tsx`). **Sem alteração.**

**4. Auditoria rápida dos demais templates de assinatura/link**

Já validei (ver tabela do diagnóstico): todos os outros templates de **assinatura** já usam `https://assina.ae/{{1}}`. Templates de painel interno (`/acompanhar/{{1}}`, `/primeiro-acesso?id={{1}}`, `/aprovacoes-fipe`) apontam para rotas reais do app — corretos. **Não há outros templates a corrigir nesta tarefa.**

### Checklist Meta (regras já conhecidas, garantindo aprovação)

- ✅ Categoria `UTILITY` (notificação transacional pós-cadastro).
- ✅ Domínio do botão URL = mesmo de outros templates já aprovados (`assina.ae`).
- ✅ Variável dinâmica do botão `{{1}}` com `exemplo` preenchido (`https://assina.ae/abc123`).
- ✅ Corpo/rodapé sem CTA promocional, sem emoji excessivo, com variáveis exemplificadas.

### Arquivos editados

- **Nova migration** — `DELETE` + `INSERT` corrigindo `termo_filiacao_assinatura_v2` (URL = `https://assina.ae/{{1}}`).
- `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts` — atualizar comentário do topo (linhas 4 e 7-8) para refletir v2 e padrão `assina.ae`.

### O que NÃO muda

- Helper continua extraindo o token da `autentique_url` salva em `contratos.autentique_url`.
- Edge function `enviar-termo-filiacao-whatsapp/index.ts` (orquestração) — sem alteração.
- Fallback para `assinatura_documento_v2` permanece (já está com `assina.ae`).
- `autorizacao_fipe_diretoria_v4` — URL interna do painel já é a rota correta.

### Próximo passo após o deploy

Você precisa **submeter `termo_filiacao_assinatura_v2` à Meta novamente** (botão "Submeter para aprovação" na tela de templates WhatsApp). Como a estrutura agora bate com `assinatura_documento_v2` (já aprovado), a aprovação tende a ser rápida.

### Riscos

- Se algum cliente já recebeu o template v2 com URL quebrada, ele precisa ser reenviado depois da nova aprovação. Backfill manual (não incluso) — basta listar contratos com `autentique_url IS NOT NULL` e `status='aguardando_assinatura'` criados após `2026-04-21` e disparar reenvio.
- A nova versão fica em `RASCUNHO` até aprovação Meta — durante esse período, o helper cai no fallback `assinatura_documento_v2` (já aprovado), então **nenhum cliente fica sem mensagem**.

