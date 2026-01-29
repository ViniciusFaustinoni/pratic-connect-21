

# Revisao Completa - Fluxo de Controle de Adimplencia na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /informarVeiculoAdimplente | **NAO EXISTE** | Nao ha edge function para notificar adimplencia |
| Endpoint POST /informarVeiculoInadimplente | **NAO EXISTE** | Nao ha edge function para notificar inadimplencia |
| Webhook ASAAS notifica Rede Veiculos | **NAO** | Apenas atualiza banco local e reativa associado |
| Baixa manual notifica Rede Veiculos | **NAO** | Apenas atualiza banco local |
| Vencimento apos carencia bloqueia | **PARCIAL** | Suspende associado localmente, nao notifica plataforma |
| Bloqueio por inadimplencia definido pela diretoria | **NAO** | Nao ha integracao com plataforma |
| Cobranca judicial notifica Rede Veiculos | **NAO** | Funcionalidade nao existe |
| Acesso ao rastreamento bloqueado quando inadimplente | **NAO** | AppRastreamento nao verifica status |
| Historico de mudancas de status gravado | **PARCIAL** | Apenas via logs locais |

---

## Analise Detalhada

### 1. Estado Atual - Nenhuma Integracao de Adimplencia

Os endpoints de controle de adimplencia da Rede Veiculos **NAO ESTAO IMPLEMENTADOS**:

| Endpoint | Edge Function | Status |
|----------|---------------|--------|
| POST /vincularClienteVeiculo | `rede-veiculos-vincular-cliente` | Implementado |
| POST /desvincularClienteVeiculo | `rede-veiculos-desvincular-cliente` | Implementado |
| POST /atualizarDadosCliente | `rede-veiculos-atualizar-cliente` | Implementado |
| POST /atualizarDadosVeiculo | `rede-veiculos-atualizar-veiculo` | Implementado |
| **POST /informarVeiculoAdimplente** | **NAO EXISTE** | **Gap critico** |
| **POST /informarVeiculoInadimplente** | **NAO EXISTE** | **Gap critico** |

### 2. Cenarios de Adimplencia (Deveria Chamar /informarVeiculoAdimplente)

#### 2.1 Quando Pagamento e Confirmado via Webhook ASAAS

**Arquivo:** `supabase/functions/asaas-webhook/index.ts` (linhas 563-609)

```typescript
// CORREÇÃO 7.5.6: Verificar se associado suspenso deve ser reativado
const { data: associadoStatus } = await supabase
  .from('associados')
  .select('id, status')
  .eq('id', cobranca.associado_id)
  .single();

if (associadoStatus?.status === 'suspenso') {
  // Verificar se ainda há cobranças pendentes/vencidas
  const { count: cobrancasPendentes } = await supabase
    .from('asaas_cobrancas')
    .select('*', { count: 'exact', head: true })
    .eq('associado_id', cobranca.associado_id)
    .in('status', ['PENDING', 'OVERDUE']);

  if (cobrancasPendentes === 0) {
    // Reativar associado APENAS LOCALMENTE
    await supabase
      .from('associados')
      .update({ 
        status: 'ativo',
        bloqueado: false,
        motivo_bloqueio: null,
        data_bloqueio: null,
      })
      .eq('id', cobranca.associado_id);
    
    // NAO NOTIFICA REDE VEICULOS SOBRE ADIMPLENCIA
  }
}
```

**Gap:** Quando o associado volta a ficar adimplente, a Rede Veiculos **nao e notificada**.

#### 2.2 Quando Ha Baixa Manual de Pagamento

**Arquivo:** `src/components/financeiro/RegistrarPagamentoModal.tsx` (linhas 90-160)

```typescript
const registrarMutation = useMutation({
  mutationFn: async () => {
    // 1. Atualizar cobrança
    await supabase.from('asaas_cobrancas').update({ status: 'RECEIVED', ... });
    
    // 2. Registrar movimentação financeira
    await supabase.from('movimentacoes_financeiras').insert({ ... });

    // 3. Criar lançamento contábil
    await criarLancamentoAutomatico({ ... });
    
    // NAO VERIFICA SE ASSOCIADO DEVE SER REATIVADO
    // NAO NOTIFICA REDE VEICULOS
  },
});
```

**Gap:** Baixa manual nao verifica debitos pendentes nem notifica a plataforma.

#### 2.3 Quando Associado Quita Debitos Pendentes

**Arquivo:** `src/hooks/useAssociados.ts` (linhas 450-500)

```typescript
const reativarAssociado = useMutation({
  mutationFn: async (id: string) => {
    // 1. Atualizar status local
    await supabase.from('associados').update({
      status: 'ativo',
      bloqueado: false,
    }).eq('id', id);

    // 2. TENTA REVINCULAR na Rede Veículos
    if (rastreador?.plataforma === 'rede_veiculos' && rastreador.imei) {
      await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
        body: { imei, veiculoId, associadoId: id },
      });
    }
    // MAS REVINCULAR != INFORMAR ADIMPLENCIA
    // Se ja estava vinculado, nao precisa revincular
    // Precisa apenas informar que voltou a ser adimplente
  },
});
```

**Gap:** Usa vinculacao em vez de endpoint especifico de adimplencia.

### 3. Cenarios de Inadimplencia (Deveria Chamar /informarVeiculoInadimplente)

#### 3.1 Quando Boleto Vence Apos Periodo de Carencia

**Arquivo:** `supabase/functions/asaas-webhook/index.ts` (linhas 613-698)

```typescript
case 'PAYMENT_OVERDUE':
  // Disparar notificação de cobrança vencida
  await supabase.functions.invoke('disparar-notificacao', { ... });

  // Se for cobrança de adesão vencida, cancelar cotação
  if (cobranca.tipo === 'adesao' && cobranca.contrato_id) {
    await supabase.from('cotacoes').update({
      status: 'expirada',
      motivo_cancelamento: 'Pagamento de adesão não realizado',
    }).eq('id', cotacao_id);
  }
  
  // NAO SUSPENDE ASSOCIADO AUTOMATICAMENTE
  // NAO NOTIFICA REDE VEICULOS SOBRE INADIMPLENCIA
  break;
```

**Gap:** Boleto vencido apenas dispara notificacao, nao suspende associado nem notifica plataforma.

**Nao existe:** Logica de "periodo de carencia" para suspensao automatica.

#### 3.2 Quando Ha Bloqueio por Inadimplencia pela Diretoria

**Arquivo:** `src/hooks/useAssociados.ts` (linhas 434-448)

```typescript
const suspenderAssociado = useMutation({
  mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
    await supabase.from('associados').update({
      status: 'suspenso',
      motivo_bloqueio: motivo || 'Suspenso pelo sistema',
    }).eq('id', id);
    // NAO NOTIFICA REDE VEICULOS
    // NAO DESVINCULAR DA PLATAFORMA
  },
});
```

**Gap:** Suspensao manual nao notifica a Rede Veiculos sobre inadimplencia.

#### 3.3 Quando Associado Entra em Cobranca Judicial

**Status:** Funcionalidade **NAO EXISTE** no sistema.

Nao ha processo para:
- Marcar associado como "em cobranca judicial"
- Bloquear rastreamento automaticamente
- Notificar plataforma sobre inadimplencia judicial

### 4. Controle de Acesso ao Rastreamento

**Arquivo:** `src/pages/app/AppRastreamento.tsx`

O componente **NAO VERIFICA** o status do associado:

```typescript
export default function AppRastreamento() {
  const { data: vehicles } = useMyVehicles();
  const { data: tracker } = useMyVehicleWithTracker();
  
  // NAO VERIFICA:
  // - if (associado.status === 'suspenso') return <AcessoBloqueado />
  // - if (associado.status === 'inadimplente') return <AcessoBloqueado />
  // - if (associado.bloqueado) return <AcessoBloqueado />
  
  // Exibe mapa normalmente mesmo se associado suspenso
}
```

**Gap:** Associado inadimplente/suspenso continua acessando o rastreamento normalmente.

---

## Fluxo Esperado vs Fluxo Atual

### Ciclo Adimplente - Inadimplente - Adimplente

```text
FLUXO ESPERADO:
                                                          
[Associado Ativo] ---> [Boleto Vence] ---> [Carência 7d]
       |                                          |
       v                                          v
[Rastreamento OK]                    [Sem pagamento?]
       ^                                    |
       |                             SIM    v    NAO
       |                        [SUSPENDER]     [OK]
       |                              |
       |                              v
       |                    [POST /informarVeiculoInadimplente]
       |                              |
       |                              v
       |                    [Bloquear AppRastreamento]
       |                              |
       |                              v
       |                    [Associado paga]
       |                              |
       |                              v
       |                    [POST /informarVeiculoAdimplente]
       |                              |
       +------------------------------+

FLUXO ATUAL:
                                                          
[Associado Ativo] ---> [Boleto Vence] ---> [Notificação]
       |                                          |
       v                                          v
[Rastreamento OK]                        [Só notifica]
       |                                          
       | (Associado continua acessando)          
       |                                          
[Sem suspensão automática, sem bloqueio na Rede Veículos]
```

---

## Plano de Implementacao

### Fase 1: Criar Edge Functions de Adimplencia

**Novo arquivo:** `supabase/functions/rede-veiculos-informar-adimplente/index.ts`

```typescript
interface RequestBody {
  associadoId: string;
  veiculoId?: string; // Se informado, apenas para este veiculo
  motivo?: string;
}

// Fluxo:
// 1. Buscar associado e veiculos com rede_veiculos_veiculo_id
// 2. Para cada veiculo vinculado:
//    - Chamar POST /informarVeiculoAdimplente
//    - Registrar log
// 3. Atualizar status local do associado se necessario
```

**Novo arquivo:** `supabase/functions/rede-veiculos-informar-inadimplente/index.ts`

```typescript
interface RequestBody {
  associadoId: string;
  veiculoId?: string;
  motivo: string; // Obrigatorio: 'vencimento', 'bloqueio_diretoria', 'cobranca_judicial'
  diasAtraso?: number;
}

// Fluxo:
// 1. Buscar associado e veiculos com rede_veiculos_veiculo_id
// 2. Para cada veiculo vinculado:
//    - Chamar POST /informarVeiculoInadimplente
//    - Registrar log
// 3. Atualizar status local do associado
// 4. Registrar historico de mudanca
```

### Fase 2: Integrar no Webhook ASAAS

**Modificar:** `supabase/functions/asaas-webhook/index.ts`

Adicionar no evento PAYMENT_RECEIVED/CONFIRMED:
```typescript
// Apos reativar associado localmente
if (associadoStatus?.status === 'suspenso' && cobrancasPendentes === 0) {
  // Reativar localmente (ja existe)
  await supabase.from('associados').update({ status: 'ativo', ... });
  
  // NOVO: Notificar Rede Veiculos
  await supabase.functions.invoke('rede-veiculos-informar-adimplente', {
    body: { associadoId: cobranca.associado_id, motivo: 'pagamento_confirmado' },
  });
}
```

### Fase 3: Criar Cron de Suspensao Automatica

**Novo arquivo:** `supabase/functions/cron-suspender-inadimplentes/index.ts`

```typescript
// Executar diariamente
// 1. Buscar associados ativos com cobrancas vencidas > X dias (carencia)
// 2. Para cada:
//    - Atualizar status para 'suspenso'
//    - Chamar rede-veiculos-informar-inadimplente
//    - Enviar notificacao ao associado
//    - Registrar log
```

### Fase 4: Integrar na Baixa Manual

**Modificar:** `src/components/financeiro/RegistrarPagamentoModal.tsx`

```typescript
// Apos registrar pagamento
if (cobranca?.associado?.id) {
  // Verificar se associado estava suspenso e nao tem mais pendencias
  const { data: associado } = await supabase
    .from('associados')
    .select('status')
    .eq('id', cobranca.associado.id)
    .single();
  
  if (associado?.status === 'suspenso') {
    const { count } = await supabase
      .from('asaas_cobrancas')
      .select('*', { count: 'exact', head: true })
      .eq('associado_id', cobranca.associado.id)
      .in('status', ['PENDING', 'OVERDUE']);
    
    if (count === 0) {
      // Reativar e notificar Rede Veiculos
      await supabase.functions.invoke('rede-veiculos-informar-adimplente', {
        body: { associadoId: cobranca.associado.id },
      });
    }
  }
}
```

### Fase 5: Bloquear Acesso ao Rastreamento

**Modificar:** `src/pages/app/AppRastreamento.tsx`

```typescript
export default function AppRastreamento() {
  const navigate = useNavigate();
  const { data: myData, isLoading: associadoLoading } = useMyData();
  const { data: vehicles } = useMyVehicles();
  
  // Verificar status do associado
  const associadoBloqueado = myData?.status === 'suspenso' || 
                              myData?.status === 'inadimplente' || 
                              myData?.bloqueado === true;
  
  if (associadoBloqueado) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h2 className="mt-4 text-xl font-bold">Acesso Bloqueado</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Seu acesso ao rastreamento está temporariamente suspenso 
          devido a pendências financeiras.
        </p>
        <Button 
          className="mt-6" 
          onClick={() => navigate('/app/boletos')}
        >
          Ver Boletos Pendentes
        </Button>
      </div>
    );
  }
  
  // Resto do componente...
}
```

### Fase 6: Integrar Suspensao Manual

**Modificar:** `src/hooks/useAssociados.ts`

```typescript
const suspenderAssociado = useMutation({
  mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
    // 1. Atualizar status local
    await supabase.from('associados').update({
      status: 'suspenso',
      motivo_bloqueio: motivo || 'Suspenso pelo sistema',
    }).eq('id', id);
    
    // 2. NOVO: Notificar Rede Veiculos
    await supabase.functions.invoke('rede-veiculos-informar-inadimplente', {
      body: { 
        associadoId: id, 
        motivo: motivo?.includes('judicial') ? 'cobranca_judicial' : 'bloqueio_diretoria',
      },
    });
    
    // 3. Registrar historico
    await supabase.from('associados_historico').insert({
      associado_id: id,
      tipo: 'status_alterado',
      descricao: `Associado suspenso. Motivo: ${motivo}`,
      dados_anteriores: { status: 'ativo' },
      dados_novos: { status: 'suspenso', motivo_bloqueio: motivo },
    });
  },
});
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-informar-adimplente/index.ts` | Notifica adimplencia |
| `supabase/functions/rede-veiculos-informar-inadimplente/index.ts` | Notifica inadimplencia |
| `supabase/functions/cron-suspender-inadimplentes/index.ts` | Suspensao automatica |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/asaas-webhook/index.ts` | Chamar informar-adimplente apos reativacao |
| `src/components/financeiro/RegistrarPagamentoModal.tsx` | Verificar e reativar apos baixa manual |
| `src/pages/app/AppRastreamento.tsx` | Bloquear acesso se suspenso/inadimplente |
| `src/hooks/useAssociados.ts` | Integrar notificacao na suspensao manual |
| `supabase/config.toml` | Registrar novas edge functions |

---

## Payload Esperado para Endpoints

### POST /informarVeiculoAdimplente

```json
{
  "cpfCnpj": "12345678901",
  "placa": "ABC1234",
  "dataRegularizacao": "2024-01-15"
}
```

### POST /informarVeiculoInadimplente

```json
{
  "cpfCnpj": "12345678901",
  "placa": "ABC1234",
  "motivo": "vencimento_cobranca",
  "diasAtraso": 15,
  "valorPendente": 450.00
}
```

---

## Configuracao de Carencia

Adicionar em `configuracoes`:

| Chave | Valor | Descricao |
|-------|-------|-----------|
| `inadimplencia_dias_carencia` | `7` | Dias apos vencimento para suspender |
| `inadimplencia_dias_bloqueio_total` | `30` | Dias para bloqueio definitivo |
| `inadimplencia_notificar_rede_veiculos` | `true` | Se deve notificar plataforma |

---

## Checklist de Verificacao

- [ ] Edge function `rede-veiculos-informar-adimplente` criada
- [ ] Edge function `rede-veiculos-informar-inadimplente` criada
- [ ] Cron `cron-suspender-inadimplentes` criado e agendado
- [ ] Webhook ASAAS notifica Rede Veiculos apos pagamento
- [ ] Baixa manual notifica Rede Veiculos apos quitacao
- [ ] Suspensao manual notifica Rede Veiculos
- [ ] AppRastreamento bloqueado para inadimplentes
- [ ] Historico de mudancas de status gravado
- [ ] Status na Rede Veiculos reflete corretamente

---

## Teste Recomendado: Ciclo Completo de Adimplencia

### Pre-requisitos

1. Associado ativo com veiculo e rastreador Rede Veiculos
2. Cobranca pendente/vencida para este associado
3. Acesso ao painel administrativo e app do associado
4. Acesso ao painel Rede Veiculos para verificar

### Passos do Teste

**Parte 1: Inadimplencia**

1. **Acessar o sistema como administrador**
2. **Navegar para Cadastro > Associados > [Associado teste]**
3. **Clicar em "Suspender"** e informar motivo "Inadimplencia"
4. **Verificar no banco:**
   - `associados.status = 'suspenso'`
   - `rastreadores_api_logs` com registro de inadimplencia
5. **Verificar no App do associado:**
   - Ao acessar Rastreamento, deve ver tela de bloqueio
6. **Verificar na Rede Veiculos:**
   - Veiculo marcado como inadimplente

**Parte 2: Adimplencia**

7. **Registrar pagamento manual** para o associado
8. **Ou aguardar pagamento via webhook ASAAS**
9. **Verificar que associado foi reativado automaticamente**
10. **Verificar no banco:**
    - `associados.status = 'ativo'`
    - `rastreadores_api_logs` com registro de adimplencia
11. **Verificar no App do associado:**
    - Rastreamento acessivel novamente
12. **Verificar na Rede Veiculos:**
    - Veiculo marcado como adimplente

### Resultado Esperado

- Status sincronizado entre SGA e Rede Veiculos em ambas direcoes
- Acesso ao rastreamento bloqueado/liberado conforme status
- Historico de todas as mudancas registrado
- Notificacoes enviadas ao associado

---

## Consideracoes Finais

**IMPORTANTE:** Antes de implementar, confirmar com documentacao da API Rede Veiculos:

1. **URL exata dos endpoints:**
   - `POST /informarVeiculoAdimplente` ou similar
   - `POST /informarVeiculoInadimplente` ou similar
2. **Campos obrigatorios:** Quais dados devem ser enviados?
3. **Identificador:** CPF/CNPJ + Placa, ou ID interno?
4. **Efeito na plataforma:** O que acontece quando informamos inadimplencia?
   - Bloqueia acesso do cliente ao portal?
   - Desativa alertas?
   - Bloqueia veiculo fisicamente?
5. **Reversibilidade:** Informar adimplencia restaura tudo automaticamente?

**Recomendacao:** Solicitar documentacao oficial da API Rede Veiculos antes de iniciar a implementacao.

