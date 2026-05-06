
## Contexto

A funcionalidade já existe e funciona ponta a ponta:

- **Tabelas**: `cobranca_csv_lotes` (lote) + `cobranca_csv_boletos` (boletos com `valor`, `linha_digitavel`, `status`).
- **Edge function `disparar-cobranca-csv-meta`**: no 1º chunk cria o lote novo, lê o lote `ativo` anterior, marca como `recuperado` os boletos cuja `linha_digitavel` sumiu da nova lista, marca o lote anterior como `substituido` e dispara WhatsApp só para os novos.
- **Aba Recuperados** (`/financeiro/cobrancas/recuperados`): KPIs (valor recuperado, qtd, associados únicos, ticket médio), filtro por mês, busca, exportação CSV, histórico de lotes.
- **Preview do import** mostra valor total e, no fim, alerta com qtd e valor recuperados.

Revisando o código encontrei 3 problemas que precisam ser corrigidos.

## Problemas encontrados

### 1. Race condition na criação do lote (CRÍTICO)

Em `disparar-cobranca-csv-meta` (linha 105-132):
- INSERT do novo lote já com `status='ativo'`.
- Em seguida busca o lote anterior `ativo` com `.neq('id', loteId)`.

Isso funciona quando há um único import. Mas se duas importações forem disparadas em paralelo (ou se o mesmo CSV for reenviado por engano antes do primeiro terminar), ambas verão o lote uma da outra como "anterior" e podem reconciliar entre si, marcando boletos válidos como recuperados.

**Correção**: criar o novo lote já em `status='processando'` e só promovê-lo a `ativo` no último chunk (`is_last_chunk=true`). A busca do lote anterior passa a filtrar `.eq('status','ativo')`, garantindo que só lotes finalizados são considerados.

### 2. Reconciliação por chave frágil (IMPORTANTE)

Hoje a reconciliação compara `linha_digitavel` normalizada (só dígitos). Funciona, mas tem dois problemas:

- Se o SGA reemitir o mesmo boleto com nova linha digitável (ex: 2ª via com novo vencimento), o sistema vai marcar o original como "recuperado" mesmo quando o associado **não pagou** — só foi reemitido.
- Se a mesma matrícula sumir totalmente da nova lista (associado pagou tudo OU foi cancelado OU mudou de plano), tudo vira "recuperado" — pode inflar o KPI.

**Correção**: 
- Manter `linha_digitavel` como chave primária de reconciliação (é o que o usuário pediu).
- Adicionar coluna `motivo_recuperacao` em `cobranca_csv_boletos` para classificar: `'ausente_na_nova_lista'` (default) vs futuras categorias.
- Adicionar guarda: se o associado (matrícula) **continuar** na nova lista mas com boleto diferente, marcar com motivo `'reemitido'` em vez de contar como recuperado nos KPIs. A query da aba Recuperados passa a filtrar `motivo_recuperacao = 'ausente_na_nova_lista'` por padrão, com toggle para mostrar reemissões.

### 3. `total_boletos` do lote conta mensagens, não boletos (BUG VISUAL)

Em `RecuperadosPage.tsx` o histórico de lotes mostra `total_boletos`, mas a edge function grava em `total_boletos` o valor de `body.todas_linhas_digitaveis.length` que é a contagem total da remessa — correto.
Porém `total_enviados` é incrementado pelo número de **mensagens WhatsApp enviadas com sucesso** (1 por telefone), não pelo número de boletos. Como um associado com 2 telefones gera 2 envios, `total_enviados` pode ficar **maior** que `total_associados`, o que confunde quem lê.

**Correção**: renomear contadores no schema/UI para deixar claro:
- `total_mensagens_enviadas` (1 por telefone) — o que é hoje.
- `total_associados_atingidos` (1 por matrícula com pelo menos 1 envio ok) — novo.
A UI do histórico passa a mostrar **Associados / Boletos / Mensagens enviadas**, não mistura.

## Mudanças

### Migration
- `cobranca_csv_boletos`: adicionar `motivo_recuperacao text` (nullable; preenchido junto com `status='recuperado'`).
- `cobranca_csv_lotes`: adicionar `total_associados_atingidos integer default 0`. Adicionar valor `'processando'` permitido no `status`.

### Edge function `disparar-cobranca-csv-meta`
- 1º chunk: insere lote com `status='processando'` (não `ativo`).
- Reconciliação: na busca do lote anterior, filtrar `status='ativo'` (não captura lotes em processamento).
- Ao classificar recuperados, separar por matrícula: se a matrícula está na nova `Set<matricula>`, gravar `motivo_recuperacao='reemitido'`; senão `'ausente_na_nova_lista'`.
- Após cada chunk, manter contagem `Set<matricula>` de associados com pelo menos 1 ok; somar em `total_associados_atingidos` ao final.
- No último chunk (`is_last_chunk=true`): promover lote para `status='ativo'`. Se houve `cancelarRef` no cliente, o servidor não recebe esse último chunk — adicionar fallback: lote fica em `processando` por mais de 30 min é elegível para limpeza manual (só documentar, não automatizar).

### Frontend
- `RecuperadosPage.tsx`:
  - Filtrar `motivo_recuperacao = 'ausente_na_nova_lista'` por padrão.
  - Adicionar toggle "Incluir reemissões" para somar os `'reemitido'` (com badge cinza diferenciando).
  - Histórico de lotes: trocar coluna "Enviados" por **"Associados atingidos"** + **"Mensagens enviadas"** lado a lado.
- `ImportarCobrancaCsv.tsx`:
  - Antes de disparar, fazer um preview de reconciliação client-side (lendo via Supabase o último lote `ativo`) e exibir: "X boletos da lista anterior NÃO estão nesta nova → serão marcados como recuperados (R$ Y) ao confirmar". Hoje só aparece **depois** do envio.

### Sem mudança
- Tabelas, RLS, parser e extração de valor estão corretos.
- Lógica de telefones (até 2 celulares por associado) está correta.
- Template Meta `cobranca_inadimplencia_pratic` já submetido — sem ação.

## Fora de escopo

Não vou tocar no fluxo de envio Meta (template, idempotência, retry) — está estável.
Não vou criar gráficos/relatórios novos — só corrigir o existente.
