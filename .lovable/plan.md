## Parte D — Plano cirúrgico (2 deploys)

Fluxo confirmado: gatilho → WhatsApp e e-mail em paralelo → helper checa condições → renderiza → Resend → registra no histórico. Tudo rastreável em `/relacionamento/emails`.

---

### DEPLOY 1 — Observabilidade no helper `enviarEmailSuspensao.ts`

**Problema:** hoje 3 estados de early-return (`template_ausente`, `template_inativo`, `desativado`) saem silenciosamente — não inserem linha em `email_suspensao_envios`. Sem isso, o histórico fica vazio enquanto o template de `inadimplencia` não existir, e fica impossível validar o Deploy 2.

**Mudança:** adicionar `INSERT` em `email_suspensao_envios` nos 3 caminhos de saída antecipada, antes do `return`. Mesma assinatura usada hoje no `sem_email`:
- `status: 'sem_template'` quando template não existe
- `status: 'template_inativo'` quando existe mas `ativo=false`
- `status: 'desativado'` quando toggle global ou individual está off (registra qual)

Campos: `fluxo_key`, `associado_id`, `status`, `motivo` (string curta), `created_at`. Sem `resend_id`, sem `email_destino` se não disponível.

**Não muda:**
- Happy path (`nao_instalacao` com template ativo): zero alteração — fluxos 1 e 2 já em produção continuam idênticos.
- Assinatura da função, parâmetros, retorno.
- Lógica de render/Resend.

**Entrega:** mostro o diff exato do helper antes de deployar. Aguardo seu OK. Deploy isolado. Validação: você dispara uma suspensão de não-instalação real e confere que (a) e-mail continua saindo e (b) histórico continua mostrando `enviado` como hoje.

---

### DEPLOY 2 — Cron `cron-suspender-inadimplentes` chama helper em paralelo

**Local exato:** `supabase/functions/cron-suspender-inadimplentes/index.ts`, dentro do bloco `if (associadoUser?.user_id)` que hoje só chama `disparar-notificacao` (linha ~182).

**Mudança:** adicionar import de `enviarEmailSuspensao` do `_shared/` e, **depois** do `try/catch` atual do WhatsApp, um novo `try/catch` independente:

```ts
try {
  await enviarEmailSuspensao({
    fluxo_key: 'inadimplencia',
    associado_id: associadoId,
    vars: { valor, dias_atraso },
  });
} catch (emailErr) {
  console.error('[cron-suspender-inadimplentes] erro e-mail', emailErr);
}
```

**Não muda:**
- Chamada de `disparar-notificacao` com `subtipo:'suspensao'` — intacta. WhatsApp continua saindo como hoje.
- E-mail genérico do `disparar-notificacao` — continua saindo (decisão de desligar fica pra quando o template `inadimplencia` existir).
- Subtipos `atraso`, `suspensao_iminente`, `vencimento` — 100% inalterados.
- `ContratoDetalhe.tsx` — confirmado que linha 306 é só timeline de exibição, não há call-site real de suspensão manual. Nada a mudar.

**Comportamento pós-deploy 2 (sem template `inadimplencia`):**
- WhatsApp ✅ sai como hoje
- E-mail genérico do `disparar-notificacao` ✅ sai como hoje
- Helper novo ❌ não envia, mas registra `sem_template` no histórico (graças ao Deploy 1)

**Quando você criar o template `inadimplencia` e ativar o toggle:**
- WhatsApp ✅
- E-mail genérico ✅ (até você decidir desligar)
- E-mail novo ✅ começa a sair junto, rastreável em `/relacionamento/emails`

---

### Sequência

1. Eu abro o helper, monto o diff do Deploy 1, te mostro.
2. Você aprova o diff.
3. Deploy 1 isolado. Você valida que fluxos 1 e 2 (não-instalação) seguem normais.
4. Eu monto o diff do Deploy 2, te mostro.
5. Você aprova. Deploy 2.
6. Próxima suspensão por inadimplência: você confere no histórico que aparece `sem_template` pra inadimplência (e nada quebrou no WhatsApp).

---

### Riscos

- **Único risco real:** se algum outro lugar do código chama `enviarEmailSuspensao` esperando que early-returns **não** insiram linha, o Deploy 1 adiciona ruído no histórico desse caller. Mitigação: hoje só fluxos 1 e 2 chamam o helper, e ambos passam pelo happy path — early-returns só disparam em config quebrada, que é exatamente o que queremos ver no histórico.
- Nenhum risco no Deploy 2: novo `try/catch` isolado, falha do helper não afeta WhatsApp nem o resto do cron.

Aguardando seu OK pra abrir o helper e te mostrar o diff do Deploy 1.