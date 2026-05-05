
## Objetivo

Persistir cada importação CSV de inadimplentes como um **lote**, e ao receber uma nova lista, comparar contra a anterior para:
- Identificar quem **pagou** (saiu da lista) → marcar como **Recuperado** + somar o valor.
- Disparar WhatsApp **apenas para os novos** (que estão na nova lista mas não na anterior) **+ os ainda inadimplentes que continuam**.
- Exibir todos os recuperados em uma **nova aba "Recuperados"** dentro de Financeiro › Cobranças, com KPIs (qtd recuperados, valor total recuperado, ticket médio) e filtros por período.

---

## 1. Banco de dados (migration)

**Tabela `cobranca_csv_lotes`** — uma linha por importação:
- `nome_arquivo`, `total_boletos`, `total_associados`, `valor_total`, `total_enviados`
- `status`: `ativo` (lote vigente) | `substituido` (foi superado por um lote mais novo)
- `criado_por`, `observacao`

**Tabela `cobranca_csv_boletos`** — uma linha por boleto importado:
- `lote_id`, `matricula`, `nome`, `placa`, `vencimento`, `linha_digitavel`, `valor`, `telefones` (jsonb)
- `status`: `pendente_envio` | `enviado` | `recuperado`
- `enviado_em`, `recuperado_em`, `recuperado_no_lote_id`

Índices em `lote_id`, `matricula`, `linha_digitavel`, `status` e `(status, recuperado_em)`.
RLS via `has_permission(auth.uid(), 'cobrancas.disparar_lote')` para INSERT/UPDATE e `cobrancas.ver` adicional para SELECT.

---

## 2. Extração de valor do boleto

Adicionar em `parseCsvInadimplentes.ts` a função `extrairValorBoleto(linhaDigitavel)`:
- Linha digitável padrão Febraban (47 dígitos, boleto bancário): valor está nas posições 38–47 (10 dígitos, 2 últimos = centavos).
- Código de barras de arrecadação (48 dígitos, começa com 8): valor nas posições 5–15.
- Retorna `0` quando não consegue extrair (caso raro de linha não-padrão); o valor pode ser editado manualmente depois.

Soma agregada por associado vai para o preview.

---

## 3. Fluxo de importação revisado

Quando o usuário clica **"Iniciar envio em massa"**, a edge function `disparar-cobranca-csv-meta` passa a:

1. **Criar o lote novo** (`cobranca_csv_lotes` com `status='ativo'`).
2. **Buscar o último lote ativo anterior** (se existir) e seus boletos pendentes/enviados.
3. **Reconciliar**:
   - Para cada boleto do **lote anterior** que **não aparece** na nova lista (matching por `matricula` + `linha_digitavel`): marcar como `status='recuperado'`, `recuperado_em=now()`, `recuperado_no_lote_id=<novo lote>`.
   - Marcar o lote anterior como `status='substituido'`.
4. **Inserir todos os boletos do novo lote** com `status='pendente_envio'`.
5. **Disparar WhatsApp** apenas para os destinatários do novo lote (já é o comportamento atual). Após cada envio bem-sucedido, marcar o boleto como `status='enviado'` e `enviado_em=now()`.

Resultado mostrado ao usuário no final:
- X mensagens enviadas
- Y boletos **recuperados** (do lote anterior) totalizando R$ Z

---

## 4. Nova aba "Recuperados" em Cobranças

Adicionar 3ª aba em `CobrancasLayout.tsx`: **Faturas | Régua | Recuperados** (rota `/financeiro/cobrancas/recuperados`).

Nova página `RecuperadosPage.tsx`:
- **KPIs no topo**: Total Recuperado (R$), Qtd. Boletos Recuperados, Qtd. Associados Únicos, Ticket Médio.
- **Filtros**: período (mês/ano com default "mês atual"), busca por nome/matrícula.
- **Tabela**: Associado | Matrícula | Placa | Linha Digitável | Valor | Vencimento Original | Recuperado em | Lote Origem.
- **Botão Exportar CSV** dos recuperados do período.
- **Card "Histórico de Lotes"** colapsável: lista todos os lotes (data, arquivo, total enviados, recuperados desse lote, % recuperação).

---

## 5. Atualização da UI de importação

Em `ImportarCobrancaCsv.tsx`, no preview (etapa 2), adicionar:
- KPI **"Valor total da remessa"** (R$ — soma dos valores extraídos).
- Quando há lote anterior ativo, mostrar **alerta informativo**:
  > "Lote anterior detectado (DD/MM, X boletos). Ao confirmar, os boletos que não estiverem nesta nova lista serão marcados como pagos/recuperados."
- Após envio (etapa 4), mostrar bloco **"Recuperados nesta importação"** com qtd + valor total + link para a nova aba.

---

## 6. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/<timestamp>_cobranca_csv_lotes_recuperados.sql` | criar (tabelas + RLS + trigger) |
| `src/lib/cobranca/parseCsvInadimplentes.ts` | adicionar `extrairValorBoleto`, retornar `valor` em cada boleto e `valor_total` no resultado |
| `src/lib/cobranca/parseCsvInadimplentes.test.ts` | testes para extração de valor |
| `supabase/functions/disparar-cobranca-csv-meta/index.ts` | reescrever para criar lote, reconciliar, persistir boletos e marcar enviados |
| `src/components/financeiro/ImportarCobrancaCsv.tsx` | KPI valor + alerta lote anterior + bloco recuperados no resultado |
| `src/pages/financeiro/RecuperadosPage.tsx` | criar (página completa) |
| `src/pages/financeiro/CobrancasLayout.tsx` | adicionar 3ª aba |
| `src/App.tsx` | registrar rota `/financeiro/cobrancas/recuperados` |

---

## 7. Edge cases tratados

- **Mesma linha digitável aparece em 2 lotes** → continua inadimplente, **não** marca como recuperado.
- **Sem lote anterior** (primeira importação) → apenas cria o lote, nenhum recuperado.
- **Mesmo CSV importado 2x seguidas** → 2º lote vira "ativo", 1º vira "substituido" sem recuperados (todos os boletos coincidem).
- **Boleto sem valor extraível** → entra com `valor=0`, conta na aba mas sem somar no total (KPI mostra com asterisco).
- **Valor recuperado** = soma dos `valor` dos boletos do lote anterior que não vieram no novo.

---

## 8. Validação pós-implementação

1. Acessar como diretor (`admin@teste.com`).
2. Importar CSV-A com 5 boletos e disparar.
3. Importar CSV-B sem 2 dos boletos do CSV-A.
4. Verificar:
   - Nova aba "Recuperados" mostra 2 linhas com os valores corretos.
   - KPI "Total Recuperado" bate com a soma.
   - Disparo WhatsApp aconteceu apenas para os boletos do CSV-B.
