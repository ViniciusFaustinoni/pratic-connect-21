
# Corrigir Valor e Link na Mensagem de Pagamento da Cota

## Problemas Identificados

### Erro 1: Valor R$ 750,00 (errado)
O sinistro SIN-20260216-0006 ainda tem `valor_cota_participacao = 750.00` no banco. O fix no `aprovar-sinistro` (adicionar `id` do veiculo ao select) ja foi deployado, mas este sinistro foi aprovado ANTES do deploy. O fallback no `autentique-webhook` tambem ja foi deployado, mas o webhook tambem disparou antes.

**Acao**: Os fixes ja estao em producao para novos sinistros. Para o sinistro atual, sera necessario recalcular e corrigir manualmente o valor via SQL.

### Erro 2: Link do Asaas em vez do nosso link publico
No `autentique-webhook`, a busca pelo token do link filtra por `status = 'ativo'` (linha 675). Porem, o link deste sinistro tem status `completado` (o associado ja passou pelas 3 etapas do formulario). Resultado: query retorna vazio e o codigo cai no fallback que usa o link direto do Asaas.

## Solucao

### 1. Corrigir query do link no `autentique-webhook`

**Arquivo:** `supabase/functions/autentique-webhook/index.ts`

Alterar a busca do link para aceitar status `ativo` OU `completado`:
- De: `.eq("status", "ativo")`
- Para: `.in("status", ["ativo", "completado"])`

Isso garante que o token do nosso link publico seja encontrado mesmo apos o associado ter completado as etapas anteriores.

### 2. Mesma correcao no `retroativo-pagamento-termo`

**Arquivo:** `supabase/functions/retroativo-pagamento-termo/index.ts`

Aplicar a mesma correcao na busca do link (linha 131):
- De: `.eq("status", "ativo")`
- Para: `.in("status", ["ativo", "completado"])`

### 3. Correcao manual do sinistro atual

Executar SQL para corrigir o valor da cota do sinistro SIN-20260216-0006 com o valor correto (sera calculado a partir do FIPE do veiculo e plano do associado).

## Detalhes Tecnicos

### Dados atuais do sinistro
- `valor_cota_participacao`: R$ 750,00 (errado)
- Link status: `completado` (token: `38a52b5b-...`)
- Cobranca Asaas: `pay_05fj73tzuqbl3u8f` (ja criada com valor errado)

### Fluxo corrigido
Quando o `autentique-webhook` buscar o link, ele encontrara o token do link `completado` e montara a URL `https://pratic-connect-21.lovable.app/evento/{token}` em vez do link direto do Asaas.

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/autentique-webhook/index.ts` | Buscar link com status `ativo` OU `completado` |
| `supabase/functions/retroativo-pagamento-termo/index.ts` | Mesma correcao no filtro de status do link |
