
## Causa raiz (uma só, com 3 sintomas)

A função-gatilho `public.sync_servico_on_vistoria_decisao` (disparada em todo `UPDATE` de `vistorias.status → aprovada/aprovada_ressalvas/reprovada/cancelada`) **não distingue entre `modalidade='autovistoria'` e vistoria presencial do técnico**. Quando uma autovistoria é aprovada (pelo botão do Monitoramento ou pelo bloco "AUTOVISTORIA ANTECIPADA" do `aprovar-proposta`), o trigger:

1. Promove **qualquer `servicos` (incluindo `tipo='instalacao'`) vinculado à mesma cotação/contrato** para `status='concluida'`.
2. Promove a `instalacoes` correspondente para `status='concluida'` mesmo com `rastreador_id IS NULL`.
3. Em cadeia, `fn_reativar_cobertura_pos_instalacao` seta `veiculos.cobertura_total=true` (não checa rastreador) e abre caminho para `ativar-associado` promover associado/veículo/contrato a `ativo`.

### Sintomas observados

| Caso | FIPE | Evidência DB | Efeito |
|---|---|---|---|
| **André (LUB5F76)** | R$ 64.895 (rastreador obrigatório) | `instalacoes.status='concluida'` + `rastreador_id=NULL`; `veiculos.cobertura_total=true`; `status='ativo'`; criado 3s após `vistorias.analisado_em` | Veículo "ativo" sem rastreador físico — viola regra canônica |
| **Leonardo (LQM4E19)** | R$ 36.472 (rastreador obrigatório, autovistoria opcional p/ R/F) | Tem `vistorias` autovistoria `aprovada` + `instalacoes` `agendada` paralela. `cadastro_aprovado=false`. `cobertura_roubo_furto=true` (vazou via trigger). `status_contratacao='vistoria_agendada'` | Cadastro mostra "Aprovar Proposta" genérico; link público travado |
| **Audit** | ≥R$ 30k | **11 instalações** com `status=concluida` + `rastreador_id=NULL` (André + Romario + Luiz Cosme + Gilberto + Francisco + Peter + Cassio + Rodolfo + Luiz Felipe + Denilson + Leandro) | Todos com `cobertura_total=true` e `veiculo.status='ativo'` indevidamente |

### Por que o label "Aprovar Proposta" persiste em Leonardo

Em `src/pages/cadastro/PropostaAnalise.tsx:99-102`:
```ts
const isAutovistoria = (vistoria?.modalidade === 'autovistoria' || ...) && !proposta?.instalacao_info;
```
A simples existência de uma `instalacoes` agendada (criada pelo link público após o agendamento) zera `isAutovistoria`. Toda a sub-árvore de UI cai no caminho genérico "Aprovar Proposta", mesmo com autovistoria já aprovada e R/F já liberado.

### Por que `status_contratacao` fica preso em `vistoria_agendada`

A função `recompute_cotacao_status_contratacao` não tem regra para promover ≥30k de `vistoria_agendada` → `autovistoria_ok`/`aguardando_aprovacao_cadastro` quando a autovistoria é aprovada antes da instalação técnica. O link público lê esse status e segue mostrando "etapa 1".

---

## Plano de correção (5 frentes)

### 1. Trigger blindada — `sync_servico_on_vistoria_decisao` (migration)

Tornar a função consciente da modalidade:

- Se `NEW.modalidade = 'autovistoria'`:
  - **Nunca** tocar em `servicos.tipo='instalacao'`.
  - **Nunca** tocar em `instalacoes`.
  - Só fechar o `servicos.tipo='vistoria_entrada'` cuja `vistoria_origem_id = NEW.id` (1:1 direto, sem fallback por cotação).
- Se `NEW.modalidade <> 'autovistoria'` (presencial): comportamento atual (já correto).

Reforço extra: `BEFORE UPDATE` em `instalacoes` para barrar `status='concluida'` quando `rastreador_id IS NULL` E o veículo exige rastreador (FIPE≥30k/9k ou Diesel). Erro claro: `instalacao_concluida_exige_rastreador`.

### 2. `fn_reativar_cobertura_pos_instalacao` — checar rastreador (migration)

Só setar `cobertura_total=true` quando `NEW.rastreador_id IS NOT NULL` **ou** o veículo dispensa rastreador (sub-FIPE com `dispensa_rastreador=true`).

### 3. Cadastro UI — label e detecção robusta (frontend)

`src/pages/cadastro/PropostaAnalise.tsx`:
- `isAutovistoria` passa a ser: `vistoria.modalidade==='autovistoria' && (totalFotos>=2 && temVideo360 || totalFotos>=minLegado)` — **não depende mais de `!instalacao_info`**.
- Quando `isAutovistoria && planoTemRouboFurto && !cadastro_aprovado`: label do botão vira `"Aprovar Autovistoria · Liberar R/F"`.

`src/components/cadastro/proposta/PropostaApprovalStepper.tsx`: passar `liberarRfMode` para o CTA principal e ajustar copy/ícone.

### 4. Recompute autovistoria-aware (migration)

Adicionar à `recompute_cotacao_status_contratacao`:
- Se existe `vistorias` autovistoria `aprovada` E `contratos.cadastro_aprovado=false` E veículo exige rastreador → `aguardando_aprovacao_cadastro` (rank acima de `vistoria_agendada`).
- Se `cadastro_aprovado=true` + autovistoria aprovada + instalação ainda não concluída → `autovistoria_ok` (libera link público a mostrar "aguardando instalação técnica" no lugar de "agendar vistoria").
- Adicionar trigger `AFTER UPDATE OF status ON vistorias` que chama o recompute.

### 5. Backfill controlado dos 11 casos contaminados

Migration de saneamento (apresentar lista em comentário SQL para auditoria), por caso:

- `instalacoes.status='concluida' + rastreador_id IS NULL + FIPE≥30k` → reabrir como `agendada` (data_agendada = hoje+2), zerar `concluida_em`.
- `veiculos.cobertura_total=false`, manter `cobertura_roubo_furto=true` (autovistoria já validou R/F).
- `veiculos.status='instalacao_pendente'`.
- `contratos.status='assinado'` (rebaixar de `ativo`), preservando `cadastro_aprovado=true`.
- `associados.status='aguardando_instalacao'`.
- Registrar 1 linha em `associados_historico` por caso com `tipo='correcao_sistema'` explicando o saneamento.
- **Não desfazer Hinova** — apenas marcar `sga_revisao_pendente=true` (já existe) para o Monitoramento revisar.

Caso específico do Leonardo (cadastro_aprovado=false): só rodar o recompute — entra naturalmente na fila certa com o label correto após (3).

### 6. Memória

Salvar `mem://logic/operations/autovistoria-nao-conclui-instalacao` e atualizar Core com a regra "Autovistoria nunca fecha `instalacoes`/`servicos.tipo=instalacao`; só o serviço técnico presencial fecha instalação".

---

## Arquivos afetados

- `supabase/migrations/*` — nova migration com (1), (2), (4), (5)
- `src/pages/cadastro/PropostaAnalise.tsx` — (3)
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` — (3)
- `mem://...` — (6)

## Riscos e mitigação

- Backfill rebaixa 10 contratos hoje `ativo` para `assinado`. **Mitigação**: gerar CSV em `/mnt/documents/` antes da execução para revisão; cobertura R/F preservada (associados continuam protegidos contra roubo/furto).
- Hinova fica dessincronizado momentaneamente. **Mitigação**: `sga_revisao_pendente=true` joga na fila de revisão existente, sem chamadas destrutivas.
- Trigger nova bloqueia inserts legados. **Mitigação**: `BEFORE UPDATE` (não `INSERT`) e só dispara na transição `→ concluida`, com mensagem clara para o operador.

