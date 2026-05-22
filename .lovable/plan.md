
# Plano: 5 ajustes no fluxo de aprovação de cotações

Fluxo canônico reforçado: **link público → Cadastro → Monitoramento → SGA**. Sem retorno ao Cadastro depois que ele aprova; sem atalhos que pulem a materialização do serviço de campo.

---

## 1. Saneamento dos dois casos presos (KZZ9E93 e 9C2KF5200TR010548)

**Onde:** migration de dados (insert tool, não schema).

**O que faz:**
- Localiza os contratos pelo identificador (placa/chassi) e descobre `instalacao_id` / `vistoria_id` / `agendamento_base_id` existentes.
- Para **Luiz (KZZ9E93)** — sub-FIPE, sem rastreador: cria `servicos` (`tipo='vistoria_entrada'`, `vistoria_origem_id` apontando para a vistoria com vídeo, `status='concluida'`, `local_vistoria` conforme agendamento), preenche `contratos.vistoria_concluida_em` se vazio.
- Para **Fernanda (9C2KF5200TR010548)** — moto que exige rastreador: cria também `instalacoes` (`status='agendada'`) e `servicos` (`tipo='instalacao'`, `instalacao_origem_id` no novo registro, `status='concluida'`), além do `vistoria_entrada` se houver vistoria materializada com vídeo.
- Idempotente: usa `WHERE NOT EXISTS` por `instalacao_origem_id` / `vistoria_origem_id`.
- **Não toca** `cadastro_aprovado`, `aprovado_em`, `status` do contrato, nem promove veículo a `ativo`.

**Resultado:** os dois casos aparecem em `/monitoramento/aprovacoes-unificadas` (aba Aprovação de Associados) no próximo refresh com vídeo anexado e prontos pra decisão final.

---

## 2. Bloquear Cadastro em sub-FIPE sem autovistoria completa

**Onde:** `supabase/functions/aprovar-proposta/index.ts` (handler de aprovação) + UI do Cadastro (`src/pages/cadastro/Associados.tsx` ou similar, no botão Aprovar).

**Regra:**
- Se o veículo é sub-FIPE (`carro FIPE < 30k` ou `moto FIPE < 9k`, e não-diesel) e o plano tem R/F:
  - Exigir autovistoria **completa** (≥31 fotos carro / ≥15 fotos moto) **+ vídeo 360°** materializada em `vistorias`/`vistoria_fotos`.
  - Caso contrário, retornar **HTTP 409** com `code='autovistoria_subfipe_incompleta'` e mensagem: *"Sub-FIPE exige autovistoria completa no link público antes do Cadastro aprovar. O associado precisa concluir 31 fotos (carro) / 15 fotos (moto) + vídeo 360°."*
- Usa `resolverEscopoAnaliseCadastro` (`src/lib/cadastro/escopoAnaliseCadastro.ts`) como fonte da verdade do que conta como "completa".
- UI: hook que avalia o mesmo escopo desabilita o botão Aprovar e mostra a mensagem antes do request.

---

## 3. Bloquear Cadastro em caso com rastreador obrigatório sem instalação agendada

**Onde:** mesma edge `aprovar-proposta` + UI do Cadastro.

**Regra:**
- Se exige rastreador (`diesel`, ou `carro FIPE ≥ 30k`, ou `moto FIPE ≥ 9k`):
  - Exigir `instalacoes` com `status='agendada'` E `data_agendada IS NOT NULL` vinculada à cotação (criada via `criar-instalacao-pos-pagamento` a partir do agendamento do cliente no link público).
  - Caso contrário, **HTTP 409** com `code='instalacao_nao_agendada'`: *"Cliente precisa agendar a instalação do rastreador no link público antes do Cadastro aprovar."*
- **Agendamento_base sozinho não basta** — alinhado com o aperto da guarda já planejado (item 4).
- UI espelha o bloqueio.

---

## 4. Rede de segurança: agendamento interno do Monitoramento materializa `servicos`

**Onde:** trigger DB em `agendamentos_base`.

**Trigger:** `trg_agendamento_base_materializa_servico` — `AFTER INSERT OR UPDATE OF vistoria_id, instalacao_id ON agendamentos_base`.

**O que faz:**
- Quando `vistoria_id` ou `instalacao_id` é preenchido e ainda não existe `servicos` vivo correspondente (`WHERE vistoria_origem_id = NEW.vistoria_id` ou `instalacao_origem_id = NEW.instalacao_id` e status fora de terminais), cria um `servicos` com:
  - `tipo` = `vistoria_entrada` (vistoria) ou `instalacao` (instalação)
  - `status` = `agendada`
  - `data_agendada` / `periodo` derivados do agendamento_base
  - `profissional_id` = `NEW.atendido_por` (se houver)
  - `contrato_id` / `associado_id` herdados via instalação→veículo→contrato (mesma lógica de `trg_vistoria_vinculos_obrigatorios`)
- Idempotente (verificação prévia).
- Tolerante: usa exception handler que loga e segue, para não bloquear escrita em `agendamentos_base`.
- Respeita memória `mem://logic/operations/servicos-um-canonico-por-origem` (1 vivo por origem).

**Bônus:** alinhar `VistoriaInternaDialog` / `InstaladorChecklist` para invalidar `instalacoes-aguardando-aprovacao-monitoramento` (já invalida).

---

## 5. Fechamento automático da vistoria presencial quando o vídeo é anexado

**Onde:** trigger DB em `vistorias`.

**Trigger:** `trg_vistoria_video_360_promove_concluida` — `AFTER UPDATE OF video_360_url ON vistorias`.

**O que faz:**
- Dispara quando `OLD.video_360_url IS NULL AND NEW.video_360_url IS NOT NULL` e `NEW.modalidade <> 'autovistoria'` (presencial: técnico próprio, prestador, base, rota, fit).
- Atualiza:
  - `vistorias.status = 'concluida'`, `concluida_em = now()` (se ainda não).
  - `servicos` vivo com `vistoria_origem_id = NEW.id` → `status = 'concluida'`, `concluida_em = now()`.
  - `contratos.vistoria_concluida_em = now()` (se vazio).
- **NÃO** toca `instalacoes` — vistoria de instalação só fecha pelo fluxo presente (técnico/prestador); aqui é só sincronia da vistoria. Para instalação, o caminho presencial existente (`InstaladorChecklist`) e o prestador (`concluir-instalacao-prestador`) seguem responsáveis.
- Resultado: vistoria presencial cai automaticamente na fila do Monitoramento como "Concluída — Pendente Monitoramento" igual ao caminho do prestador.

**Guardas preservados:** continuam ativos `trg_guard_instalacao_concluida_exige_rastreador`, `trg_guard_veiculo_ativo_exige_rastreador`, `trg_guard_cobertura_rf_exige_decisao_cadastro`. Ativação só via `ativar-associado`.

---

## Ordem de execução

1. **Migration de saneamento** (Luiz + Fernanda) — destrava o problema imediato.
2. **Trigger materializa serviço** (item 4) — rede de segurança antes de apertar a guarda.
3. **Trigger vídeo → concluída** (item 5).
4. **Aperto de `aprovar-proposta`** (itens 2 e 3) — guarda backend + 409 tipados.
5. **UI Cadastro** — desabilita botão + mostra mensagem; consome `code` retornado pela edge.

---

## Detalhes técnicos resumidos

- **Files editados:**
  - `supabase/functions/aprovar-proposta/index.ts` — adicionar guards (2) e (3) reutilizando `resolverEscopoAnaliseCadastro` portado pra Deno (ou condição equivalente inline).
  - UI do Cadastro (a localizar entre `src/pages/cadastro/` e `src/components/cadastro/`) — handler do botão Aprovar interpreta `code` 409.
- **Migrations (schema):**
  - `trg_agendamento_base_materializa_servico` + função `fn_agendamento_base_materializa_servico`.
  - `trg_vistoria_video_360_promove_concluida` + função `fn_vistoria_video_360_promove_concluida`.
- **Migration (dados, via insert tool):** saneamento dos 2 casos.

## O que NÃO muda

- Estrutura do fluxo (link público → Cadastro → Monitoramento → SGA).
- Regras de prazo (48h, meia-noite troca de titularidade).
- Telas/UX do Cadastro e Monitoramento.
- Caminhos de Troca de Titularidade, Substituição, Prestador, Autovistoria sub-FIPE (já corretos).
- `ativar-associado` segue como única porta para `ativo`.
