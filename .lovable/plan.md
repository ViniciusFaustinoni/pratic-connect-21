
# Plano: Correção do Sistema de Atribuição Automática de Tarefas

## Resumo do Problema

Foram identificados **4 contratos pagos de autovistoria sem instalações criadas**:

| Cliente | Cotação ID | Contrato ID | Status |
|---------|------------|-------------|--------|
| MARCOS VINICIUS DATIVO MACHADO | 028562d5-... | ebc84738-... | adesao_paga, sem instalação |
| THALES HENRIQUE SOILO | 16403742-... | e6c35a08-... | adesao_paga, sem instalação |
| LEANDRO DA SILVA FERREIRA | 2dec2d91-... | 47aec80e-... | adesao_paga, sem instalação |
| MARCUS VINICIUS FAUSTINONI | c34d6e95-... | 5309c4e9-... | adesao_paga, sem instalação |

## Causa Raiz Identificada

O webhook ASAAS registrou o pagamento, marcou `adesao_paga = true`, mas a chamada para `criar-instalacao-pos-pagamento` falhou silenciosamente ou não foi executada. Possíveis causas:

1. **Timeout na chamada HTTP interna** - o webhook usa `fetch()` para chamar outra edge function, que pode ter excedido o tempo limite
2. **Erro não capturado** - o try/catch permite que erros passem sem bloquear o fluxo principal, mas também sem retry

---

## Parte 1: Correção Imediata - Criar Instalações Retroativas

### Script SQL para criar instalações manualmente

Executar via SQL para criar as 4 instalações pendentes:

```text
+------------------+     +------------------+     +------------------+
|   asaas-webhook  | --> | criar-instalacao | --> |   instalacoes    |
|  (pagamento OK)  |     | -pos-pagamento   |     |   (registro)     |
+------------------+     +------------------+     +------------------+
         |                       X
         v                   (FALHOU)
  adesao_paga = true
```

### Ação: Criar instalações via edge function

Chamar a edge function `criar-instalacao-pos-pagamento` para cada cotação manualmente.

---

## Parte 2: Correção do Mapeamento de Coordenadas

### Problema no código atual

```text
Arquivo: supabase/functions/criar-instalacao-pos-pagamento/index.ts
Linhas: 216-217
```

O código usa `cotacao.vistoria_endereco_latitude` mesmo quando o tipo de vistoria é autovistoria (que usa campos `vistoria_completa_*`). Isso funciona "acidentalmente" porque o frontend salva coordenadas em `vistoria_endereco_latitude` para todos os tipos.

### Correção proposta

Adicionar colunas específicas para coordenadas de vistoria completa:
- `vistoria_completa_endereco_latitude`
- `vistoria_completa_endereco_longitude`

E corrigir o mapeamento no código para usar as colunas corretas.

**Alternativa (mais simples)**: Manter o comportamento atual já que o frontend já salva coordenadas no campo `vistoria_endereco_latitude` para todos os tipos. Apenas documentar essa dependência.

---

## Parte 3: Melhorar Resiliência do Webhook

### Problema

O webhook ASAAS processa pagamentos e chama `criar-instalacao-pos-pagamento` internamente, mas erros são apenas logados e ignorados:

```typescript
// Linha 556-558
} catch (instalacaoErr) {
  console.error('[asaas-webhook] Erro ao criar instalação pós-pagamento:', instalacaoErr);
  // Não bloqueia o fluxo principal se falhar
}
```

### Correções propostas

1. **Adicionar retry com backoff** - tentar novamente após falha
2. **Registrar falhas em tabela de auditoria** - para permitir reprocessamento manual
3. **Criar cron job de reconciliação** - verificar periodicamente contratos pagos sem instalação

---

## Detalhamento Técnico

### Alteração 1: Edge Function `criar-instalacao-pos-pagamento`

**Arquivo**: `supabase/functions/criar-instalacao-pos-pagamento/index.ts`

**Mudanças**:

1. Adicionar suporte explícito para `tipo_vistoria = 'autovistoria'`:

```typescript
// Linha 188-222 - Adicionar tratamento para autovistoria
if (tipoVistoria === 'agendada') {
  // Usar campos vistoria_* (vistoria presencial simples)
  // ... código existente ...
} else if (tipoVistoria === 'autovistoria') {
  // AUTOVISTORIA: Usar campos vistoria_completa_* 
  // A instalação é para fazer a vistoria COMPLETA após autovistoria aprovada
  dataAgendada = cotacao.vistoria_completa_data_agendada;
  horarioAgendado = cotacao.vistoria_completa_horario_agendado;
  endereco = {
    cep: cotacao.vistoria_completa_endereco_cep || '',
    logradouro: cotacao.vistoria_completa_endereco_logradouro || '',
    numero: cotacao.vistoria_completa_endereco_numero || '',
    bairro: cotacao.vistoria_completa_endereco_bairro || '',
    cidade: cotacao.vistoria_completa_endereco_cidade || '',
    estado: cotacao.vistoria_completa_endereco_estado || '',
    // Coordenadas estão em vistoria_endereco_* (compartilhado)
    latitude: cotacao.vistoria_endereco_latitude,
    longitude: cotacao.vistoria_endereco_longitude,
  };
  // ... resto do código ...
} else {
  // Fallback para outros tipos futuros
  // ... código existente do else ...
}
```

2. Adicionar logs mais detalhados para debug:

```typescript
console.log(`[CriarInstalacaoPosPagamento] tipo_vistoria: ${tipoVistoria}`);
console.log(`[CriarInstalacaoPosPagamento] dataAgendada: ${dataAgendada}`);
console.log(`[CriarInstalacaoPosPagamento] horarioAgendado: ${horarioAgendado}`);
```

### Alteração 2: Edge Function `asaas-webhook`

**Arquivo**: `supabase/functions/asaas-webhook/index.ts`

**Mudanças**:

1. Adicionar retry para criação de instalação:

```typescript
// Linha 534-560 - Adicionar retry
let tentativas = 0;
const maxTentativas = 3;
let instalacaoCriada = false;

while (!instalacaoCriada && tentativas < maxTentativas) {
  tentativas++;
  try {
    console.log(`[asaas-webhook] Tentativa ${tentativas} de criar instalação...`);
    
    const instalacaoResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/criar-instalacao-pos-pagamento`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cotacaoId: contratoData.cotacao_id })
      }
    );

    const instalacaoResult = await instalacaoResponse.json();
    
    if (instalacaoResult.success) {
      instalacaoCriada = true;
      console.log(`[asaas-webhook] ✓ Instalação criada: ${instalacaoResult.instalacaoId}`);
    } else if (instalacaoResult.error === 'Instalação já existente') {
      instalacaoCriada = true; // Não precisa retentar
    } else {
      console.warn(`[asaas-webhook] Tentativa ${tentativas} falhou: ${instalacaoResult.error}`);
      if (tentativas < maxTentativas) {
        await new Promise(r => setTimeout(r, 1000 * tentativas)); // Backoff
      }
    }
  } catch (instalacaoErr) {
    console.error(`[asaas-webhook] Erro na tentativa ${tentativas}:`, instalacaoErr);
    if (tentativas < maxTentativas) {
      await new Promise(r => setTimeout(r, 1000 * tentativas));
    }
  }
}

// Registrar falha para reprocessamento manual
if (!instalacaoCriada) {
  await supabase.from('instalacoes_pendentes_criacao').insert({
    cotacao_id: contratoData.cotacao_id,
    contrato_id: cobranca.contrato_id,
    motivo: 'Falha após 3 tentativas no webhook ASAAS',
    created_at: new Date().toISOString()
  });
}
```

### Alteração 3: Nova Tabela para Rastreamento

**Migração SQL**:

```sql
CREATE TABLE IF NOT EXISTS instalacoes_pendentes_criacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID REFERENCES cotacoes(id),
  contrato_id UUID REFERENCES contratos(id),
  motivo TEXT,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX idx_instalacoes_pendentes_nao_resolvidas 
ON instalacoes_pendentes_criacao(resolvido) 
WHERE resolvido = false;
```

### Alteração 4: Script de Reconciliação (Cron Job)

Criar edge function `cron-reconciliar-instalacoes`:

```typescript
// Busca contratos pagos sem instalação
const { data: contratosSemInstalacao } = await supabase
  .from('contratos')
  .select(`
    id,
    cotacao_id,
    adesao_paga_em
  `)
  .eq('adesao_paga', true)
  .is('instalacoes.id', null) // LEFT JOIN implícito via RLS
  .order('adesao_paga_em', { ascending: true });

// Para cada um, tentar criar instalação
for (const contrato of contratosSemInstalacao) {
  await fetch(`${SUPABASE_URL}/functions/v1/criar-instalacao-pos-pagamento`, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({ cotacaoId: contrato.cotacao_id })
  });
}
```

---

## Ordem de Implementação

1. **Correção imediata**: Criar as 4 instalações pendentes chamando a edge function manualmente
2. **Deploy**: Atualizar `criar-instalacao-pos-pagamento` com tratamento explícito para autovistoria
3. **Deploy**: Atualizar `asaas-webhook` com retry e logging melhorado
4. **Migração**: Criar tabela de rastreamento
5. **Deploy**: Criar cron job de reconciliação

---

## Validação Pós-Deploy

1. Verificar que as 4 instalações foram criadas
2. Testar novo fluxo de autovistoria end-to-end
3. Verificar logs do webhook para confirmar retry funcionando
4. Confirmar atribuição automática para instalações criadas

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/criar-instalacao-pos-pagamento/index.ts` | Tratamento explícito para `tipo_vistoria = 'autovistoria'` |
| `supabase/functions/asaas-webhook/index.ts` | Adicionar retry com backoff e registro de falhas |
| Nova migração SQL | Criar tabela `instalacoes_pendentes_criacao` |
| `supabase/functions/cron-reconciliar-instalacoes/index.ts` | Novo cron job para reconciliação |
