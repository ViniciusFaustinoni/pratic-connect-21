# Diagnóstico — Link do prestador caindo em `/app/login`

## O que os logs mostram (caso LSA7A65)

- 25/05 11:05:08 — `instalacao_prestador_links` `60110112…` foi criado com `escopo='fotos_instalacao'`, `status='em_rota'`, `prestador_id=845886a4…` (LEONARDO TORINO MATOSO).
- 25/05 11:05:49 — Link `aceito_em` registrado (Leonardo aceitou no celular dele).
- 25/05 11:11–11:14 — Kleytonn rodou `realocar_servico('fila')` 3× → link ficou `status='cancelada'`.
- `whatsapp_mensagens` / `whatsapp_logs` **não têm nenhum registro** dessa atribuição → a edge `gerar-link-prestador` foi chamada com `skip_whatsapp=true`, então o template oficial nunca foi disparado.
- O `auth_logs` mostra que `leonardomatoso2014@gmail.com` (e-mail pessoal do prestador, que **também é associado**) só foi `user_signedup` às 14:24 UTC (≈11:24 BRT) e fez vários `login` por password depois disso — exatamente o que aparece na tela do print (Área do Associado, e-mail preenchido).

## Onde está o bug no código

### 1. `skip_whatsapp: true` hardcoded
`src/hooks/useAtribuicaoManual.ts`
- linha **701** (escopo fotos+instalação) e linha **792** (somente fotos) chamam `gerar-link-prestador` com `skip_whatsapp: true`.
- Comentário na linha 822 admite: *"Link gerado (sem WhatsApp automático)"*.
- Resultado: a edge cria o link mas **nunca dispara o template `prestador_nova_instalacao_v2`**. O coordenador tem que copiar/colar manualmente — e foi isso que aconteceu.

### 2. Domínio errado no botão "Copiar Link"
`src/components/instalacoes/InstalacaoDetailDrawer.tsx` linha **495**:
```
const url = `https://pratic-connect-21.lovable.app/prestador/instalacao/${prestadorLink.token}`;
```
Viola o Core de memória *Production URL is strictly `https://app.praticcar.org`*. Outros pontos do código (`SinistroAnalise.tsx`, `EventoLinkCard.tsx`, `Documentos.tsx`) têm o mesmo problema — provavelmente herança histórica.

### 3. Por que o prestador caiu em `/app/login`
A rota `/prestador/instalacao/:token` é pública e usa `publicSupabase` — se aberta no domínio certo, **não exige login**. Hipóteses prováveis (a serem confirmadas no print):

- a) Coordenador copiou via "Copiar Link" do drawer → URL com domínio `pratic-connect-21.lovable.app`. O prestador abriu no celular, o navegador ou um PWA instalado interceptou e jogou no `/app/login` (já que ele é também associado e tem o app instalado).
- b) Coordenador enviou texto sem o link completo (Meta wa.me trunca/encoda); o prestador acessou `app.praticcar.org` puro → redirect `/` → `/dashboard` → guard manda para login. Mas pela rota atual `/` vai para `/dashboard`, e dashboard exige login → cai em login interno e não em `/app/login`. Menos provável.
- c) O prestador, depois de aceitar a tarefa pelo link real (`aceito_em` às 11:05:49 mostra que o link FUNCIONOU uma vez), perdeu a sessão / fechou o navegador, reabriu via deep-link e o PWA do Associado capturou a navegação.

## Plano de correção

### Etapa 1 — Confirmar com você
Antes de mexer, preciso saber **qual destes fluxos** o coordenador usou no caso LSA7A65, porque a correção muda:
1. Botão "Atribuir" da **Atribuição Manual** (Monitoramento) ou do **Mapa** → mostra `LinkPrestadorResultDialog` com "Abrir no WhatsApp" / "Copiar Link"
2. Botão **"Reenviar"** no `InstalacaoDetailDrawer` (este sim já chama `gerar-link-prestador` sem `skip_whatsapp` e dispara o template)
3. Botão **"Copiar Link"** no `InstalacaoDetailDrawer` (URL com domínio errado)

### Etapa 2 — Correções (após confirmação)
- **Fix A** (sempre): trocar `pratic-connect-21.lovable.app` por `app.praticcar.org` no `InstalacaoDetailDrawer.tsx:495` e nos outros 4 lugares listados.
- **Fix B** (se for o fluxo 1): remover `skip_whatsapp: true` das duas chamadas em `useAtribuicaoManual.ts` (linhas 701 e 792) **ou** adicionar toggle no popover/dialog ("Enviar WhatsApp automaticamente: ✅"). Hoje o template `prestador_nova_instalacao_v2` é o canal canônico — coordenador colando wa.me manual é fonte de erro recorrente (sem rastreabilidade em `whatsapp_mensagens`).
- **Fix C** (defesa em profundidade): em `PrestadorInstalacao.tsx`, quando token inválido/expirado, **nunca** deixar redirect cair em `/app/login` — sempre mostrar tela de erro pública explicando "link inválido/expirado, fale com o coordenador".

### Etapa 3 — Saneamento do LSA7A65
Aplicar manualmente apenas se necessário (a correção da `realocar_servico` da última loop já republicou a tarefa na fila). Verificar se o serviço/agendamento está visível em Atribuição Manual antes de mexer.

### Etapa 4 — Memória
Atualizar `mem://logic/operations/atribuicao-prestador-escopo-canonico` com:
- "Atribuição manual SEMPRE dispara template Meta `prestador_nova_instalacao_v2` (sem `skip_whatsapp`). Coordenador colando wa.me manual é ANTI-PADRÃO — quebra rastreabilidade em `whatsapp_mensagens`."
- "Toda URL de link público de prestador usa `app.praticcar.org` — `pratic-connect-21.lovable.app` é proibido (Core)."

## Riscos
- Remover `skip_whatsapp` no fluxo manual envia o template para o prestador sem que o coordenador veja a prévia. Mitigação: deixar `skip_whatsapp` opcional no dialog (default = enviar).
- Trocar domínio em SinistroAnalise/EventoLinkCard/Documentos pode afetar outros fluxos — fazer em PR separado.
