
## Diagnóstico

Mesma assinatura do caso ALAN/KQB4683 em outros 4 contratos: instalação concluída + `contratos.cadastro_aprovado=true`, mas `associados.status` e/ou `veiculos.status` foram editados para `em_analise` **depois** da conclusão da instalação, travando `ativar-associado` com 409 `transicao_invalida`.

| Placa | Associado | Cadastro aprovado | Instalação concluída | Rebobinado por | Quando | `a_status` | `v_status` | `status_sga` |
|---|---|---|---|---|---|---|---|---|
| LMP3D41 | MARCELO LESSA J. DE OLIVEIRA | 25/05 16:36 | 26/05 12:29 | Raphael Boaventura | 26/05 12:30 (7s depois) | em_analise | em_analise | pendente_sga |
| 0KMB9B3B | CIRLAINE DE SANTANA M. RAIMUNDO | 23/05 13:22 | 23/05 14:56 | Alexandre Luiz | 23/05 14:56 | aguardando_aprovacao_monitoramento | em_analise | pendente_sga |
| FVW6H66 | EDUARDO FERNANDO DE O. SANTOS | 15/05 18:29 | 16/05 12:05 | Rafael Peixoto | 16/05 12:05 | em_analise | ativo | pendente_sga |
| HOA1B39 | VINICIUS DE ANDRADE B. SANTOS | 29/04 12:26 | 30/04 19:52 | — | — | em_analise | ativo | pendente_sga |

Padrão: editado por **operador humano** (não trigger), tipicamente segundos após a instalação concluir. Provavelmente botão "Reanalisar/Devolver" sendo clicado por engano na fila de Aprovação de Associados quando o item já cumpriu o caminho canônico.

---

## Plano

### Fase 1 — Hotfix dos 4 travados (uma migration única)
Para cada caso, restaurar `associados.status='aguardando_instalacao'` (allowed_from do `ativar-associado`) e em seguida chamar `/ativar-associado` como admin (source `manual-admin:hotfix-rebobinados-26052026:<placa>`), registrando log de auditoria com motivo. Critério: só executa onde a assinatura ainda bate (instalação concluída + `cadastro_aprovado=true` + status != ativo).

### Fase 2 — Diagnóstico do gatilho de rebobinamento
Identificar exatamente qual botão/edge function permite que um operador rebobine `associados.status`/`veiculos.status` para `em_analise` quando o caminho canônico já foi cumprido. Procurar em:
- Tela de Aprovação de Associados (Monitoramento) — botão "Reprovar/Reanalisar"
- Tela de Cadastro — ação de devolução
- Edge functions: `devolver-ao-cadastro`, `reprovar-vistoria`, qualquer endpoint que escreva `status='em_analise'`

Entregável: lista dos pontos de escrita com avaliação de risco.

### Fase 3 — Guard DB definitivo
Criar trigger `trg_guard_status_rebobinamento_pos_instalacao` BEFORE UPDATE em `associados` e `veiculos` que bloqueia (RAISE EXCEPTION) qualquer transição para `em_analise` quando:
- Existe instalação com `status='concluida'` para o veículo, **E**
- Contrato vinculado tem `cadastro_aprovado=true` e `aprovado_em IS NOT NULL`

Caminho legítimo para reverter passa a ser apenas via edge `devolver-ao-cadastro` (que já existe — `mem://logic/operations/monitoramento-guard-aprovacao-sem-instalacao`), que deve setar uma flag de bypass na sessão da transação (`SET LOCAL app.bypass_rebobinamento_guard = 'true'`) lida pela trigger.

### Fase 4 — UX preventiva
Na fila "Aprovação de Associados" e no detalhe do contrato, esconder/desabilitar qualquer botão genérico de "Editar status" para itens com instalação concluída + cadastro aprovado. Único caminho UI passa a ser "Devolver ao Cadastro" (botão dedicado, com confirmação e motivo obrigatório).

### Fase 5 — Memória
Registrar `mem://logic/operations/guard-rebobinamento-pos-instalacao` documentando: a assinatura do bug, a trigger DB, o caminho canônico de reversão (`devolver-ao-cadastro`) e os 5 casos históricos.

---

## Detalhe técnico

- Trigger usa `pg_trigger_depth()` ou flag de sessão para permitir a edge `devolver-ao-cadastro`
- Hotfix Fase 1 chama `ativar-associado` em série (não paralelo) para evitar disputa de lock
- Casos com `v_status='ativo'` mas `a_status='em_analise'` precisam só do fix em `associados` (veículo já foi promovido por trigger anterior)
- Logs de auditoria em todos os passos com motivo "hotfix-rebobinados-26052026"

---

## Fora de escopo
- Refatorar `ativar-associado` (allowed_from continua igual)
- Mexer no fluxo de Devolução ao Cadastro existente (continua sendo o caminho oficial de reversão)
- Tocar nos 630 órfãos de abril (escopo separado já documentado em memória)
