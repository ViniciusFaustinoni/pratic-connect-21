## Fase 2 — Envio real via Resend (isolado e testável pela aba)

Objetivo: habilitar envio real de e-mails pela aba **Relacionamento › E-mails**, sem tocar em nenhum fluxo de suspensão existente. Toda a infra cai sob a aba e só dispara via botão "Enviar e-mail de teste".

---

### 1. Edge function nova: `enviar-email-suspensao-teste`

Por que nova (em vez de reaproveitar `send-email`): isolar Fase 2 de qualquer chamador antigo, manter contrato dedicado (template salvo + variáveis + log no histórico da aba) e permitir alterar/remover sem risco regressivo.

Responsabilidades:
- Validar JWT do chamador e checar que o perfil é `admin_master`, `diretor` ou `desenvolvedor` (mesmo gate da aba).
- Ler template atual de `email_suspensao_template` (assunto + corpo).
- Receber payload: `{ destinatario, variaveis?: { nome_cliente, motivo_suspensao, data } }`. Variáveis ausentes caem para os mesmos valores de exemplo já usados no preview (`Maria Souza`, `Inadimplência da mensalidade de maio`, data atual).
- Renderizar assunto e corpo substituindo `{{nome_cliente}}`, `{{motivo_suspensao}}`, `{{data}}`.
- Inserir linha em `email_suspensao_envios` com `status='pendente'`, `fluxo_origem='teste_manual'`, snapshot de `assunto_enviado` e `corpo_renderizado`.
- Chamar Resend `POST https://api.resend.com/emails` com:
  - `from`: `"Praticcar <nao-responder@praticcar.org>"` (sugestão; sender em `praticcar.org` exige domínio verificado no Resend — ver "Atenção" abaixo).
  - `to: [destinatario]`, `subject`, `html` (corpo simples convertido com quebras de linha → `<br/>`) e `text` (corpo cru) para fallback.
  - `Authorization: Bearer ${RESEND_API_KEY}` (secret já configurado).
- Atualizar a linha em `email_suspensao_envios`:
  - sucesso → `status='entregue'`, salvar `provider_message_id` (id retornado pelo Resend).
  - falha → `status='falhou'`, salvar `erro_mensagem` com a mensagem do Resend.
- Responder ao front com `{ ok, status, erro? }`.

CORS padrão Lovable, validação Zod do payload, sem `verify_jwt` no `config.toml` (validação manual em código).

### 2. Pequena migração no histórico

`email_suspensao_envios` ganha duas colunas opcionais para a Fase 2:
- `provider` (texto, default `'resend'`).
- `provider_message_id` (texto, nullable) — id retornado pelo Resend, útil para futuras consultas de bounce/complaint.

Nenhuma alteração em RLS já existente. Sem mudança em `email_suspensao_config` nem em `email_suspensao_template`.

### 3. UI dentro da aba "E-mails"

Acréscimos mínimos, sem refatorar o layout atual.

- **Botão "Enviar e-mail de teste"** no header da aba (ao lado do título), visível apenas para quem já tem acesso (admin_master / diretor / desenvolvedor — gate da página já cobre).
- **`EnviarTesteDialog.tsx`** (novo): formulário com
  - E-mail de destino (obrigatório, validação básica).
  - Campos opcionais: nome do cliente, motivo da suspensão, data — placeholders com os valores de exemplo.
  - Pré-visualização inline do assunto e do corpo renderizados (reusa `renderTemplateEmailSuspensao`).
  - Botão "Enviar agora" → chama edge function via `supabase.functions.invoke('enviar-email-suspensao-teste', ...)`.
  - Feedback imediato via `toast.success` / `toast.error` com a mensagem retornada; em caso de erro, exibe também o motivo dentro do próprio dialog para o operador conferir antes de fechar.
  - Após sucesso/falha, invalida `KEY_ENVIOS` para o histórico atualizar.
- **`HistoricoEnvios.tsx`**: nenhuma alteração estrutural; passa a popular naturalmente. Filtro de fluxo já lista "teste_manual" via `useEmailSuspensaoFluxos`.
- **`EnvioDetalheDialog.tsx`**: já mostra assunto, corpo renderizado e status — adicionar bloco "Mensagem de erro" quando `erro_mensagem` não for nulo (texto destacado em tom destrutivo). Mantém o "Reenviar" desabilitado (Fase 3).

### 4. Hook novo

`useEnviarEmailTeste` (em `src/hooks/emails-suspensao/`): `useMutation` que chama a edge function, com `onSuccess` invalidando `KEY_ENVIOS` e fazendo toast.

### 5. Escopo desta fase — invariantes

- Toggle global `email_suspensao_config.enabled` segue sem efeito; não é lido por nenhum fluxo.
- Nenhum trigger novo, nenhum cron novo, nenhum chamador além do dialog de teste.
- Edge function `send-email` legacy não é tocada.
- `auth-email-hook`, fluxos de suspensão de cobertura, fluxos de cobrança — intocados.

---

### Atenção operacional (não bloqueia a entrega, mas o diretor precisa saber antes de validar)

Para `nao-responder@praticcar.org` funcionar sem cair em spam/rejeição, o domínio `praticcar.org` precisa estar **verificado no painel da Resend** (registros SPF + DKIM + DMARC publicados no DNS). Se ainda não estiver:
- Os envios podem ser aceitos pela Resend mas marcados como spam pelos provedores, **ou**
- A Resend pode rejeitar com `"The from address is not verified"` — nesse caso o histórico vai logar `falhou` com a mensagem exata, exatamente o comportamento esperado pra você validar.

Se preferir validar primeiro sem depender do DNS, posso usar `from: "Praticcar <onboarding@resend.dev>"` como fallback temporário e trocar para `nao-responder@praticcar.org` assim que o domínio estiver verificado. Me avise no momento de implementar qual caminho seguir.

### Critérios de aceite

- Botão "Enviar e-mail de teste" visível apenas para admin_master/diretor/desenvolvedor.
- Envio para e-mail válido com Resend OK → histórico mostra linha "entregue", origem "teste_manual", com assunto e corpo renderizados visíveis no detalhe.
- Envio com domínio não verificado / e-mail inválido / Resend retornando erro → histórico mostra linha "falhou" com `erro_mensagem` exibido no detalhe.
- Variáveis preenchidas no formulário aparecem corretamente substituídas no corpo enviado; vazias usam os valores de exemplo.
- Nenhum fluxo de suspensão existente alterado; toggle global segue inerte.
