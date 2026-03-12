
# Auditoria Completa: Templates WhatsApp na Aprovação e em Todo o Sistema

## Diagnóstico Raiz do Problema Relatado

A mensagem errada ("seu pedido de assistência foi confirmado, prestador a caminho...") vem de **3 falhas em cascata**:

```text
Fluxo de Aprovação → 3 WhatsApps tentados:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. criar-instalacao-pos-pagamento → tipo 'instalacao_agendada'
   → Template: assistencia_confirmada ❌ ERRADO (é de assistência 24h, não instalação)
   → Param "data" (2026-03-12) vai no campo "minutos" 
   → ESTE É O QUE CHEGA AO CLIENTE (único que funciona!)

2. notificar-cliente → tipo 'proposta_aprovada_roubo_furto'
   → Template: cadastro_aprovado ❌ NÃO EXISTE NA META
   → WhatsApp FALHA silenciosamente (whatsapp: false)

3. ativar-associado → Template: ativacao_conta_pratic ❌ NÃO EXISTE NA META
   → WhatsApp FALHA silenciosamente
```

**Resultado**: O único WhatsApp que funciona é o errado. Os corretos falham porque referenciam templates que não existem na Meta.

## Templates Aprovados na Meta (disponíveis)

| Template | Corpo | Params |
|----------|-------|--------|
| `boas_vindas_associado` | "Bem-vindo(a) à PraticCar. Cadastro aprovado, veículo {{2}} protegido." | 2: nome, veículo |
| `sinistro_atualizado` | "Atualização no sinistro {{2}}: {{3}}." | 3: nome, ref, msg |
| `tecnico_a_caminho_1` | "Técnico a caminho, contato, endereço, período" | 6 |
| `assistencia_confirmada` | "Assistência confirmada, prestador a caminho, X minutos" | 3 |

## Correções Necessárias

### Correção 1: `notificar-cliente/index.ts` — Fix `instalacao_agendada`

**Antes**: Mapeia para `assistencia_confirmada` (errado — é template de assistência 24h).
**Depois**: Mapear para `sinistro_atualizado` com mensagem apropriada.

```typescript
instalacao_agendada: {
  template_name: 'sinistro_atualizado',
  getParams: () => [
    primeiroNome,
    'instalação',
    `Sua instalação foi agendada para ${(dados?.data as string) || 'em breve'}. Período: ${(dados?.periodo as string) || 'A confirmar'}. Nosso técnico entrará em contato!`,
  ],
},
```

### Correção 2: `notificar-cliente/index.ts` — Fix `cadastro_aprovado`, `proposta_aprovada_*`

**Antes**: Mapeia para `cadastro_aprovado` (template que NÃO EXISTE na Meta).
**Depois**: Mapear para `boas_vindas_associado` (existe, aprovado, 2 params).

```typescript
// Todos os 3 mapeamentos → boas_vindas_associado
cadastro_aprovado / proposta_aprovada_roubo_furto / proposta_aprovada_cobertura_total: {
  template_name: 'boas_vindas_associado',
  getParams: () => [
    primeiroNome,
    `${placa} - ${marca} ${modelo}` || 'seu veículo',
  ],
},
```

### Correção 3: `ativar-associado/index.ts` — Fix `ativacao_conta_pratic`

**Antes**: Usa `ativacao_conta_pratic` (NÃO EXISTE na Meta).
**Depois**: Usar `boas_vindas_associado` (existe, aprovado).

### Correção 4: `notificar-cliente/index.ts` — Fix `tecnico_em_rota` (pendente do plano anterior)

**Antes**: `tecnico_a_caminho` (7 params).
**Depois**: `tecnico_a_caminho_1` (6 params — remover 7º param).

### Correção 5: Outros mapeamentos usando `assistencia_confirmada` indevidamente

O mapping de `assistencia_prestador_acionado` para `assistencia_confirmada` está **CORRETO** (é de fato um acionamento de assistência). Manter.

## Resumo de Arquivos Alterados

1. **`supabase/functions/notificar-cliente/index.ts`** — 4 mapeamentos corrigidos
2. **`supabase/functions/ativar-associado/index.ts`** — template corrigido

Ambas as Edge Functions serão redeployadas automaticamente.
