
# Plano: Ativação Automática Softruck na Conclusão de Vistoria

## Resumo Executivo

Implementar o fluxo completo de ativação automática do rastreador Softruck quando uma instalação é concluída, garantindo que veículo, chip e dispositivo sejam criados na plataforma Softruck se não existirem.

## Análise do Estado Atual

### O que já existe ✅

| Componente | Status | Localização |
|------------|--------|-------------|
| Edge Function API Softruck | Completa | `supabase/functions/softruck-api/index.ts` |
| Operação criar-device | Implementada | softruck-api linha 447-489 |
| Operação criar-chip | Implementada | softruck-api linha 598-628 |
| Operação buscar-chip | Implementada | softruck-api linha 583-595 |
| Função ativar-dispositivo | Parcial | `supabase/functions/softruck-ativar-dispositivo/index.ts` |
| Secrets configurados | Completos | SOFTRUCK_PUBLIC_KEY, USERNAME, PASSWORD, ENTERPRISE_ID |
| Gatilho no hook | Funcional | `src/hooks/useServicos.ts` linha 942-951 |
| Tabela de logs | Existe | `rastreadores_logs` |

### O que precisa ser implementado 🔧

| Item | Descrição | Impacto |
|------|-----------|---------|
| Criar device se não existir | Atualmente falha com erro | **Crítico** |
| Criar chip se informado | Não busca/cria chip | **Médio** |
| Campos de status integração | Não persiste status detalhado | **Médio** |
| Campo chip_number | Não armazena número do chip | **Baixo** |

## Arquivos a Modificar

### 1. Edge Function `softruck-ativar-dispositivo/index.ts`

Atualizar para implementar o fluxo completo do PRD:

```text
┌──────────────────────────────────────────────────────────────────┐
│  FLUXO ATUAL (PROBLEMÁTICO)                                      │
├──────────────────────────────────────────────────────────────────┤
│  1. Buscar rastreador local ✅                                   │
│  2. Buscar veículo local ✅                                      │
│  3. Buscar/Criar veículo Softruck ✅                             │
│  4. Buscar device Softruck → ❌ FALHA SE NÃO EXISTIR             │
│  5. Associar device ao veículo                                   │
│  6. Ativar device                                                │
│  7. Atualizar local                                              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  NOVO FLUXO (CONFORME PRD)                                       │
├──────────────────────────────────────────────────────────────────┤
│  1. Buscar rastreador local                                      │
│  2. Buscar veículo local                                         │
│  3. Buscar/Criar veículo Softruck                                │
│  4. Buscar/Criar chip Softruck (se chip_iccid informado)         │ ← NOVO
│  5. Buscar/Criar device Softruck (vinculando chip se existir)    │ ← ALTERADO
│  6. Associar device ao veículo (is_main_device: true)            │
│  7. Ativar device                                                │
│  8. Ativar veículo (opcional)                                    │ ← NOVO
│  9. Atualizar local com IDs e status                             │
│  10. Registrar log detalhado                                     │
└──────────────────────────────────────────────────────────────────┘
```

### 2. Migração SQL

Adicionar campos de rastreamento na tabela `rastreadores`:

```sql
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS chip_number VARCHAR(50);
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS softruck_chip_id VARCHAR(50);
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS softruck_integration_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS softruck_last_attempt_at TIMESTAMPTZ;
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS softruck_payload_sent JSONB;
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS softruck_response_raw JSONB;
```

## Implementação Detalhada

### Passo 1: Atualizar `softruck-ativar-dispositivo`

Alterações no arquivo `supabase/functions/softruck-ativar-dispositivo/index.ts`:

**1.1 Adicionar interface para request com dados de chip:**

```typescript
interface RequestBody {
  imei: string;
  veiculoId: string;
  associadoId: string;
  associadoEmail?: string;
  // Novos campos para chip
  chipSerial?: string;      // ICCID do chip
  chipNumber?: string;      // Número de telefone do chip
  chipOperadora?: string;   // Operadora (Vivo, Claro, Tim)
}
```

**1.2 Novo fluxo - Garantir Chip (se informado):**

```typescript
// ===== 4. Garantir chip na Softruck (se houver dados) =====
let softruckChipId: string | undefined;

const chipSerial = chipSerialParam || rastreador.chip_iccid;
const chipNumber = chipNumberParam || rastreador.chip_number;

if (chipSerial && chipNumber) {
  console.log('[Softruck Ativar] Buscando chip na Softruck...');
  
  // Buscar por serial
  const buscarChipResult = await callSoftruckApi(
    supabaseUrl, supabaseAnonKey,
    'buscar-chip',
    { serial: chipSerial }
  );

  if (buscarChipResult.success && buscarChipResult.data) {
    const chips = buscarChipResult.data?.data || [];
    if (chips.length > 0) {
      softruckChipId = chips[0].id;
      console.log('[Softruck Ativar] Chip encontrado:', softruckChipId);
    }
  }

  // Se não encontrou, criar
  if (!softruckChipId) {
    console.log('[Softruck Ativar] Criando chip na Softruck...');
    
    const criarChipResult = await callSoftruckApi(
      supabaseUrl, supabaseAnonKey,
      'criar-chip',
      {
        serial: chipSerial,
        numero: chipNumber,
        operadora: chipOperadora || 'Softruck',
        provedor: chipOperadora || 'Softruck',
      }
    );

    if (criarChipResult.success && criarChipResult.data) {
      softruckChipId = criarChipResult.data?.data?.[0]?.id;
      console.log('[Softruck Ativar] Chip criado:', softruckChipId);
    }
  }
}
```

**1.3 Alterar busca/criação de device:**

```typescript
// ===== 5. Garantir dispositivo na Softruck =====
if (!softruckDeviceId) {
  console.log('[Softruck Ativar] Buscando device na Softruck por IMEI...');
  
  const buscarDeviceResult = await callSoftruckApi(
    supabaseUrl, supabaseAnonKey,
    'buscar-device-imei',
    { imei }
  );

  if (buscarDeviceResult.success && buscarDeviceResult.data) {
    const devices = buscarDeviceResult.data?.data || [];
    if (devices.length > 0) {
      softruckDeviceId = devices[0].id;
      console.log('[Softruck Ativar] Device encontrado:', softruckDeviceId);
    }
  }

  // NOVO: Se não encontrou, CRIAR o device
  if (!softruckDeviceId) {
    console.log('[Softruck Ativar] Criando device na Softruck...');
    
    const deviceName = `${veiculo.placa} - ${veiculo.modelo || 'Veículo'}`;
    
    const criarDeviceResult = await callSoftruckApi(
      supabaseUrl, supabaseAnonKey,
      'criar-device',
      {
        imei,
        nome: deviceName,
        veiculoId: softruckVehicleId,
        chipId: softruckChipId, // Vincular chip se existir
      }
    );

    if (!criarDeviceResult.success) {
      // Tentar buscar novamente (caso já exista)
      if (criarDeviceResult.error?.includes('Already Exists')) {
        const retryBuscar = await callSoftruckApi(
          supabaseUrl, supabaseAnonKey,
          'buscar-device-imei',
          { imei }
        );
        const devices = retryBuscar.data?.data || [];
        if (devices.length > 0) {
          softruckDeviceId = devices[0].id;
        }
      }
      
      if (!softruckDeviceId) {
        // Registrar falha mas não bloquear
        await updateIntegrationStatus(supabase, rastreador.id, 'FAILED_DEVICE_CREATE', criarDeviceResult.error);
        throw new Error(`Erro ao criar device: ${criarDeviceResult.error}`);
      }
    } else {
      softruckDeviceId = criarDeviceResult.data?.data?.[0]?.id;
      console.log('[Softruck Ativar] Device criado:', softruckDeviceId);
    }
  }
}
```

**1.4 Adicionar função de atualização de status:**

```typescript
async function updateIntegrationStatus(
  supabase: any,
  rastreadorId: string,
  status: string,
  errorMessage?: string,
  payloadSent?: unknown,
  responseRaw?: unknown
) {
  await supabase
    .from('rastreadores')
    .update({
      softruck_integration_status: status,
      softruck_last_attempt_at: new Date().toISOString(),
      softruck_payload_sent: payloadSent,
      softruck_response_raw: responseRaw,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rastreadorId);
}
```

**1.5 Adicionar ativação do veículo (opcional):**

```typescript
// ===== 8. Ativar veículo na Softruck (opcional) =====
console.log('[Softruck Ativar] Ativando veículo na Softruck...');

const ativarVeiculoResult = await callSoftruckApi(
  supabaseUrl, supabaseAnonKey,
  'ativar-veiculo',
  { veiculoId: softruckVehicleId }
);

if (!ativarVeiculoResult.success) {
  console.warn('[Softruck Ativar] Aviso ao ativar veículo:', ativarVeiculoResult.error);
  // Não bloquear - veículo pode já estar ativo
}
```

**1.6 Atualizar registro local com todos os IDs:**

```typescript
const updateData = {
  plataforma_device_id: softruckDeviceId,
  plataforma_veiculo_id: softruckVehicleId,
  softruck_chip_id: softruckChipId,
  softruck_integration_status: 'SUCCESS',
  softruck_last_attempt_at: new Date().toISOString(),
  softruck_payload_sent: { imei, veiculoId, associadoId },
  softruck_response_raw: { softruckVehicleId, softruckDeviceId, softruckChipId },
  updated_at: new Date().toISOString(),
};

// Se ainda não instalado, vincular
if (rastreador.status !== 'instalado') {
  updateData.veiculo_id = veiculoId;
  updateData.associado_id = associadoId;
  updateData.status = 'instalado';
}

await supabase.from('rastreadores').update(updateData).eq('id', rastreador.id);
```

### Passo 2: Migração de Banco de Dados

```sql
-- Adicionar campos de integração Softruck na tabela rastreadores
ALTER TABLE rastreadores 
ADD COLUMN IF NOT EXISTS chip_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS softruck_chip_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS softruck_integration_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS softruck_last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS softruck_payload_sent JSONB,
ADD COLUMN IF NOT EXISTS softruck_response_raw JSONB;

-- Comentários para documentação
COMMENT ON COLUMN rastreadores.softruck_integration_status IS 
  'Status: PENDING | SUCCESS | FAILED_AUTH | FAILED_VEHICLE | FAILED_CHIP | FAILED_DEVICE | FAILED_ASSOCIATION | CREATED_BUT_NOT_ACTIVATED';

COMMENT ON COLUMN rastreadores.chip_number IS 'Número de telefone/linha do chip SIM';
COMMENT ON COLUMN rastreadores.softruck_chip_id IS 'ID do chip na plataforma Softruck';
```

### Passo 3: Atualizar Hook (Opcional)

O hook `useAprovarVeiculoServico` já envia os dados corretos. Opcionalmente, podemos adicionar os dados do chip:

```typescript
// Em useAprovarVeiculoServico, após buscar rastreador:
const rastreadorCompleto = await supabase
  .from('rastreadores')
  .select('id, plataforma, chip_iccid, chip_number')
  .eq('imei', data.imeiRastreador)
  .single();

// Passar para a edge function:
if (rastreadorCompleto?.plataforma === 'softruck') {
  await supabase.functions.invoke('softruck-ativar-dispositivo', {
    body: {
      imei: data.imeiRastreador,
      veiculoId: data.veiculoId,
      associadoId: data.associadoId,
      associadoEmail: associadoData?.email,
      chipSerial: rastreadorCompleto.chip_iccid,
      chipNumber: rastreadorCompleto.chip_number,
    },
  });
}
```

## Status de Integração

| Status | Descrição |
|--------|-----------|
| `PENDING` | Aguardando integração |
| `SUCCESS` | Integração concluída com sucesso |
| `FAILED_AUTH` | Erro de autenticação Softruck |
| `FAILED_VEHICLE` | Erro ao criar/buscar veículo |
| `FAILED_CHIP` | Erro ao criar/buscar chip |
| `FAILED_DEVICE` | Erro ao criar/buscar device |
| `FAILED_ASSOCIATION` | Erro ao associar device ao veículo |
| `CREATED_BUT_NOT_ACTIVATED` | Criado mas ativação falhou |

## Validações Implementadas

| Validação | Ação |
|-----------|------|
| IMEI vazio | Retorna erro antes de chamar API |
| Placa vazia | Retorna erro antes de chamar API |
| Plataforma != softruck | Não chama API, registra "não aplicável" |
| Enterprise ID | Usa secret `SOFTRUCK_ENTERPRISE_ID` (fixo: 1Ndzlwjm7NZagyv) |

## Retries e Observabilidade

| Cenário | Comportamento |
|---------|---------------|
| Timeout | Retry automático (já implementado) |
| 5xx | Retry automático |
| 429 Rate Limit | Aguardar e retry |
| 400 Validação | Não retry, registrar erro |
| 401 Auth | Renovar token e retry (já implementado) |

## Testes e Validação

Após implementação:

1. **Criar rastreador de teste** com plataforma `softruck`
2. **Concluir instalação** via checklist do instalador
3. **Verificar logs** em `rastreadores_logs`
4. **Verificar campos** `softruck_integration_status`, `plataforma_device_id`, etc.
5. **Verificar na Softruck** se veículo, chip e device foram criados

## Arquivos Modificados

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `supabase/functions/softruck-ativar-dispositivo/index.ts` | Refatoração completa |
| Migração SQL | Novos campos na tabela `rastreadores` |
| `src/hooks/useServicos.ts` | Opcional - adicionar dados de chip |

## Diagrama de Sequência

```text
Instalador          Sistema          Softruck API
    │                  │                  │
    │  Concluir        │                  │
    │  Instalação      │                  │
    ├─────────────────>│                  │
    │                  │                  │
    │                  │  1. Buscar/Criar │
    │                  │     Veículo      │
    │                  ├─────────────────>│
    │                  │<─────────────────┤
    │                  │                  │
    │                  │  2. Buscar/Criar │
    │                  │     Chip         │
    │                  ├─────────────────>│
    │                  │<─────────────────┤
    │                  │                  │
    │                  │  3. Buscar/Criar │
    │                  │     Device       │
    │                  ├─────────────────>│
    │                  │<─────────────────┤
    │                  │                  │
    │                  │  4. Associar     │
    │                  │     Device→Veíc  │
    │                  ├─────────────────>│
    │                  │<─────────────────┤
    │                  │                  │
    │                  │  5. Ativar       │
    │                  │     Device       │
    │                  ├─────────────────>│
    │                  │<─────────────────┤
    │                  │                  │
    │  Sucesso!        │                  │
    │<─────────────────┤                  │
    │                  │                  │
```
