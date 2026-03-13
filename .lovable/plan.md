

## Auditoria: Fluxo de Notificações WhatsApp (Boas-vindas → Técnico a Caminho → Proteção 360)

### Problemas Encontrados

---

#### BUG 1 (CRÍTICO): `notificar-inicio-rota` referencia variável inexistente `jaNotificadoPeloCron`

**Arquivo:** `supabase/functions/notificar-inicio-rota/index.ts`, linha 167

Na última alteração, removemos a lógica de verificação `jaNotificadoPeloCron`, mas o `else if` na linha 167 **ainda referencia essa variável**. Como ela nunca é declarada, o código falha com `ReferenceError` quando o cliente não tem telefone cadastrado — mas mais importante, a presença dessa referência pode causar comportamento imprevisível no runtime do Deno (crash silencioso).

```text
Linha 167: } else if (jaNotificadoPeloCron) {  ← VARIÁVEL INEXISTENTE
Linha 168:   console.log("... já notificado pelo cron...");
Linha 169:   resultados.cliente_notificado = true;
```

**Correção:** Remover o bloco `else if (jaNotificadoPeloCron)` inteiro (linhas 167-169), deixando apenas o `else` para "sem telefone".

---

#### BUG 2 (MODERADO): `whatsapp-send-text` exige `mensagem` mesmo para envio de template

**Arquivo:** `supabase/functions/whatsapp-send-text/index.ts`, linha 353

```typescript
if (!telefone || !mensagem) {
  return Response... "telefone e mensagem são obrigatórios"
}
```

A `ativar-associado` (boas-vindas) envia **tanto** `mensagem` quanto `template_name` — funciona. Mas a `notificar-cliente` também envia `mensagem` no `sendBody` — funciona.

Isso não é um bloqueio atual, mas é um risco se algum caller futuro enviar só `template_name` sem `mensagem`.

**Ação:** Nenhuma correção necessária agora — apenas observação.

---

#### BUG 3 (MODERADO): `notificar-cliente` — template `tecnico_em_rota` mapeia para `tecnico_a_caminho_1` com 6 params

**Arquivo:** `supabase/functions/notificar-cliente/index.ts`, linhas 392-401

O mapeamento envia 6 parâmetros ao template `tecnico_a_caminho_1`. Se o template aprovado na Meta tiver um número diferente de variáveis no corpo, a mensagem falhará silenciosamente (o erro é capturado pelo `catch` na linha 566 e não propagado).

**Ação:** Verificar se o template `tecnico_a_caminho_1` na Meta realmente aceita 6 variáveis de corpo. Isso está correto conforme a memória do sistema — sem ação necessária.

---

### Resumo das Ações

| # | Severidade | Problema | Ação |
|---|-----------|----------|------|
| 1 | **CRÍTICO** | `jaNotificadoPeloCron` referenciada sem ser declarada em `notificar-inicio-rota` | Remover bloco else-if morto (linhas 167-169) |
| 2 | Observação | `whatsapp-send-text` exige `mensagem` para templates | Monitorar |
| 3 | Observação | Contagem de params do `tecnico_a_caminho_1` | Já correto |

### Alteração

**Arquivo:** `supabase/functions/notificar-inicio-rota/index.ts`

Remover linhas 167-169 (referência à variável inexistente `jaNotificadoPeloCron`), transformando o fluxo em:

```typescript
    if (clienteTelefone) {
      // ... envia notificação via notificar-cliente ...
    } else {
      console.warn("[notificar-inicio-rota] Cliente sem telefone cadastrado");
      resultados.erros.push("Cliente sem telefone cadastrado");
    }
```

Redeploy da Edge Function `notificar-inicio-rota`.

### Fluxo Validado (após correção)

```text
1. BOAS-VINDAS (ativar-associado)
   ✓ Envia template 'cadastro_aprovado_botao' via whatsapp-send-text
   ✓ 5 params body + 1 button param (link_token)
   ✓ Sem duplicação (asaas-webhook já filtrado para tipo != 'adesao')

2. TÉCNICO A CAMINHO (notificar-inicio-rota → notificar-cliente)
   ✗ BUG: referência a jaNotificadoPeloCron causa potencial crash
   → Correção: remover referência morta

3. PROTEÇÃO 360 (useVistoriaCompletaAnalise / useServicos → notificar-cliente)
   ✓ Envia template 'cobertura_total_ativada' com 3 params
   ✓ Disparado condicionalmente quando há instalacaoId
```
