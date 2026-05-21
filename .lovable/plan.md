# Toggle de disparo por template Meta

Em **Configurações › Integrações › WhatsApp › Templates Meta**, cada linha da tabela ganha um switch **Ativo/Desativado** que liga/desliga o envio daquele template. Desligar **não apaga**, **não despublica na Meta** e **não altera regra/conteúdo** — só impede o disparo. Religar volta a disparar normalmente.

## O que muda para o usuário

- Nova coluna **"Disparo"** na tabela de templates com um switch.
- Quando **desligado**: badge "Disparo pausado" amarelo e o sistema bloqueia silenciosamente qualquer tentativa de envio daquele template (sem fallback para outro).
- Quando **ligado**: comportamento atual.
- O switch é independente do status Meta (APPROVED/PAUSED/etc.). Templates não-APPROVED continuam não enviando como hoje.

## Detalhes técnicos

**1. Banco**
Migration: adicionar coluna `disparo_habilitado boolean NOT NULL DEFAULT true` em `whatsapp_meta_templates`. Sem backfill — todos os existentes ficam `true` (comportamento atual preservado).

**2. UI** (`src/components/integracoes/WhatsAppMetaTemplates.tsx`)
- Nova coluna "Disparo" com `<Switch>` por linha, ligado a `useAtualizarMetaTemplate` (já existe) passando `{ disparo_habilitado }`.
- Quando `disparo_habilitado=false`: mostrar pílula "Disparo pausado" ao lado do nome.
- Tooltip explicando: "Desligar pausa o envio sem perder o template. Religar volta a disparar."

**3. Gate de envio (3 pontos)**
Bloquear envio quando `disparo_habilitado=false`, retornando erro estruturado `{ error: 'template_disparo_desabilitado' }` para o chamador logar e seguir sem quebrar:

- `supabase/functions/whatsapp-send-text/index.ts` — adicionar `disparo_habilitado` no `select` (linhas 129 e 158) e bloquear logo após carregar `template`, **antes** da lógica de fallback. Fallback também respeita o flag (não pula para um template com disparo desligado).
- `supabase/functions/enviar-termo-cancelamento-troca/index.ts` (linha 416, fetch direto na Graph) — consultar o flag do template usado antes do fetch.
- `supabase/functions/disparar-cobranca-csv-meta/index.ts` (linha 661, fetch direto na Graph) — idem; se o template `cobranca_inadimplencia_pratic` estiver desligado, o lote inteiro é abortado com aviso claro no resultado.

**4. Memória**
Adicionar entrada em `mem://logic/integrations/whatsapp-template-disparo-toggle` documentando: flag é local (não toca Meta), default `true`, gate central em `whatsapp-send-text` + 2 chamadas diretas, e que fallback respeita o flag.

## Fora de escopo

- Não mexe em status Meta (APPROVED/PAUSED/DISABLED).
- Não mexe em conteúdo, variáveis, regras de negócio ou cron.
- Não cria histórico de toggles (pode ser adicionado depois se pedido).
