## Diagnóstico — raiz do erro

Investiguei o caso `KXD6881` / chassi `935SLYFYYFB520933` no banco. A foto é a seguinte:

| Associado | CPF | Veículo (id) | Status veíc. | Status assoc. | Cotação | Contrato | Enviado SGA? |
|---|---|---|---|---|---|---|---|
| FABIO LENO DE SOUZA | 03236347708 | `cb7c49d9…` | `em_analise` | `pendente_vistoria` | **nenhuma** | nenhum | **NÃO** (sem fila, sem log) |
| VITÓRIA ANTÔNIA … | 12213590702 | `2f162355…` | `ativo` | `ativo` | `7dc53937…` | `a3d70892…` | **SIM** (cód. associado Hinova `30000`, veículo falhando com "ano FIPE") |

Ou seja, dentro do **nosso banco** existem dois veículos diferentes com a mesma placa+chassi+renavam, vinculados a **dois associados de CPFs distintos**. No **SGA** só foi efetivamente cadastrada a Vitória — mas o problema é estrutural: nada impede que amanhã o cadastro do Fabio também seja enviado e gere a mesma duplicidade lá fora.

A varredura geral confirma que o problema **não é isolado**: pelo menos outro caso existe — placa `TUF2F28` / chassi `9C2KF5210PR003478` em dois associados.

### Causas-raiz (em ordem de gravidade)

1. **Não existe constraint UNIQUE em `veiculos.placa`, `veiculos.chassi` ou `veiculos.renavam`.**
   A única coisa que existe é `idx_veiculos_placa` (não-único). Resultado: dois fluxos diferentes podem inserir o mesmo veículo sem qualquer guardrail no banco.

2. **Cadastros "soltos" sem cotação.**
   O Fabio foi criado como associado + veículo, mas **nunca teve cotação**. Algum fluxo (admin ou import) inseriu o veículo direto sem passar pela checagem de duplicidade da cotação. Por isso ele ficou "limbo" e não disparou nenhum bloqueio.

3. **Sem normalização de chave.**
   `placa`, `chassi`, `cpf` são gravados como o usuário digitou (com/sem hífen, com/sem máscara, espaços, maiúsculas/minúsculas). Mesmo se houvesse um UNIQUE, ele falharia em detectar `KXD-6881` vs `KXD6881`.

4. **`fn_validar_campos_ativacao` e `ativar-associado` validam só campos do próprio associado** — não checam se o veículo já existe vinculado a outra pessoa.

5. **SGA `cadastrar_veiculo` está reciclando erro genérico ("Não aceitável") sem reconhecer "já existe"** — então nem a integração consegue se defender.

---

## Plano de correção (em fases)

### Fase A — Conter o sangramento (migration imediata)

Adicionar guards no banco que **impedem** novas duplicidades, mesmo se o app estiver com bug.

1. Função `public.fn_normalizar_placa(text)` → `UPPER + remove [^A-Z0-9]`.
   Função `public.fn_normalizar_chassi(text)` → `UPPER + remove [^A-Z0-9]`.
   Função `public.fn_normalizar_doc(text)` → só dígitos.

2. **Índices únicos parciais** em `veiculos`, ignorando registros já cancelados/recusados (para não quebrar histórico):
   ```sql
   CREATE UNIQUE INDEX uniq_veiculos_placa_ativa
     ON veiculos (fn_normalizar_placa(placa))
     WHERE placa IS NOT NULL AND status NOT IN ('cancelado','recusado');

   CREATE UNIQUE INDEX uniq_veiculos_chassi_ativa
     ON veiculos (fn_normalizar_chassi(chassi))
     WHERE chassi IS NOT NULL AND status NOT IN ('cancelado','recusado');
   ```
   Antes de criar, **resolver os 2 casos existentes** (passo C abaixo) — senão o `CREATE INDEX` falha.

3. Trigger `BEFORE INSERT/UPDATE` em `veiculos` que:
   - normaliza `placa`/`chassi` no próprio registro;
   - bloqueia (`RAISE EXCEPTION`) se já existe outro veículo ativo de **outro associado** com mesma placa **ou** mesmo chassi;
   - mensagem clara: "Veículo placa X já está cadastrado para o associado Y (CPF Z)".

4. Index único em `associados (fn_normalizar_doc(cpf))` (parcial, status não terminal). Já existe? Verificar; se não, adicionar.

### Fase B — Pré-validação no fluxo de criação

Mesmo com os guards do banco, queremos UX clara antes do erro 23505.

1. RPC `fn_checar_disponibilidade_veiculo(_placa, _chassi, _associado_id)` que retorna:
   ```json
   { "disponivel": false, "conflito": "placa", "associado_existente": "...", "status": "ativo" }
   ```
2. Chamar essa RPC em:
   - `useCriarCotacao` / fluxo de cotação (já hoje deve checar — verificar);
   - `useIncluirVeiculo` (inclusão em associado existente);
   - **Fluxo admin de cadastro avulso** (o que criou o Fabio sem cotação);
   - `aprovar-proposta` antes de aprovar (defesa em profundidade).
3. Bloquear `ativar-associado` se a checagem detectar conflito ativo com outro associado.

### Fase C — Saneamento dos casos existentes

1. Caso `KXD6881` (Fabio × Vitória):
   - Vitória está ativa, com instalação concluída e código Hinova `30000` → **mantém**.
   - Fabio está só como `pendente_vistoria` sem cotação/contrato → **marcar veículo como `recusado`** com motivo "duplicidade detectada — placa pertence a outro associado ativo" e **associado como `recusado`** (ou mover para um status específico tipo `duplicado_bloqueado`). Registrar em `associados_historico`.
2. Caso `TUF2F28` — mesmo tratamento: identificar qual é o "bom" (com contrato/instalação) e recusar o outro.
3. Script SQL de auditoria salvo em `/mnt/documents/duplicidades_veiculos.csv` com a lista completa para o usuário conferir antes de aplicar.

### Fase D — Defesa na integração SGA

1. Em `sga-sync` (ou função equivalente que faz `cadastrar_veiculo`): tratar resposta "Não aceitável" do Hinova reconhecendo o subcaso **"placa já cadastrada"** → marcar fila como `bloqueado_duplicidade` (status novo) em vez de continuar tentando 10x.
2. Adicionar à `fn_detectar_limbo_ativacao` (Fase 4) um cenário `duplicidade_sga` que aparece no dashboard de Saúde da Ativação.
3. Logar `bloqueado_duplicidade` em `ativacao_status_log` para visibilidade.

### Fase E — Fechar a porta dos cadastros avulsos

1. Identificar o(s) ponto(s) onde se cria associado+veículo **sem cotação** (Fabio é a evidência).
   Provavelmente: tela admin de "novo associado", import via API externa, ou edge function que duplica para o caminho de "cliente externo".
2. Adicionar a mesma checagem da Fase B nesses pontos.
3. Em sequência, criar uma **trigger ou check** que recuse veículos com `associado_id` cujo `cpf` já tenha outro veículo ativo com a mesma placa em outro associado (defesa final).

---

## Detalhes técnicos

### Arquivos / objetos esperados
- Migration: `add_uniqueness_veiculos.sql` — funções de normalização + trigger + índices únicos parciais.
- Migration: `fn_checar_disponibilidade_veiculo.sql`.
- Hook novo: `src/hooks/useChecarDisponibilidadeVeiculo.ts`.
- Edits: `aprovar-proposta/index.ts`, `ativar-associado/index.ts`, `sga-sync/index.ts` (nome real a confirmar olhando `supabase/functions`), e o(s) hook(s)/edge function(s) de criação de veículo avulso.
- Saneamento: `data-fix-duplicidades-veiculos.sql` aplicado via insert tool após o usuário aprovar a lista.

### Cenários cobertos pelos novos testes Deno
- Tentar criar veículo com placa já existente em outro associado → 409 com mensagem clara.
- Variações de máscara (`KXD-6881`, `kxd6881`, `KXD 6881`) caem no mesmo bloqueio.
- Idempotência: re-inserção do mesmo veículo no mesmo associado **não** bloqueia.
- `ativar-associado` falha com `duplicidade_veiculo` se houver outro ativo.

### Memória a registrar (se aprovado)
`mem://constraints/operations/veiculo-unico-por-associado-ativo` — "Placa e chassi normalizados são únicos entre associados não-terminais. Cadastros avulsos sem cotação devem passar por `fn_checar_disponibilidade_veiculo`."

---

## Ordem de execução recomendada

1. **Apresentar a lista completa de duplicidades** (export CSV) — você decide qual lado de cada par fica.
2. Sanear (Fase C).
3. Aplicar guards no banco (Fase A).
4. Pré-validação no app + edge functions (Fases B, D, E).
5. Testes Deno de regressão.

Posso começar pela Fase A + export do CSV de duplicidades para você revisar antes do saneamento?
