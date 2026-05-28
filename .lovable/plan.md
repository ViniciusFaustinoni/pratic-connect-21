## Escopo (somente troca de titularidade)

Três correções, sem tocar nos outros fluxos (retirada/substituição/cancelamento/venda).

---

### 1. Sondagem real da plataforma antes de promover

**Onde mora o helper:** novo `supabase/functions/_shared/troca-plataforma-probe.ts` (Deno-only, importável por edges e crons).

**Assinatura:**
```ts
export type ProbeResult =
  | { ok: true; status: 'sincronizado'; novoUserId: string; vehicleId: string }
  | { ok: false; status: 'pendente' | 'falha'; motivo: string; detalhes?: any };

export async function sondarPlataformaTroca(
  supabase: SupabaseClient,
  solicitacaoId: string,
): Promise<ProbeResult>;
```

**Comportamento:**
- Lê `solicitacoes_troca_titularidade` → `veiculo_id`, `associado_antigo_id`, `novo_associado_id`.
- Resolve `vehicleId` via `veiculos.softruck_vehicle_id` ou `rastreadores.plataforma_veiculo_id` (rastreador instalado). Se inexistente e veículo não exige rastreador → retorna `{ status: 'sincronizado', motivo: 'nao_aplicavel' }` que o caller converte em `nao_aplicavel`.
- Resolve `novoUserId` e `antigoUserId` chamando `softruck-api` `buscar-usuario` por CPF/email de cada lado.
- Chama `softruck-api` `listar-usuarios-veiculo`.
- **Sincronizado SSE:** `novoUserId` presente E `antigoUserId` ausente. Não basta "apenas novo" — checa explicitamente ausência do antigo.
- Plataforma Rede: branch paralelo via `rede-veiculos-buscar-dispositivo` (mesmo critério). Plataforma escolhida via `rastreadores.plataforma`.
- Sem race com a leitura: sondagem é a leitura real, não cache.

**Aplicação:**
- `fn_promover_troca_se_completo` (SQL puro) **não** faz HTTP. A sondagem roda **antes** do gate, no caller (edge/cron), e ESCREVE o resultado em `plataforma_rastreador_status` + `plataforma_rastreador_sincronizado_em` + `plataforma_rastreador_erro`. Depois disso chama `fn_promover_troca_se_completo`, que continua só consultando a coluna persistida.
- Callers que passam a sondar antes de chamar o gate:
  - `cron-softruck-troca-retry` — substitui o bloco pré-check atual pela função compartilhada e usa o critério estrito (antigo ausente).
  - `efetivar-troca-titularidade` — depois de mexer no Softruck inline, sonda antes de chamar o gate.
  - Novo `cron-troca-promocao-gate` (a cada 5 min) varre `status='efetivacao_pendente'` há > 2 min, sonda e chama o gate. Rede de segurança caso o callback do retry tenha caído.

---

### 2. Unificar setters de `efetivada`

**Regra:** ninguém mais escreve `status='efetivada'` direto. Apenas `fn_promover_troca_se_completo`.

**Guard explícito no gate** (substitui o atual):
```sql
-- Estados de origem válidos para promoção
IF v_sol.status NOT IN ('efetivacao_pendente') THEN
  RETURN QUERY SELECT false, v_sol.status, ARRAY['status_nao_promovivel:' || v_sol.status];
  RETURN;
END IF;
```
Lista deliberadamente restrita a `efetivacao_pendente`. `aguardando_monitoramento` / `liberada_para_assinatura` / qualquer outro **não** pode pular para `efetivada` direto — antes precisam transicionar para `efetivacao_pendente` (responsabilidade da edge `efetivar-troca-titularidade` e da trigger).

**Trigger `fn_efetivar_troca_pos_vistoria`:** mantém os UPDATEs colaterais (contrato anterior, contrato novo, veículo), mas só seta `solicitacoes_troca_titularidade.status = 'efetivacao_pendente'` + `efetivada_em = now()` e delega ao gate (já está assim hoje após a rodada anterior). Adiciona o passo de **sondagem** antes do `PERFORM fn_promover_troca_se_completo` via chamada à nova edge `troca-promover-com-sondagem` (pequena wrapper que sonda + chama o gate). Trigger não chama HTTP diretamente.

**Edge `efetivar-troca-titularidade`:** o UPDATE de linha ~2223 que hoje seta `efetivacao_pendente` permanece; logo após, chama `troca-promover-com-sondagem` em vez de `fn_promover_troca_se_completo` direto. Nenhum outro setter de `efetivada` no código fica vivo.

**Consolidação de `fn_troca_promover_monitoramento_pos_vistoria`:** migration única faz `DROP FUNCTION IF EXISTS public.fn_troca_promover_monitoramento_pos_vistoria() CASCADE;` e recria a versão de 2026-05-14 (a mais recente). Recria a trigger que dependia dela. Sem versões coexistindo.

---

### 3. Órfãos de fila

**3a. `troca_titularidade:inativar_associado_antigo` — AUTOMATIZÁVEL**

Etapa de inativação do antigo titular no SGA Hinova (chamada `alterarSituacaoAssociadoHinova(antigoCodigo, 2)`). Hoje é enfileirada sem consumer.

- Estender `cron-sga-retry` com case explícito para `etapa LIKE 'troca_titularidade:inativar_associado_antigo'`: resolve `codigo_hinova` do antigo associado e chama `alterarSituacaoAssociadoHinova`.
- Sucesso → fecha item (`status='concluido'`) e chama `fn_promover_troca_se_completo(solicitacao_id)`.
- Falha → respeita política de retry/`falha_permanente` já existente.
- Esta etapa **não** bloqueia `plataforma_rastreador_status` nem o gate principal de promoção — é higiene de cadastro SGA. Mas se vier `falha_permanente`, sobe na UI como sub-pílula informativa (não impede `efetivada`).

**3b. `troca_titularidade:codigo_associado_nao_encontrado` — MANUAL**

Cenário: SGA respondeu "CPF já existe" no `cadastrar`, mas `buscar/cpf` devolveu 404. Operador precisa preencher manualmente o `codigo_hinova` no painel SGA.

- **Não automatiza.** Confirma comportamento atual de inserir com `acao_manual=true`, sem retry automático no cron (filtro adicional `AND acao_manual IS NOT TRUE` no `cron-sga-retry`).
- **Aparece pro operador:**
  - **Modal `ModalDetalhesTroca` / `AprovacoesTroca`:** novo bloco "Pendências SGA — ação manual" listando itens de `sga_sync_queue` com `origem='troca_titularidade'` + `acao_manual=true` + `status NOT IN ('concluido')`, filtrados pela `solicitacao_id` (via `payload->>solicitacao_id`).
  - Cada linha mostra: etapa (`codigo_associado_nao_encontrado`), associado afetado, CPF, link "Abrir no SGA Hinova" (rota `/configuracoes/integracoes/sga-hinova?placa=…`), e botão **"Marcar como resolvida"** que chama nova edge `troca-resolver-pendencia-manual`:
    - valida que operador é coordenador/diretoria;
    - relê do SGA via `buscarAssociadoPorCpf` para confirmar que o código já existe;
    - se OK, atualiza `associados.codigo_hinova` e marca o item da fila como `concluido` com `resolvido_por`/`resolvido_em`;
    - chama `fn_promover_troca_se_completo`.
  - Badge no card da troca (em `AprovacoesTroca` e `TrocaTitularidadeBadge`): nova sub-pílula `bg-orange-500/15` "SGA: ação manual pendente" quando existir item órfão manual aberto. Distinta da pílula amber "efetivação pendente" usada para pendências automáticas.
- **Trava de promoção:** enquanto existir `sga_sync_queue` com `origem='troca_titularidade'` + `acao_manual=true` + `status` aberto vinculado à solicitação, o gate atual já bloqueia (cláusula `status IN ('pendente','processando','falha')` cobre). Confirmado — sem mudança no gate aqui.

---

### Mudanças por arquivo

**Migrations (1 só):**
- Atualizar `fn_promover_troca_se_completo` com guard explícito e mensagem de motivo.
- `DROP FUNCTION ... fn_troca_promover_monitoramento_pos_vistoria() CASCADE;` + recriação canônica + recriação da trigger dependente.
- Filtro `acao_manual IS NOT TRUE` nos selects do cron (via função SQL helper opcional ou direto no cron).

**Edges (novas):**
- `supabase/functions/_shared/troca-plataforma-probe.ts` (helper).
- `supabase/functions/troca-promover-com-sondagem/index.ts` (wrapper: sonda + escreve coluna + chama gate). Chamada por `efetivar-troca-titularidade`, `cron-softruck-troca-retry`, `cron-sga-retry`, novo `cron-troca-promocao-gate`.
- `supabase/functions/troca-resolver-pendencia-manual/index.ts`.
- `supabase/functions/cron-troca-promocao-gate/index.ts` + agendamento pg_cron (a cada 5 min).

**Edges (editadas):**
- `efetivar-troca-titularidade`: substitui chamada direta ao gate.
- `cron-softruck-troca-retry`: usa helper compartilhado; em sucesso/falha invoca wrapper.
- `cron-sga-retry`: novo case para `inativar_associado_antigo`; ignora `acao_manual=true`; chama wrapper ao concluir.

**Front (`src/components/troca-titularidade/`, `src/pages/monitoramento/AprovacoesTroca.tsx`, `src/components/cotacoes/TrocaTitularidadeBadge.tsx`):**
- Hook `usePendenciasManuaisTroca(solicitacaoId)` lendo `sga_sync_queue`.
- Bloco "Pendências SGA — ação manual" no `ModalDetalhesTroca`.
- Sub-pílula laranja no badge + card.
- Sub-pílulas existentes (`SgaSyncCrossBadge`) ganham companion `PlataformaRastreadorCrossBadge` lendo `plataforma_rastreador_status`.

---

### Fora do escopo desta rodada
- Aplicar essas três correções aos fluxos de retirada / substituição / cancelamento / venda.
- Refatorar `_shared/hinova-client.ts` além do necessário para o consumer do `inativar_associado_antigo`.

### Pendente de confirmação
1. Confirma que `cron-troca-promocao-gate` rodando a cada 5 min é OK como rede de segurança (vs deixar só os crons atuais reativos)?
2. O botão "Marcar como resolvida" do bloco manual exige perfil `coordenador` ou `diretoria` — confirma a lista, ou inclui também `monitoramento`?