## Objetivo

Adicionar uma **aba "Testes de OCR"** dentro de Diretoria → Logs de Auditoria, ao lado da aba "OCR" já existente, permitindo:

1. Subir um documento avulso (PDF/imagem) e rodar a edge function `document-ocr` em modo **sandbox** (sem afetar cotação/associado).
2. Comparar o resultado com **valores esperados** (ground truth) digitados pelo testador.
3. Anotar o resultado (aprovado / falso positivo / etc.) e salvar como **caso de teste** que vai enriquecer o aprendizado do OCR.
4. Re-executar em lote os casos salvos (regression suite) sempre que o prompt/modelo mudar.
5. Ver métricas históricas de acurácia por tipo de documento e por campo.

## Diagnóstico do estado atual

- Edge function `supabase/functions/document-ocr/index.ts` já recebe `{ url, tipoEsperado, cpfEsperado, nomeEsperado, extrairDados, cotacaoId, associadoId }` e grava em `ocr_execution_logs` (33 colunas, incluindo `cpf_fonte`, `cpf_candidatos`, `cpf_contexto`, `dados_extraidos`).
- Tela `src/pages/diretoria/LogsAuditoria.tsx` tem a aba "OCR" renderizando `<OcrLogsTab />`. Falta uma aba irmã para testes.
- Não há tabela para armazenar casos de teste nem para anotações de qualidade.
- Bucket `cotacoes-docs` já existe e é aceito pela edge function como URL pública.

## Mudanças propostas

### 1. Banco — duas tabelas novas (migration)

**`ocr_test_cases`** — biblioteca de casos de teste reutilizáveis:
- `id`, `created_at`, `created_by`
- `nome` (label do caso, ex: "CNH-e Marcus 2026")
- `tipo_esperado` (cnh / crlv / rg / etc.)
- `arquivo_path` (path no bucket `cotacoes-docs/ocr-tests/...`)
- `arquivo_url` (URL pública)
- `mime`, `bytes`
- `expectativas` (jsonb): `{ cpf, nome, rg, dataNascimento, numeroCnh, categoria, validade, placa, chassi, ... }` — campos esperados por tipo
- `observacoes` (text)
- `ativo` (bool, para incluir/excluir do regression run)
- RLS: somente `diretor` e `gestor_cadastro` podem ler/escrever.

**`ocr_test_runs`** — execuções (1 caso → N execuções ao longo do tempo):
- `id`, `created_at`, `executed_by`
- `test_case_id` (fk → `ocr_test_cases`, nullable para testes ad-hoc)
- `ocr_log_id` (fk → `ocr_execution_logs.id`) — link para o log completo
- `provider`, `modelo`, `prompt_version` (text — capturado no momento)
- `latency_ms`
- `dados_extraidos` (jsonb — espelho do que veio)
- `comparacao` (jsonb): por campo, `{ esperado, obtido, match: true|false|null, similaridade: 0..1 }`
- `score_geral` (numeric, 0..1) — % de campos certos
- `veredito` (`aprovado` | `parcial` | `reprovado`)
- `anotacao_humana` (text, opcional — o testador descreve o que falhou)

Função `public.calcular_score_ocr(esperado jsonb, obtido jsonb)` para padronizar o cálculo (normaliza CPF/data/string → minúsculas, remove pontuação).

### 2. Edge function — modificações mínimas no `document-ocr`

- Aceitar dois novos campos opcionais no body: `modoTeste: boolean`, `testCaseId: uuid`.
- Quando `modoTeste === true`:
  - Não exige `cotacaoId`/`associadoId`.
  - Após gravar `ocr_execution_logs`, retorna `ocrLogId` no payload (já existe internamente, basta expor).
- Sem alteração na lógica de extração — usa exatamente o mesmo caminho da produção, garantindo paridade.

### 3. UI — nova aba `OcrTestesTab` em `LogsAuditoria.tsx`

Estrutura em 3 painéis dentro da aba:

**Painel A — Executar teste novo (ad-hoc ou caso salvo)**
- Dropdown: "Caso salvo" (lista `ocr_test_cases`) **ou** "Novo upload".
- Se novo upload: drag-and-drop → faz upload para `cotacoes-docs/ocr-tests/{uuid}.{ext}` → preenche URL.
- Campo "Tipo esperado" (select igual ao da produção).
- Bloco "Valores esperados" — formulário dinâmico conforme o tipo (CPF, nome, RG, nascimento, CNH, categoria, validade para CNH; placa, chassi, renavam, marca/modelo para CRLV; etc.).
- Botão **"Rodar OCR"** → chama `document-ocr` com `modoTeste:true` → recebe `ocrLogId` + `dados_extraidos`.
- Renderiza imediatamente a comparação lado-a-lado: **Esperado | Obtido | ✓/✗** por campo + score geral.
- Botões: **"Salvar como caso de teste"** (cria/atualiza `ocr_test_cases`), **"Anotar veredito"** (popup com `aprovado/parcial/reprovado` + texto livre → grava `ocr_test_runs`).

**Painel B — Biblioteca de casos**
- Tabela: nome, tipo, último score, último veredito, nº de execuções, data da última run.
- Ações por linha: ver histórico, re-executar, editar expectativas, desativar.
- Botão **"Re-executar todos os ativos"** → fila sequencial (com pequeno delay) que dispara cada caso e mostra progresso. Resultado consolidado: x/y aprovados, regressões em relação à última run anterior (campos que passavam e agora falham — destaque vermelho).

**Painel C — Métricas de aprendizado**
- Cards: acurácia média por tipo (CNH 87%, CRLV 99%, ...), campos com pior taxa (ex: "cpf em CNH-e: 42%"), evolução semanal (gráfico simples linha).
- Top 10 falhas recentes com link para o `ocr_log_id` e botão "Adicionar à biblioteca de testes" (cria `ocr_test_case` pré-preenchido a partir do log).

### 4. Storage

- Subpasta `ocr-tests/` dentro do bucket existente `cotacoes-docs` (já aceito pela edge function).
- Policy: leitura pública (igual ao bucket atual), escrita restrita a `diretor`/`gestor_cadastro`.

### 5. Enriquecimento dos logs de produção

Aproveitando a migration:
- Adicionar coluna `ocr_execution_logs.dados_esperados` (jsonb, nullable) — quando uma cotação real tem `cpfEsperado`/`nomeEsperado`, gravar o objeto completo aqui para futura análise comparativa (hoje só vai para `motivo`/`erro`).
- Adicionar coluna `ocr_execution_logs.score_campos` (jsonb, nullable) — calculado pela função quando há esperado, marcando quais campos bateram.
- Painel C consome essas colunas em produção também, não só na sandbox.

## Fluxo de uso típico (refinamento iterativo)

1. Usuário recebe ticket: "OCR não leu CPF do CNH-e do Marcus".
2. Vai em Diretoria → Logs OCR → aba Testes → "Adicionar à biblioteca" a partir do log que falhou.
3. Edita o caso preenchendo o CPF correto (ground truth).
4. AI dev altera o prompt/regex da edge function.
5. Volta na aba Testes e clica "Re-executar todos os ativos" — vê em segundos quantos casos passaram a funcionar e se algum regrediu.
6. Casos com `veredito='reprovado'` recorrentes viram backlog de melhoria do prompt.

## Arquivos / objetos a criar

- Migration: `ocr_test_cases`, `ocr_test_runs`, função `calcular_score_ocr`, colunas `dados_esperados` e `score_campos` em `ocr_execution_logs`, RLS, subpasta no bucket.
- `supabase/functions/document-ocr/index.ts` — pequeno trecho para `modoTeste` + retorno `ocrLogId`.
- `src/components/diretoria/OcrTestesTab.tsx` (novo, ~500 linhas — UI completa).
- `src/components/diretoria/ocr-testes/ExpectativasForm.tsx` (formulário dinâmico por tipo).
- `src/components/diretoria/ocr-testes/ResultadoComparacao.tsx` (tabela esperado/obtido).
- `src/hooks/useOcrTestes.ts` (queries e mutations).
- `src/pages/diretoria/LogsAuditoria.tsx` — adicionar nova `TabsTrigger` "Testes OCR" + render do componente.

## Fora de escopo (intencionalmente)

- Não vamos treinar/fine-tunar modelo (Lovable AI Gateway é multi-modelo gerenciado).
- Não vamos versionar prompt automaticamente — a coluna `prompt_version` é text livre que o dev preenche na edge function antes do deploy.
- Não criamos paywall/bypass — tudo respeita RLS de `diretor`/`gestor_cadastro`.

## Resultado esperado

- Loop fechado de QA do OCR: log que falha → caso de teste → ajuste de prompt → regression run → confirma ganho sem regressão.
- Visibilidade de quais campos/tipos têm pior acurácia para priorizar melhorias.
- Logs de produção também passam a registrar comparação esperado-vs-obtido quando há ground truth disponível.
