
# Corrigir: Pagamento da Cota não Atualiza no Sinistro

## Diagnóstico

### O que está acontecendo

O sinistro **SIN-20260220-0012** tem:
- `cota_paga: false` (não atualizado)
- `cobranca_cota_id: 7082f63c-...` apontando para uma cobrança com `status: RECEIVED` no banco
- Ou seja: **o Asaas já confirmou o pagamento, mas o sinistro não foi atualizado**

### Por quê isso aconteceu

A edge function `asaas-webhook` é a responsável por marcar `cota_paga = true` no sinistro. Em **ambiente sandbox**, o Asaas frequentemente não dispara o webhook automaticamente — o pagamento é simulado, mas a notificação não chega. Além disso, a função `asaas-verificar-pagamento` (que faz verificação ativa) foi criada apenas para **cobranças de adesão de contratos** (`contrato_id`), não para **cota de participação de sinistros** (`sinistro_id`).

### Situação atual confirmada via banco de dados

| Campo | Valor |
|---|---|
| `asaas_cobrancas.status` | `RECEIVED` (pago na API do Asaas) |
| `asaas_cobrancas.tipo` | `cota_participacao` |
| `sinistros.cota_paga` | `false` (desatualizado) |
| `sinistros.status` | `aprovado` (deveria avançar para `pecas_em_cotacao`) |

## Solução — 3 partes

### Parte 1: Corrigir o registro atual imediatamente (SQL)

Atualizar o sinistro diretamente via migration SQL já que o pagamento já foi confirmado no banco.

### Parte 2: Nova Edge Function `asaas-verificar-cota-sinistro`

Criar uma edge function específica para verificar ativamente o status da cobrança de cota de participação de um sinistro. Ela receberá `sinistroId`, buscará a cobrança correspondente, consultará a API do Asaas e — se confirmado pago — atualizará o sinistro (`cota_paga = true`, `status = 'pecas_em_cotacao'`) e registrará o histórico.

### Parte 3: Botão "Verificar Pagamento" + Polling automático no frontend

Na tela `SinistroAnalise.tsx`, quando a cota está pendente (`termo_anuencia_assinado && !cota_paga`):
- Adicionar botão **"Verificar Pagamento"** que chama a nova edge function e atualiza a interface imediatamente
- Ativar **polling automático a cada 15 segundos** enquanto a cota estiver pendente (similar ao polling já existente para assinatura do termo)

## Detalhes Técnicos

### SQL Imediato (Migration)

```sql
-- Corrigir sinistro atual: cota já paga no Asaas mas não atualizada no banco
UPDATE sinistros
SET 
  cota_paga = true,
  cota_paga_em = NOW(),
  status = 'pecas_em_cotacao',
  updated_at = NOW()
WHERE id = 'a2b1e9b3-6ece-4384-92a1-c6c93eab0f4f'
  AND cota_paga = false;

INSERT INTO sinistro_historico (sinistro_id, status_anterior, status_novo, observacao)
VALUES (
  'a2b1e9b3-6ece-4384-92a1-c6c93eab0f4f',
  'aprovado',
  'pecas_em_cotacao',
  'Pagamento da cota de coparticipação confirmado retroativamente — cobrança RECEIVED no Asaas (pay_qrs9x09ngxnr2xlg)'
);
```

### Nova Edge Function: `asaas-verificar-cota-sinistro`

A função receberá `sinistroId`, buscará a cobrança de cota do sinistro, consultará o Asaas e atualizará se necessário:

```typescript
// Entrada: { sinistroId: string }
// 1. Buscar cobrança de cota do sinistro
const { data: sinistro } = await supabase.from('sinistros')
  .select('id, cota_paga, cobranca_cota_id, status')
  .eq('id', sinistroId).single();

// 2. Se já pago, retornar imediatamente
if (sinistro.cota_paga) return { pago: true, status: 'ALREADY_PAID' };

// 3. Buscar cobrança
const { data: cobranca } = await supabase.from('asaas_cobrancas')
  .select('id, asaas_id, status').eq('id', sinistro.cobranca_cota_id).single();

// 4. Consultar API do Asaas
const asaasData = await fetch(`${ASAAS_BASE_URL}/payments/${cobranca.asaas_id}`, ...);

// 5. Se pago: atualizar sinistro + histórico
if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasData.status)) {
  await supabase.from('sinistros').update({
    cota_paga: true,
    cota_paga_em: new Date().toISOString(),
    status: 'pecas_em_cotacao',
  }).eq('id', sinistroId);
  // ... registrar histórico
}
```

### Alterações no Frontend (`SinistroAnalise.tsx`)

**Novo estado:**
```typescript
const [verificandoCota, setVerificandoCota] = useState(false);
```

**Polling automático** (análogo ao polling de assinatura):
```typescript
useEffect(() => {
  const cotaPendente = sinistro?.termo_anuencia_assinado && !sinistro?.cota_paga 
    && sinistro?.cobranca_cota_id;
  if (!cotaPendente) return;
  
  const interval = setInterval(() => {
    // Verificar silenciosamente a cada 15s
    supabase.functions.invoke('asaas-verificar-cota-sinistro', {
      body: { sinistroId: sinistro.id }
    }).then(({ data }) => {
      if (data?.pago) {
        queryClient.invalidateQueries({ queryKey: ['sinistro-analise', id] });
      }
    });
  }, 15000);
  
  return () => clearInterval(interval);
}, [sinistro?.cota_paga, sinistro?.termo_anuencia_assinado, sinistro?.cobranca_cota_id]);
```

**Botão "Verificar Pagamento"** (ao lado do "Reenviar Link"):
```tsx
{sinistro.cobranca_cota_id && (
  <Button
    variant="outline"
    className="w-full border-green-300 text-green-700 hover:bg-green-50"
    onClick={handleVerificarCota}
    disabled={verificandoCota}
  >
    {verificandoCota 
      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
      : <CheckCircle className="h-4 w-4 mr-2" />}
    Verificar Pagamento
  </Button>
)}
```

## Arquivos a Alterar

| Arquivo | Alteração |
|---|---|
| Migration SQL | Corrigir imediatamente o sinistro atual (`cota_paga = true`, `status = pecas_em_cotacao`) |
| `supabase/functions/asaas-verificar-cota-sinistro/index.ts` | Nova edge function para verificação ativa de cota de sinistro |
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar: estado `verificandoCota`, função `handleVerificarCota`, polling automático a cada 15s, botão "Verificar Pagamento" |

## Fluxo Completo Corrigido

```text
Associado paga a cota via PIX
        ↓
Asaas registra pagamento (RECEIVED)
        ↓
[Webhook ideal] OU [Verificação ativa a cada 15s / botão manual]
        ↓
sinistros.cota_paga = true
sinistros.status = 'pecas_em_cotacao'
        ↓
Interface atualiza automaticamente (React Query invalidação)
Badge "Pag. Cota Pendente" desaparece
```

## Garantias

- A correção SQL já resolve o caso atual imediatamente
- O polling automático garante que casos futuros (sandbox ou produção com webhook lento) sejam resolvidos em até 15 segundos após o pagamento
- O botão manual permite que o analista force a verificação a qualquer momento
- A edge function é idempotente: se já pago, retorna imediatamente sem duplicar atualizações
