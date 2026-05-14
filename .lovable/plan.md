## Contexto

Hoje a área `Financeiro › Cobranças › Régua › Emissão de Cobranças` tem:
- Sub-aba **Fechamento Mensal** (depende de `fechamentos_mensais` aprovado — fluxo antigo).
- Sub-aba **Importar CSV (SGA)** que apenas dispara WhatsApp via template Meta (`disparar-cobranca-csv-meta`) e grava em `cobranca_csv_lotes/boletos` — não vincula a `associados`/`veiculos` e não popula `cobrancas` ou `asaas_cobrancas`.
- Aba **Recuperados** e botão **Sincronizar Financeiro (Hinova)** ainda visíveis em `Faturas`.

A nova diretriz é: **CSV importado vira a fonte de verdade das cobranças**, com vínculo automático aos associados/veículos das duas bases (nova `associados/veiculos` + bridge legado), e a Régua/Emissão em massa passa a operar sobre essas cobranças importadas.

---

## 1. Esconder UI legada

| Onde | O que esconder |
|---|---|
| `src/pages/financeiro/CobrancasLayout.tsx` | Aba **Recuperados** (manter rota viva, mas sem trigger no menu) |
| `src/pages/financeiro/CobrancasList.tsx` (linha 772) | Botão **Sincronizar Financeiro** (`SgaBackfillFinanceiroDialog`) |
| `src/pages/financeiro/EmissaoCobrancas.tsx` (default export) | Sub-aba **Fechamento Mensal**; deixa só "Importar CSV" como conteúdo único, removendo o `Tabs` (ou mantendo o componente único) |

Sem mudanças em rota / RLS — só esconder.

---

## 2–6. Reformular o fluxo "Importar CSV" como pipeline canônico de cobranças

### Etapa A — Parser mais permissivo (`src/lib/cobranca/parseCsvInadimplentes.ts`)

- Aceitar **todos os tipos** de boleto/cobrança e **qualquer status** (não bloquear por adimplência ou ausência de telefone).
- Tornar opcionais: `Telefone Celular`, `Telefone`, `Placas`. Obrigatórios reais ficam só em `Nome` + `Matrícula` + (`Codigo de Barras` **ou** `Valor` **ou** `Data Vencimento`).
- Adicionar reconhecimento opcional de colunas: `cpf`, `cnpj`, `valor`, `tipo` (mensalidade, taxa, adesão, etc.), `competencia`, `status_pagamento`.
- Renomear `parseCsvInadimplentes` → `parseCsvCobrancas` (mantendo alias para não quebrar usos).

### Etapa B — Vínculo automático (server-side, edge function nova)

Criar edge `importar-cobrancas-csv` (substitui o disparo direto pelo Meta como "primeiro passo"):

1. Recebe um **chunk** com `linhas[]` parseadas + `lote_id?` + `is_first/is_last`.
2. Para cada linha, tenta vincular **na ordem**:
   - `cobrancas.matricula_sga / associados.matricula_sga` (canônico).
   - `associados.cpf` (quando coluna CPF presente).
   - `veiculos.placa` (quando placa presente).
   - **Bridge legado** (base antiga): tabela já existente mapeando matrícula antiga → associado novo (verificar se há `legacy_associado_map` / `sga_associado_id`; se não houver, usar `associados.codigo_legado`/equivalente — confirmar coluna no schema e usar `maybeSingle`).
3. Grava cada linha em `cobranca_csv_boletos` com novos campos:
   - `associado_id uuid null` (FK match)
   - `veiculo_id uuid null` (FK match)
   - `match_origem text` (`matricula | cpf | placa | legacy | sem_match`)
   - `tipo text`, `valor numeric`, `data_vencimento date`, `status_origem text`
4. Retorna contadores agregados do chunk (matched_associado, matched_veiculo, sem_match, valor_total, duplicatas).

> Nada é gravado em `cobrancas`/`asaas_cobrancas` ainda. O `cobranca_csv_boletos` vira a tabela canônica de "cobranças importadas" (já é a estrutura natural disso).

### Etapa C — UI nova de import (`ImportarCobrancaCsv.tsx`)

Substituir as etapas atuais por:

1. **Upload / Colar** (mantém UX atual; tira o título "Inadimplentes/SGA").
2. **Preview com KPIs de match** (client + chamada server "dry-run"):
   - Boletos parseados, Associados únicos, **Match associado**, **Match veículo**, **Sem match**, **Duplicatas**, **Valor total**.
   - Cards com cor: verde (match), amarelo (match parcial — só matrícula), vermelho (sem match).
   - Tabela de pré-visualização com badge por linha do tipo de match.
   - Botão **"Salvar X cobranças"** (cor primária) e **"Trocar arquivo"**.
3. **Gravação em lote** (substitui o `disparar-cobranca-csv-meta` na primeira fase):
   - Frontend faz chunks de **500 linhas** chamando `importar-cobrancas-csv` em sequência, com barra de progresso (`atual/total`, `matched`, `sem_match`).
   - `is_first_chunk` cria `cobranca_csv_lotes` com `status='importando'`.
   - `is_last_chunk` fecha o lote (`status='ativo'`, totais consolidados).
   - Permite arquivos grandes sem timeout.
4. **Concluído**: mostra resumo + dois CTAs:
   - "Ver na Régua de Cobrança" → `/financeiro/cobrancas/regua` filtrado por `lote_id`.
   - "Disparar WhatsApp em massa" (passo 6 abaixo).

### Etapa D — Régua e disparo em massa consomem o lote

- A Régua existente (`/financeiro/cobrancas/regua`) e o card "Emissão de Cobranças" passam a **listar `cobranca_csv_boletos` do lote ativo**, agrupados por associado, com filtros (com/sem WhatsApp, com/sem match, tipo, vencimento).
- Botão **"Disparar via WhatsApp (template Meta)"** mantém a edge `disparar-cobranca-csv-meta` (já existe), mas agora opera **apenas sobre boletos já salvos** (`lote_id`), sem reparse no cliente.
- A reconciliação "recuperados" continua acontecendo automaticamente no servidor ao gravar um novo lote (lógica já existe em `cobranca_csv_boletos.recuperado_em` — preservar).

---

## Migração de schema

```sql
ALTER TABLE public.cobranca_csv_boletos
  ADD COLUMN IF NOT EXISTS associado_id uuid REFERENCES public.associados(id),
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id),
  ADD COLUMN IF NOT EXISTS match_origem text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS status_origem text;

CREATE INDEX IF NOT EXISTS idx_csv_boletos_associado ON public.cobranca_csv_boletos(associado_id);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_veiculo  ON public.cobranca_csv_boletos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_lote     ON public.cobranca_csv_boletos(lote_id);
```

Triggers de RLS existentes ficam como estão (lote/boletos já têm policies próprias — só conferir se admin/financeiro pode SELECT/INSERT).

---

## Arquivos tocados

```text
src/pages/financeiro/CobrancasLayout.tsx          (esconder aba Recuperados)
src/pages/financeiro/CobrancasList.tsx            (esconder botão Sincronizar Financeiro)
src/pages/financeiro/EmissaoCobrancas.tsx         (remover sub-aba Fechamento, manter só CSV)
src/lib/cobranca/parseCsvInadimplentes.ts         (parser permissivo + colunas opcionais)
src/components/financeiro/ImportarCobrancaCsv.tsx (preview match + gravação em lote)
src/pages/cobranca/ReguaCobranca.tsx              (consumir lote ativo)
supabase/functions/importar-cobrancas-csv/        (NOVA edge: vincula + grava em chunks)
supabase/migrations/<timestamp>_csv_match.sql     (colunas associado_id/veiculo_id/match_origem)
```

---

## Perguntas antes de implementar

1. **Bridge legado**: a base antiga vincula via `associados.codigo_legado`, `associados.matricula_sga`, ou outra coluna? Quer que eu detecte automaticamente (qualquer match nas três) ou prefere uma coluna específica?
2. **Tipos aceitos**: o CSV passa o tipo (mensalidade/taxa/adesão), ou devo classificar tudo como `mensalidade` por padrão quando a coluna não existir?
3. **Quando "sem match"**: gravar mesmo assim (badge vermelho, fica disponível para vincular manual depois) ou pular?
4. Confirma esconder **completamente** a sub-aba Fechamento Mensal (e não só ocultar do menu), já que o fluxo CSV vai substituí-la?

Posso aplicar tudo de uma vez assim que essas 4 estiverem decididas.
