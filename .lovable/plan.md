
## 1. Diagnóstico (sem alterações)

### 1.1. Estado atual do caso Keven (confirmado no banco)

Todos os IDs informados batem com o banco:

| Entidade | ID | Estado relevante |
|---|---|---|
| `cotacoes` | `e8a95292-…` (COT-20260528-160310409-083) | `status=aceita`, `status_contratacao=autovistoria_ok`, `tipo_vistoria=autovistoria`, `valor_fipe=73 984` |
| `contratos` | `1edec81e-4a65-4c01-b3f6-bd7cf8e3346a` (CTR-20260528190748-HBZ8JC) | `status=assinado`, **`cadastro_aprovado=true`**, **`aprovado_em=2026-05-28 20:51:19.928+00`**, `aprovado_por=f794f9e0-…` |
| `vistorias` | `d7061a3e-c256-4712-952f-e47f803abd33` | `modalidade=autovistoria`, `tipo=entrada`, **`status=aprovada`**, vídeo 360° presente |
| `servicos` (autovistoria) | `cc544b60-c379-42d0-a17d-229d77ad4a0e` | `tipo=vistoria_entrada`, **`status=cancelada`**, `vistoria_origem_id=d7061a3e-…` |
| `servicos` (instalação) | `798d2e95-af0b-4408-b37e-a345ab70dda6` | `tipo=instalacao`, `status=agendada`, `instalacao_origem_id=9a1b17bb-…`, `data_agendada=2026-05-30` |
| `instalacoes` | `9a1b17bb-28fd-4e2a-900d-b3399dbf8330` | `status=agendada`, `data_agendada=2026-05-30` |
| `associados` | `1aad3587-c40a-4039-8476-33a38e74bd61` (KEVEN DA SILVA SOUZA) | `status=aguardando_instalacao` |
| `veiculos` | `d5dc2baa-df1d-4b36-973e-04aaf737d210` (SIO2D02) | `status=instalacao_pendente`, `cobertura_roubo_furto=true`, `cobertura_total=false`, `valor_fipe=73 984` |

### 1.2. Ponto exato em que o bug ocorre

**`supabase/functions/aprovar-proposta/index.ts` linhas 391-399** — é a única gravação que marca `cadastro_aprovado=true`:

```ts
// 2. Registrar aprovação cadastral no contrato sem ativar ainda.
const { data: contratoAtualizado, error: contratoError } = await supabase
  .from('contratos')
  .update({ aprovado_por, aprovado_em: agora, cadastro_aprovado: true })
  .eq('id', contrato_id)
  .eq('status', 'assinado')
  .select('id, status')
  .maybeSingle();
```

A partir daí, no mesmo handler, são executadas em sequência (sem ponto de pausa): atualização de `associados.status='aguardando_instalacao'` (linha 443), criação de `instalacoes` + `servicos.tipo='instalacao'` (bloco `criar-instalacao-pos-pagamento`), promoção do servico de autovistoria para `aprovada` (FIPE ≥ mínimo) e liberação de `cobertura_roubo_furto=true`.

Ou seja: **um único clique** do Cadastro consolida "documentos + autovistoria enxuta" — exatamente o comportamento que precisa ser quebrado em duas sub-etapas.

**Em `src/hooks/usePropostasPendentes.ts` linha 616:**

```ts
if ((contrato as any).cadastro_aprovado === true) return null;
```

É esse filtro que tira o caso da fila do Cadastro. Como hoje `cadastro_aprovado=true` é gravado num único momento, o caso some assim que o aprovar-proposta roda. No modelo canônico de duas sub-etapas, esse mesmo filtro continua válido — mas só será disparado pela **sub-etapa 2**.

### 1.3. UI já tem a estrutura conceitual, falta a sub-etapa 1 ter vida própria

`src/components/cadastro/proposta/PropostaApprovalStepper.tsx` já recebe as flags `cadastroAvaliaFotos` e `aprovarApenasDocumentos` (derivadas de `escopoAnaliseCadastro.ts`). `PropostaAnalise.tsx` já tem `handleAprovarDocumento` (aprovação documento-a-documento). O que **não existe** é o conceito de "documentos aprovados em bloco" gravado no contrato — hoje, quando todos os docs estão `aprovado`, o operador já é levado direto a clicar em "Aprovar Proposta", que dispara o aprovar-proposta inteiro.

---

## 2. Canônico a implementar

### 2.1. Modelo de dados

Adicionar duas colunas em `contratos`:

- `documentos_aprovados_em timestamptz NULL`
- `documentos_aprovados_por uuid NULL` (referência a `auth.users.id` por convenção, sem FK)

Semântica:

- `documentos_aprovados_em IS NULL` → sub-etapa 1 pendente. UI mostra só a aba de documentos.
- `documentos_aprovados_em IS NOT NULL AND cadastro_aprovado=false` → sub-etapa 1 concluída, sub-etapa 2 pendente. UI libera a aba de vistoria enxuta. **Caso continua na fila do Cadastro** (o filtro atual `cadastro_aprovado=true` não dispara).
- `cadastro_aprovado=true` (necessariamente após `documentos_aprovados_em IS NOT NULL`) → sub-etapa 2 concluída. Sai da fila para o Monitoramento.

Reprovação de documentos continua como hoje (caso sai do fluxo positivo, vistoria não chega ao Cadastro porque a sub-etapa 1 nunca conclui).

### 2.2. Nova edge `aprovar-documentos-cadastro`

Recebe `{ contrato_id, aprovado_por }`. Faz exatamente:

1. Valida que o contrato existe, `status='assinado'`, `cadastro_aprovado=false`, `documentos_aprovados_em IS NULL`.
2. Valida que **todos** os `contratos_documentos` esperados do contrato estão com `status='aprovado'` (mesma regra que a UI usa hoje para liberar o botão "Aprovar Proposta").
3. **Gate público mínimo dos documentos**: nenhum gate de vistoria, nenhum gate de SGA financeiro (esse fica na sub-etapa 2).
4. `UPDATE contratos SET documentos_aprovados_em=now(), documentos_aprovados_por=$1 WHERE id=$2 AND cadastro_aprovado=false AND documentos_aprovados_em IS NULL`.
5. Log em `logs_auditoria` (`acao='aprovar_documentos_cadastro'`).
6. **Não** mexe em `associados`, `veiculos`, `instalacoes`, `servicos`, `cobertura_roubo_furto`, `status_contratacao` da cotação.

### 2.3. Refactor de `aprovar-proposta` (sub-etapa 2)

Continua sendo a edge "final" do Cadastro, mas com novo gate no topo (antes do gate atual de caminho público / SGA):

```ts
if (!contrato.documentos_aprovados_em) {
  return 409 { codigo: 'documentos_nao_aprovados', mensagem: 'Aprove primeiro a sub-etapa 1 (documentos).' }
}
```

Exceção explícita: o branch de **troca de titularidade** (linhas 102-194) NÃO exige `documentos_aprovados_em`, porque a troca tem fluxo próprio sem autovistoria — para troca, a aprovação do Cadastro segue como hoje (uma chamada só). Documentar isso em comentário e no memory.

Resto do handler permanece igual. O `UPDATE` da linha 395 continua gravando `cadastro_aprovado=true, aprovado_em, aprovado_por` — porque sub-etapa 2 É o ponto canônico de promoção.

### 2.4. Triggers DB de proteção (defesa em profundidade)

Adicionar `BEFORE UPDATE` em `contratos`:

- `trg_guard_cadastro_aprovado_exige_documentos`: se `NEW.cadastro_aprovado=true AND OLD.cadastro_aprovado=false`, exigir `NEW.documentos_aprovados_em IS NOT NULL`. **Exceção** quando a transição é parte do fluxo de troca de titularidade (`NEW.origem_troca_titularidade_id IS NOT NULL` OU `NEW.tipo_entrada='troca_titularidade'`).
- `trg_guard_documentos_aprovados_imutavel`: `documentos_aprovados_em` só pode mudar de NULL → valor (não pode voltar a NULL nem ser sobrescrito), exceto via função sêntinela usada pelo `devolver-ao-cadastro` (que precisa zerar ambos para reabrir).

### 2.5. UI

`PropostaAnalise.tsx` + `PropostaApprovalStepper.tsx`:

- Buscar `documentos_aprovados_em` no hook que carrega a proposta (já é trivial — basta incluir no select).
- Sub-etapa 1 visível sempre que houver autovistoria enxuta + documentos. Quando todos os documentos estão `aprovado` e `documentos_aprovados_em IS NULL`, mostrar botão **"Aprovar Documentos"** que chama `aprovar-documentos-cadastro`.
- Sub-etapa 2 (cards de fotos + vídeo + botão "Aprovar Vistoria Enxuta") só renderiza quando `documentos_aprovados_em IS NOT NULL`. Esse botão chama `aprovar-proposta` (já existente).
- Para casos **sem autovistoria enxuta** (presencial técnica acima FIPE, sub-FIPE, troca de titularidade): o comportamento atual continua — uma aprovação só, que faz tudo. Isso preserva o canônico já estabelecido em `escopoAnaliseCadastro.ts`.

### 2.6. `devolver-ao-cadastro`

A edge existente que devolve casos do Monitoramento ao Cadastro precisa zerar **ambos** os campos (`cadastro_aprovado=false`, `aprovado_em=null`, `aprovado_por=null`, **e** `documentos_aprovados_em=null`, `documentos_aprovados_por=null`) para que o caso retorne à sub-etapa 1.

### 2.7. Atualizações de memória

- Atualizar memory `cadastro-escopo-canonico` documentando as duas sub-etapas e que vale para todo caso com autovistoria enxuta.
- Nova memory `cadastro-duas-subetapas`: descreve o modelo, os dois campos no contrato, o gate na aprovar-proposta, as exceções (troca), e o devolver-ao-cadastro.

---

## 3. Saneamento do caso Keven (COT-…-083)

Migration única, dentro de uma transação. **Antes de rodar**, deixar registrada no `logs_auditoria` a entrada manual identificando o caso e o operador.

```sql
BEGIN;

-- 1. Reverter cobertura do veículo (antes do contrato, porque o guard trg_guard_cobertura_rf_exige_decisao_cadastro lê cadastro_aprovado)
UPDATE veiculos
SET cobertura_roubo_furto = false,
    status = 'em_analise'
WHERE id = 'd5dc2baa-df1d-4b36-973e-04aaf737d210';

-- 2. Reverter associado
UPDATE associados
SET status = 'em_analise'
WHERE id = '1aad3587-c40a-4039-8476-33a38e74bd61';

-- 3. Cancelar instalação criada indevidamente e seu serviço de instalação vinculado
UPDATE servicos
SET status = 'cancelada',
    observacoes = COALESCE(observacoes,'') || E'\n[SANEAMENTO] cancelado em ' || now() || ' — aprovação consolidada revertida (canônico de duas sub-etapas).'
WHERE id = '798d2e95-af0b-4408-b37e-a345ab70dda6';

UPDATE instalacoes
SET status = 'cancelada'
WHERE id = '9a1b17bb-28fd-4e2a-900d-b3399dbf8330';

-- 4. Reativar o serviço de vistoria_entrada da autovistoria
UPDATE servicos
SET status = 'em_analise',
    observacoes = COALESCE(observacoes,'') || E'\n[SANEAMENTO] reaberto em ' || now() || ' — sub-etapa 2 do Cadastro pendente.'
WHERE id = 'cc544b60-c379-42d0-a17d-229d77ad4a0e';

-- 5. Reverter vistoria
UPDATE vistorias
SET status = 'em_analise'
WHERE id = 'd7061a3e-c256-4712-952f-e47f803abd33';

-- 6. Reverter cotação ao estado anterior à aprovação do Cadastro
UPDATE cotacoes
SET status_contratacao = 'aguardando_aprovacao_cadastro'
WHERE id = 'e8a95292-ebeb-457b-a3b3-b7e9d388d571';

-- 7. Reverter contrato POR ÚLTIMO (zera as duas camadas: sub-etapa 1 e sub-etapa 2)
UPDATE contratos
SET cadastro_aprovado = false,
    aprovado_em = NULL,
    aprovado_por = NULL,
    documentos_aprovados_em = NULL,
    documentos_aprovados_por = NULL
WHERE id = '1edec81e-4a65-4c01-b3f6-bd7cf8e3346a';

-- 8. Log de auditoria
INSERT INTO logs_auditoria (acao, modulo, tabela, registro_id, descricao, usuario_id)
VALUES ('atualizar', 'cadastro', 'contratos', '1edec81e-4a65-4c01-b3f6-bd7cf8e3346a',
        '[SANEAMENTO CANONICO] Caso KEVEN/COT-20260528-160310409-083 revertido: aprovação consolidada quebrada em duas sub-etapas. Vistoria e serviço de autovistoria reabertos; instalação 9a1b17bb e servico 798d2e95 cancelados; cobertura R/F revertida.', NULL);

COMMIT;
```

Ordem importa por causa dos guards `trg_guard_cobertura_rf_exige_decisao_cadastro` e `trg_protege_cadastro_aprovado`: zerar cobertura **antes** de zerar `cadastro_aprovado` evita conflito de guard (cobertura sai com decisão ainda aprovada, depois decisão é zerada).

### 3.1. Validação pós-saneamento

1. Caso aparece em `/cadastro/propostas-pendentes` (KEVEN). Documentos disponíveis. Sub-etapa 2 oculta.
2. Cadastro clica "Aprovar Documentos" → grava `documentos_aprovados_em`. Caso permanece na lista, agora com sub-etapa 2 liberada.
3. Cadastro clica "Aprovar Vistoria Enxuta" → roda aprovar-proposta, cria instalação para 30/05, libera R/F, sai da fila.
4. Conferir que o caso **não** aparece em nenhuma fila de Monitoramento até a sub-etapa 2 concluir.

---

## 4. Ordem de execução proposta

1. Migration: colunas `documentos_aprovados_em` / `documentos_aprovados_por` + guard trigger + saneamento Keven, no mesmo arquivo.
2. Edge `aprovar-documentos-cadastro` (nova).
3. Edge `aprovar-proposta`: novo gate no topo + comentário canônico.
4. Edge `devolver-ao-cadastro`: zerar também os novos campos.
5. UI `PropostaAnalise.tsx` / `PropostaApprovalStepper.tsx`: dois botões, gating de visibilidade.
6. Hook `usePropostasPendentes.ts`: select inclui `documentos_aprovados_em` (sem mudar filtro de saída — continua `cadastro_aprovado=true`).
7. Memórias atualizadas.

Nada disso afeta troca de titularidade, sub-FIPE completa ou presencial técnica — esses fluxos seguem com aprovação única, como já é canônico.

Aprovar para eu implementar (entro em build mode e executo na ordem 1-7).
