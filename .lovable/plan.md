

## Régua de cobrança configurável

### Diagnóstico — situação atual

**O que já existe e funciona:**
- Página **`/cobranca/regua`** (`src/pages/cobranca/ReguaCobranca.tsx`) com timeline visual, lista de etapas, botão "Adicionar Etapa", switch ativa/inativa, escolha de ação (WhatsApp/SMS/Email/Ligação/Suspensão/Negativação/Cancelamento) e seletor de **template** que já lê de `whatsapp_meta_templates` (mostra status APPROVED/PENDING/REJECTED).
- Tabela `reguas_cobranca` com 1 régua salva ("Régua Padrão", 18 etapas) — campo `etapas` é JSONB.
- 14 templates de cobrança aprovados na Meta (`d_6_lembrete_desconto_v1` … `d14_d61_reativacao_protecao_v1`).
- Configuração "5 dias antes / no dia / depois" funciona: campo `dias` aceita negativo (D-6) ou positivo (D+5).
- Edge Function `executar-regua-cobranca` lê a régua e gera eventos por dia de atraso.

**Bugs e lacunas:**

1. **A edge function `executar-regua-cobranca` está quebrada.** Ela faz `select('*, etapas:regua_etapas(*)')` — referencia uma tabela `regua_etapas` que **não existe**. As etapas estão em `reguas_cobranca.etapas` (JSONB). Hoje a régua nunca executa.
2. **Nenhum cron job agendado** para `executar-regua-cobranca` — mesmo que o código fosse corrigido, ela nunca rodaria sozinha.
3. **Apenas dias positivos são processados.** A função filtra `cobrancas_vencidas` (`< hoje`) e ignora etapas com `dias < 0` (lembretes pré-vencimento como D-6, D-3, D-1). O exemplo do usuário ("5 dias antes do vencimento dia 10") **não dispara hoje**.
4. **Eventos são apenas registrados, não enviados.** A função insere em `cobranca_eventos` com `status: 'agendado'`, mas nada chama `whatsapp-meta-templates` / `enviar-template` para realmente disparar a mensagem.
5. **Não há feedback visual no menu Cobranças** apontando que o cron está parado / quando rodou pela última vez.

**Resposta direta ao usuário:** Sim, a régua **já é configurável** em `/cobranca/regua` (livremente: adicionar/remover etapas, escolher dias relativos ao vencimento, escolher template Meta). **Mas a execução automática está quebrada** — lembretes pré-vencimento nem chegam a ser considerados, e mesmo as cobranças pós-vencimento só geram registros, não disparam WhatsApp.

### Mudanças

**A. Corrigir e completar `supabase/functions/executar-regua-cobranca/index.ts`**

- Trocar `select('*, etapas:regua_etapas(*)')` por `select('*')` e ler `regua.etapas` (JSONB) — alinha com o schema real e com o que `ReguaCobranca.tsx` salva.
- Trocar `etapa.dia` por `etapa.dias` e `etapa.tipo` por `etapa.acao` (nomes que a UI grava).
- **Adicionar suporte a `dias < 0` (lembretes pré-vencimento):** segunda passada que busca cobranças com `data_vencimento BETWEEN hoje AND hoje + |min_dias_negativos|` e dispara a etapa cujo `dias` corresponde a `data_vencimento - hoje` (ex.: D-5 → todas com vencimento daqui a 5 dias).
- **Disparar de verdade os templates WhatsApp:** quando `etapa.acao === 'whatsapp'` e `etapa.template` definido, chamar a edge function `enviar-template-meta` (ou equivalente já existente — vou descobrir o nome real durante a implementação) passando `{ telefone, template_nome, parametros: { nome, valor, vencimento, link_boleto } }`. SMS/Email idem se houver função; senão, registrar evento e seguir.
- Manter o anti-duplicidade (`cobranca_eventos` últimos 7 dias) já implementado.
- Atualizar `cobranca_eventos.dados.status` para `'enviado'` / `'falhou'` conforme retorno do envio.

**B. Agendar cron job (migration nova)**

```sql
SELECT cron.schedule(
  'executar-regua-cobranca-diario',
  '0 9 * * *',  -- todo dia às 09:00 BRT
  $$ SELECT net.http_post(
      url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/executar-regua-cobranca',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb
  ) $$
);
```

**C. Painel "Configurações da Régua" no menu Cobranças**

- A página `/cobranca/regua` já é o painel pedido. Adicionar:
  - **Card "Última execução"** mostrando `cron.job_run_details` mais recente (status, horário, log) — read-only com botão "Executar agora" que chama `supabase.functions.invoke('executar-regua-cobranca')`.
  - **Banner de aviso** quando uma etapa aponta para template com status ≠ `APPROVED` (já tem o badge inline; adicionar resumo no topo: "2 etapas usam templates não aprovados — não serão enviadas").
  - **Atalho "Editar template na Meta"** ao lado do select de template — link para `/configuracoes/templates-meta?template=<nome>` (página existente — vou confirmar a rota exata na implementação) para fechar o ciclo "régua ↔ catálogo de templates Meta".

**D. Nada muda no catálogo de templates**

A página de **Templates Meta** continua a fonte de verdade do conteúdo (corpo, variáveis, aprovação Meta). A régua **referencia** templates por `nome` — ao editar o conteúdo na área Meta, o disparo da régua já passa a usar a versão atualizada automaticamente. Não há duplicação.

### Arquivos editados

- `supabase/functions/executar-regua-cobranca/index.ts` — fix do schema + suporte a D negativos + envio real via WhatsApp.
- **Migration nova** — cron `executar-regua-cobranca-diario` 09:00 BRT.
- `src/pages/cobranca/ReguaCobranca.tsx` — card "Última execução" + botão "Executar agora" + banner de templates não aprovados + link para editar template no catálogo Meta.

### O que NÃO muda

- Schema de `reguas_cobranca`, `cobranca_eventos`, `cobranca_fila` — intactos.
- Página de Templates Meta — intacta (a régua só consome).
- Estrutura de etapas JSONB já gravada — compatível.

### Validação (após implementação, em modo default)

1. Login como `admin@teste.com / 123456789` → `/cobranca/regua` → adicionar uma etapa **D-5 / WhatsApp / `d_6_lembrete_desconto_v1`** → Salvar.
2. Clicar **"Executar agora"** → conferir no card "Última execução" que rodou sem erro e contou `eventos_criados`.
3. Conferir em `cobranca_eventos` que existem registros com `subtipo = 'regua_d-5'` para associados com vencimento daqui a 5 dias.
4. Print da timeline mostrando D-5, D+0, D+5, D+10 funcionando lado a lado.

### Riscos

- **Disparo em massa no primeiro run:** com 14 etapas ativas e backlog de inadimplentes, pode disparar centenas de mensagens. Mitigação: o anti-duplicidade de 7 dias já protege; adiciono também um **limite de segurança configurável** (env `REGUA_MAX_DISPAROS_POR_RUN`, default 500) que loga e para a execução se exceder.
- **Nome da edge function de envio Meta:** preciso descobrir na implementação (`enviar-template-meta`, `whatsapp-meta-send`, etc.). Se não existir uma genérica, uso o mesmo padrão já presente em `_shared/enviar-termo-filiacao-whatsapp.ts`.
- **Cron `pg_net` exige extensão habilitada:** se não estiver, a migration habilita (`create extension if not exists pg_net`).

