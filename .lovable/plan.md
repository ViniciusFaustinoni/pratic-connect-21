
# Revisao Completa - Fluxo de Instalacao Fisica ate Ativacao na Plataforma Softruck

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Instalador finaliza checklist | **IMPLEMENTADO** | `InstaladorChecklist.tsx` + `useAprovarVeiculoServico` |
| Rastreador marcado como "instalado" no estoque | **IMPLEMENTADO** | Status muda de `estoque` para `instalado` |
| Device buscado via GET /v2/devices (IMEI) | **IMPLEMENTADO** | Operacao `buscar-device-imei` em `softruck-api` |
| Vehicle criado via POST /v2/vehicles | **IMPLEMENTADO** | Operacao `criar-veiculo` em `softruck-api` |
| Associacao device-vehicle via POST | **PARCIALMENTE** | Usa PATCH em vez de POST /v2/vehicles/associations/devices |
| Aguardar primeira posicao | **NAO IMPLEMENTADO** | Sistema nao valida se rastreador comunicou |
| Veiculo aparece no mapa | **DEPENDE** | Funciona se rastreador comunicar e API autenticar |

---

## Analise Detalhada dos Pontos de Integracao

### 1. Quando o instalador finaliza o checklist no App Instalador

**Arquivo:** `src/pages/instalador/InstaladorChecklist.tsx`
**Hook:** `useAprovarVeiculoServico` (em `useServicos.ts`)

**Fluxo atual:**
1. Instalador completa 5 etapas: Dados → Checklist → Fotos → Assinatura → Decisao
2. Na etapa 5, seleciona rastreador do inventario em porte OU digita IMEI manualmente
3. Sistema valida IMEI em tempo real (linha 316-361)
4. Ao clicar "Aprovar Instalacao", chama `aprovarVeiculoMutation`

```typescript
// InstaladorChecklist.tsx linha 377-386
await aprovarVeiculoMutation.mutateAsync({
  servicoId: id,
  veiculoId: servico.veiculos.id,
  associadoId: servico.associados.id,
  imeiRastreador,
});
```

**Status:** FUNCIONAL

---

### 2. Quando o rastreador e marcado como "instalado" no estoque

**Arquivo:** `src/hooks/useServicos.ts` (linha 878-889)

```typescript
// useAprovarVeiculoServico
const { error: rastreadorUpdateError } = await supabase
  .from('rastreadores')
  .update({
    status: 'instalado',      // MUDA DE 'estoque' PARA 'instalado'
    veiculo_id: data.veiculoId,
    portador_id: null,        // Remove do porte do instalador
    updated_at: agora,
  })
  .eq('id', rastreador.id);
```

E registra movimentacao de estoque (linha 891-901):
```typescript
await supabase.from('estoque_movimentacoes').insert({
  rastreador_id: rastreador.id,
  tipo: 'instalacao',
  quantidade: 1,
  status_anterior: 'estoque',
  status_novo: 'instalado',
  veiculo_id: data.veiculoId,
});
```

**Status:** FUNCIONAL

---

### 3. Quando o veiculo e associado ao device na Softruck

A integracao com Softruck ocorre em momentos DIFERENTES dependendo do fluxo:

#### Fluxo A: Instalador com autovistoria previa aprovada

Se `veiculo.cobertura_roubo_furto = true`, a integracao Softruck e chamada **automaticamente** apos a instalacao:

```typescript
// useServicos.ts linha 933-944
await supabase.functions.invoke('softruck-ativar-dispositivo', {
  body: {
    imei: data.imeiRastreador,
    veiculoId: data.veiculoId,
    associadoId: data.associadoId,
    associadoEmail: associadoData?.email,
  },
});
```

#### Fluxo B: Vistoria padrao (analista processa depois)

Se nao tinha autovistoria previa:
1. `processar-vistoria` e chamado pelo analista
2. Se rastreador ja vinculado, marca `cobertura_roubo_furto = true`
3. Analista deve clicar **manualmente** em "Ativar Rastreador" na tela de analise
4. Isso chama `useAtivarRastreadorPlataforma` que invoca `softruck-ativar-dispositivo`

```typescript
// useVistoriaCompletaAnalise.ts linha 158-171
if (rastreador.plataforma === 'softruck') {
  const { data: result, error } = await supabase.functions.invoke('softruck-ativar-dispositivo', {
    body: { imei, veiculoId, associadoId, associadoEmail },
  });
}
```

**Status:** FUNCIONAL (depende de SOFTRUCK_PUBLIC_KEY valida)

---

## Verificacao dos Endpoints Softruck

### Endpoints Utilizados na Edge Function `softruck-ativar-dispositivo`

| Passo | Endpoint Esperado | Endpoint Implementado | Status |
|-------|-------------------|----------------------|--------|
| 1. Buscar veiculo por placa | GET /v2/vehicles?filters[plate] | ✅ `buscar-veiculo-placa` | OK |
| 2. Criar veiculo | POST /v2/vehicles | ✅ `criar-veiculo` | OK |
| 3. Buscar device por IMEI | GET /v2/devices?filters[imei] | ✅ `buscar-device-imei` | OK |
| 4. Vincular device ao veiculo | POST /v2/vehicles/associations/devices | ❌ USA PATCH /v2/devices/{id} | **GAP** |
| 5. Ativar device | PATCH /v2/devices/{id}/status/activation | ✅ `ativar-device` | OK |

---

## GAP IDENTIFICADO: Metodo de Vinculacao Device-Veiculo

### Problema

A funcao `softruck-ativar-dispositivo` usa a operacao `vincular-device-veiculo` que faz:

```typescript
// softruck-api/index.ts linha 536-553
case 'vincular-device-veiculo': {
  const updateData = {
    data: {
      relationships: {
        vehicle: { type: 'vehicle', id: veiculoId },
      },
    },
  };
  // USA PATCH NO DEVICE
  result = await softruckRequest('PATCH', `/v2/devices/${deviceId}`, token, updateData);
  break;
}
```

### Endpoint Correto (conforme documentacao)

Deveria usar `POST /v2/vehicles/associations/devices` para criar associacao formal:

```typescript
// softruck-api/index.ts linha 814-834 (JA EXISTE MAS NAO E USADO!)
case 'associar-device-veiculo': {
  const associationData = {
    data: [{
      device_id: deviceId,
      vehicle_id: vehicleId,
      is_main_device: isPrincipal,
    }],
  };
  result = await softruckRequest('POST', '/v2/vehicles/associations/devices', token, associationData);
  break;
}
```

### Impacto

O PATCH no device pode nao criar a associacao formal na plataforma Softruck, resultando em:
- Veiculo nao aparece na lista de tracking do device
- Historico de trajetos pode nao vincular corretamente
- Webhooks de associacao podem nao ser disparados

---

## GAP IDENTIFICADO: Aguardar Primeira Posicao

### Problema

O sistema **NAO** valida se o rastreador comunicou a primeira posicao apos a instalacao.

**Fluxo Atual:**
1. Instalador aprova → Rastreador status = `instalado`
2. Integracao Softruck → Device vinculado ao vehicle
3. **NENHUMA VERIFICACAO** → Servico marcado como `concluida`

**Fluxo Ideal:**
1. Instalador aprova → Rastreador status = `instalado`
2. Integracao Softruck → Device vinculado ao vehicle
3. **AGUARDAR** primeira posicao (tracking API retornar dados)
4. Quando `ultima_comunicacao` for preenchida → Instalacao `concluida`

### Dados Disponiveis

A tabela `rastreadores` possui:
- `ultima_comunicacao TIMESTAMPTZ` - preenchido pelo sync ou API
- `ultima_posicao_lat`, `ultima_posicao_lng`

Mas nao ha logica que:
1. Verifique se `ultima_comunicacao` e posterior a `data_instalacao`
2. Bloqueie conclusao ate receber posicao
3. Alerte se rastreador nao comunicar em X horas

---

## Verificacao: Veiculo Aparece no Mapa

### Quando Aparece

O veiculo aparece no mapa do associado quando:

1. **Rastreador vinculado localmente:** `rastreadores.veiculo_id` preenchido
2. **IDs da plataforma preenchidos:** `plataforma_device_id` e `plataforma_veiculo_id`
3. **API retorna posicao:** `posicao-veiculo` chama tracking API com sucesso
4. **Autenticacao valida:** `SOFTRUCK_PUBLIC_KEY` funcionando

### Arquivos Envolvidos

- `src/pages/app/AppRastreamento.tsx` - Tela do app do associado
- `supabase/functions/posicao-veiculo/index.ts` - Busca posicao na API
- `src/components/app/CardVeiculo.tsx` - Exibe dados de posicao

### Bloqueador Atual

Se `SOFTRUCK_PUBLIC_KEY` esta invalida, a API retorna 401 e:
- Posicao atual nao carrega
- Fallback para `ultima_comunicacao` do banco (pode estar desatualizada)
- Usuario ve "Sem sinal GPS" ou dados antigos

---

## Plano de Correcoes

### Fase 1: Corrigir Metodo de Associacao Device-Veiculo

**Modificar:** `supabase/functions/softruck-ativar-dispositivo/index.ts`

Trocar:
```typescript
// ERRADO - usa PATCH no device
const vincularResult = await callSoftruckApi(
  supabaseUrl, supabaseAnonKey,
  'vincular-device-veiculo',  // <- PATCH
  { deviceId, veiculoId: softruckVehicleId }
);
```

Por:
```typescript
// CORRETO - usa POST na associacao
const vincularResult = await callSoftruckApi(
  supabaseUrl, supabaseAnonKey,
  'associar-device-veiculo',  // <- POST /v2/vehicles/associations/devices
  { 
    deviceId: softruckDeviceId, 
    vehicleId: softruckVehicleId,
    isPrincipal: true 
  }
);
```

---

### Fase 2: Implementar Aguardo de Primeira Posicao

#### Opcao A: Verificacao Sincrona (Bloqueia conclusao)

**Modificar:** `softruck-ativar-dispositivo`

Apos vincular, tentar buscar posicao:
```typescript
// Aguardar ate 3 tentativas em 30 segundos
for (let i = 0; i < 3; i++) {
  const trackingResult = await callSoftruckApi(
    supabaseUrl, supabaseAnonKey,
    'tracking',
    { veiculoId: softruckVehicleId, deviceId: softruckDeviceId }
  );
  
  if (trackingResult.success && trackingResult.data?.latitude) {
    console.log('[Softruck Ativar] Primeira posicao recebida!');
    // Atualizar rastreador com posicao
    await supabase.from('rastreadores').update({
      ultima_comunicacao: new Date().toISOString(),
      ultima_posicao_lat: trackingResult.data.latitude,
      ultima_posicao_lng: trackingResult.data.longitude,
    }).eq('id', rastreadorId);
    break;
  }
  
  await new Promise(r => setTimeout(r, 10000)); // Espera 10s
}
```

#### Opcao B: Verificacao Assincrona (Nao bloqueia)

**Criar:** `supabase/functions/verificar-instalacao-completa/index.ts`

Job agendado (cron) que verifica instalacoes recentes:
1. Busca rastreadores com `status = 'instalado'` e `ultima_comunicacao IS NULL`
2. Tenta buscar posicao via API
3. Se recebeu → Marca como ok
4. Se > 4h sem posicao → Cria alerta para equipe

---

### Fase 3: Melhorar Feedback Visual

**Modificar:** `src/pages/app/AppRastreamento.tsx`

Adicionar estados visuais:
- "Rastreador ativado - Aguardando primeira posicao GPS"
- "Rastreador comunicando normalmente"
- "Sem comunicacao ha X horas - Verifique o dispositivo"

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/softruck-ativar-dispositivo/index.ts` | Trocar `vincular-device-veiculo` por `associar-device-veiculo` |
| `supabase/functions/softruck-ativar-dispositivo/index.ts` | Adicionar verificacao de primeira posicao (opcional) |
| `src/pages/app/AppRastreamento.tsx` | Melhorar feedback de status pos-instalacao |

## Arquivos a Criar (Opcional)

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/verificar-instalacao-completa/index.ts` | Job para verificar primeira posicao assincronamente |

---

## Teste Recomendado: Instalacao Completa do Inicio ao Fim

### Pre-requisitos

1. `SOFTRUCK_PUBLIC_KEY` valida (bloqueador atual)
2. Rastreador cadastrado no estoque com IMEI
3. Device pre-cadastrado na Softruck com mesmo IMEI
4. Associado e veiculo cadastrados no sistema

### Passos do Teste

1. **Login como Instalador** (`/instalador/login`)
2. **Aceitar tarefa de instalacao** atribuida
3. **Completar checklist** (5 etapas)
   - Dados do veiculo
   - Checklist de itens
   - Fotos obrigatorias + video 360
   - Assinatura do cliente
   - Selecionar rastreador por IMEI
4. **Clicar "Aprovar Instalacao"**
5. **Verificar:**
   - `rastreadores.status` = `instalado`
   - `rastreadores.veiculo_id` = ID do veiculo
   - `rastreadores.plataforma_device_id` preenchido
   - `rastreadores.plataforma_veiculo_id` preenchido
   - `veiculos.softruck_vehicle_id` preenchido
6. **Se autovistoria previa aprovada:**
   - `veiculos.cobertura_total` = true
   - `associados.status` = `ativo`
7. **Se fluxo padrao:**
   - Analista deve processar vistoria
   - Analista clica "Ativar Rastreador"
   - Verificar mesmos campos acima
8. **Abrir App do Associado**
   - Veiculo deve aparecer no mapa
   - Posicao deve carregar (se rastreador comunicando)

### Resultado Esperado

- Veiculo aparece no mapa em `/app/rastreamento`
- Marcador mostra ultima posicao
- Status mostra "Online" ou "Ultima atualizacao: X min atras"

### Possivel Bloqueador

Se API retornar 401:
- Veiculo aparece mas sem posicao atual
- Mostra "Sem sinal GPS" ou dados do fallback local

---

## Checklist de Verificacao

- [ ] Endpoint `associar-device-veiculo` usado em vez de `vincular-device-veiculo`
- [ ] Device buscado via GET /v2/devices?filters[imei]
- [ ] Vehicle criado via POST /v2/vehicles (ou encontrado por placa)
- [ ] Associacao via POST /v2/vehicles/associations/devices
- [ ] Device ativado via PATCH /v2/devices/{id}/status/activation
- [ ] IDs da plataforma salvos no banco local
- [ ] Rastreador status alterado para `instalado`
- [ ] Movimentacao de estoque registrada
- [ ] Primeira posicao verificada apos instalacao (opcional)
- [ ] Veiculo aparece no mapa do associado

---

## Resumo dos Gaps

| # | Gap | Severidade | Recomendacao |
|---|-----|------------|--------------|
| 1 | Usa PATCH em vez de POST para associacao | MEDIA | Corrigir para usar `associar-device-veiculo` |
| 2 | Nao aguarda primeira posicao | BAIXA | Implementar verificacao assincrona |
| 3 | Feedback visual pos-instalacao limitado | BAIXA | Adicionar estados na UI do app |
| 4 | `SOFTRUCK_PUBLIC_KEY` invalida | CRITICO | Atualizar no painel Supabase |

O item 4 continua sendo o bloqueador principal para todas as funcionalidades de integracao Softruck.
