

# Revisao Completa - Fluxo de Consulta de Status na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /obterStatusCliente | **NAO EXISTE** | Nenhuma edge function para consultar status do cliente na plataforma |
| Endpoint POST /obterStatusVeiculo | **NAO EXISTE** | Nenhuma edge function para consultar status do veiculo na plataforma |
| Consulta ao abrir ficha do associado | **NAO** | Usa apenas dados do banco local |
| Verificacao de elegibilidade para servicos | **PARCIAL** | Apenas status local, nao consulta plataforma |
| Validacao se cliente esta ativo | **PARCIAL** | Usa `associado.status` local |
| Consulta situacao do rastreador | **PARCIAL** | Busca posicao, nao status na plataforma |
| Abertura de chamado Assistencia 24h | **LOCAL** | Valida `associado.status` e `veiculo.status` locais |
| Comunicado de sinistro | **LOCAL** | Valida `veiculo.status` local |
| Status "ativo" e "inativo" diferenciados | **SIM** | Badges com cores distintas nas telas |
| Sistema bloqueia acoes se inativo | **PARCIAL** | Bloqueia rastreamento, mas nao consulta plataforma |
| Consulta em tempo real (nao cache) | **NAO** | Sempre usa dados do banco local |

---

## Analise Detalhada

### 1. Estado Atual - Nenhum Endpoint de Consulta de Status

A API Rede Veiculos deveria ter endpoints para consultar status em tempo real:

| Endpoint Esperado | Edge Function | Status |
|-------------------|---------------|--------|
| POST /obterStatusCliente | **NAO EXISTE** | Gap |
| POST /obterStatusVeiculo | **NAO EXISTE** | Gap |
| GET /veiculos/{codigo}/posicao | posicao-veiculo | Implementado |

### 2. Cenarios que Deveriam Consultar Status do Cliente

#### 2.1 Quando Atendente Abre Ficha do Associado

**Arquivo:** `src/pages/cadastro/AssociadoDetalhe.tsx`

O componente usa apenas dados do banco local:

```typescript
const { data: associado, isLoading, refetch } = useAssociado(id);
// Mostra associado.status do banco, NAO consulta Rede Veiculos
```

**Gap:** Nao ha consulta em tempo real a plataforma Rede Veiculos para verificar se o status esta sincronizado.

#### 2.2 Quando Ha Verificacao de Elegibilidade para Servicos

**Arquivos:**
- `supabase/functions/criar-chamado-assistencia/index.ts`
- `supabase/functions/criar-sinistro/index.ts`

Ambos validam apenas status local:

```typescript
// criar-chamado-assistencia (linha 138)
if (associado.status !== 'ativo') {
  return Response({ error: "Seu cadastro não está ativo..." });
}

// Verifica veiculo (linha 191)
if (veiculo.status !== 'ativo') {
  return Response({ error: "Este veículo não está ativo..." });
}
// NAO CONSULTA REDE VEICULOS
```

**Gap:** Sistema aceita base local como verdade, sem validar na plataforma.

#### 2.3 Quando Sistema Precisa Validar se Cliente Esta Ativo

**Arquivo:** `src/pages/app/AppRastreamento.tsx` (linhas 226-230)

```typescript
const associadoBloqueado = associado?.status === 'suspenso' || 
                            associado?.status === 'inadimplente' || 
                            associado?.bloqueado === true;

if (associadoBloqueado) {
  // Exibe tela de bloqueio
}
```

**Status:** Funciona com base local. Nao ha discrepancia se o status local estiver correto, mas se houver dessincronizacao com a Rede Veiculos, o sistema nao detecta.

### 3. Cenarios que Deveriam Consultar Status do Veiculo

#### 3.1 Quando Analista Consulta Situacao do Rastreador

**Arquivo:** `src/pages/cadastro/AssociadoDetalhe.tsx`

Na aba de veiculos, exibe status do rastreador do banco local:

```typescript
const { data: veiculos } = useVeiculosDoAssociado(id);
// Mostra veiculo.ativo e rastreador.status do banco
// NAO consulta Rede Veiculos
```

#### 3.2 Quando Ha Abertura de Chamado de Assistencia 24h

**Arquivo:** `supabase/functions/criar-chamado-assistencia/index.ts` (linhas 175-199)

```typescript
const { data: veiculo } = await supabaseAdmin
  .from("veiculos")
  .select("id, placa, marca, modelo, ano_modelo, cor, status")
  .eq("id", payload.veiculo_id)
  .eq("associado_id", associado.id)
  .single();

// Verificar se veículo está ativo
if (veiculo.status !== 'ativo') {
  return Response({ error: "Este veículo não está ativo..." });
}
// NAO CONSULTA REDE VEICULOS
```

#### 3.3 Quando Ha Comunicado de Sinistro

**Arquivo:** `supabase/functions/criar-sinistro/index.ts` (linhas 225-300)

```typescript
const { data: veiculo } = await supabaseAdmin
  .from('veiculos')
  .select('id, placa, marca, modelo, ano_modelo, cor, status')
  .eq('id', payload.veiculo_id)
  .eq('associado_id', associado.id)
  .single();

if (veiculo.status !== 'ativo') {
  return Response({ error: "Este veículo não está ativo..." });
}
// NAO CONSULTA REDE VEICULOS
```

---

## Exibicao de Status nas Telas

### Status Diferenciados Corretamente

**Arquivo:** `src/types/cadastro.ts` e `src/types/database.ts`

| Status | Cor | Exibicao |
|--------|-----|----------|
| ativo | verde | Badge verde |
| em_analise | azul | Badge azul |
| aguardando_instalacao | amarelo | Badge amarelo |
| suspenso | laranja | Badge laranja |
| inadimplente | vermelho | Badge vermelho |
| cancelado | cinza | Badge cinza |
| bloqueado | vermelho escuro | Badge vermelho |

**Status:** IMPLEMENTADO - Cores e labels bem diferenciados.

### Bloqueio de Acoes Baseado em Status

| Acao | Verifica Status | Bloqueia se Inativo |
|------|-----------------|---------------------|
| Abrir chamado assistencia | associado.status e veiculo.status | Sim |
| Comunicar sinistro | veiculo.status | Sim |
| Acessar rastreamento | associado.status e bloqueado | Sim |
| Ver boletos | Nao | Nao (sempre permite) |
| Atualizar dados | Nao | Nao |

**Status:** PARCIAL - Bloqueia baseado em status local, mas nao sincroniza com plataforma.

---

## Problema: Dessincronizacao de Status

### Cenario de Risco

1. Sistema local marca associado como `ativo`
2. Rede Veiculos tem cliente como `inativo` (por exemplo, bloqueio manual no portal)
3. Sistema permite abertura de chamado/sinistro
4. Rede Veiculos nao processa porque cliente esta inativo na plataforma

### Impacto

- Cliente pode solicitar servicos que nao serao atendidos
- Descompasso entre SGA e Rede Veiculos
- Falha de comunicacao com associado

---

## Plano de Implementacao

### Fase 1: Criar Edge Functions de Consulta de Status

**Novo arquivo:** `supabase/functions/rede-veiculos-obter-status-cliente/index.ts`

```typescript
interface RequestBody {
  associadoId: string;
  cpfCnpj?: string;
}

interface StatusClienteResponse {
  success: boolean;
  status: 'ativo' | 'inativo' | 'suspenso' | 'bloqueado';
  sincronizado: boolean;
  dados: {
    idCliente?: number;
    statusPlataforma: string;
    dataUltimaAtualizacao: string;
    veiculosVinculados: number;
  };
}

// Fluxo:
// 1. Buscar associado e seu ID na Rede Veiculos
// 2. Chamar POST /obterStatusCliente (ou GET /clientes/{id}/status)
// 3. Comparar com status local
// 4. Retornar status da plataforma + flag de sincronizacao
```

**Novo arquivo:** `supabase/functions/rede-veiculos-obter-status-veiculo/index.ts`

```typescript
interface RequestBody {
  veiculoId: string;
  placa?: string;
}

interface StatusVeiculoResponse {
  success: boolean;
  status: 'ativo' | 'inativo' | 'bloqueado';
  sincronizado: boolean;
  dados: {
    idVeiculo?: number;
    statusPlataforma: string;
    adimplente: boolean;
    ultimaPosicao?: string;
    rastreadorAtivo: boolean;
  };
}

// Fluxo:
// 1. Buscar veiculo com rede_veiculos_veiculo_id
// 2. Chamar POST /obterStatusVeiculo (ou GET /veiculos/{id}/status)
// 3. Comparar com status local
// 4. Retornar status da plataforma + flag de sincronizacao
```

### Fase 2: Criar Hook de Consulta de Status

**Novo arquivo:** `src/hooks/useRedeVeiculosStatus.ts`

```typescript
export function useStatusClienteRedeVeiculos(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['rede-veiculos-status-cliente', associadoId],
    enabled: !!associadoId,
    staleTime: 30000, // 30 segundos
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'rede-veiculos-obter-status-cliente',
        { body: { associadoId } }
      );
      if (error) throw error;
      return data;
    },
  });
}

export function useStatusVeiculoRedeVeiculos(veiculoId: string | undefined) {
  return useQuery({
    queryKey: ['rede-veiculos-status-veiculo', veiculoId],
    enabled: !!veiculoId,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'rede-veiculos-obter-status-veiculo',
        { body: { veiculoId } }
      );
      if (error) throw error;
      return data;
    },
  });
}
```

### Fase 3: Integrar na Ficha do Associado

**Modificar:** `src/pages/cadastro/AssociadoDetalhe.tsx`

Adicionar badge de sincronizacao de status:

```typescript
const { data: statusPlataforma, isLoading: isLoadingStatus } = 
  useStatusClienteRedeVeiculos(id);

// No header, ao lado do status local
{statusPlataforma && !statusPlataforma.sincronizado && (
  <Badge variant="destructive" className="ml-2">
    <AlertTriangle className="h-3 w-3 mr-1" />
    Dessincronizado
  </Badge>
)}

// Tooltip ou card com detalhes
{statusPlataforma && (
  <Card className="mt-4">
    <CardTitle>Status na Rede Veiculos</CardTitle>
    <CardContent>
      <p>Status: {statusPlataforma.dados.statusPlataforma}</p>
      <p>Ultima atualizacao: {statusPlataforma.dados.dataUltimaAtualizacao}</p>
      {!statusPlataforma.sincronizado && (
        <Button onClick={sincronizarStatus}>Sincronizar</Button>
      )}
    </CardContent>
  </Card>
)}
```

### Fase 4: Validar Status na Plataforma Antes de Servicos

**Modificar:** `supabase/functions/criar-chamado-assistencia/index.ts`

Antes de criar chamado, consultar status na plataforma:

```typescript
// Apos validar status local (linha 147)
// NOVO: Consultar status na Rede Veiculos
if (rastreador?.plataforma === 'rede_veiculos') {
  try {
    const statusResponse = await fetch(
      `${supabaseUrl}/functions/v1/rede-veiculos-obter-status-veiculo`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ veiculoId: veiculo.id }),
      }
    );
    
    const statusData = await statusResponse.json();
    
    if (statusData.success && statusData.dados.statusPlataforma !== 'ativo') {
      return Response({
        success: false,
        error: `Veículo inativo na plataforma de rastreamento. Status: ${statusData.dados.statusPlataforma}`,
      });
    }
  } catch (err) {
    console.warn('[criar-chamado] Erro ao consultar status plataforma:', err);
    // Continua com status local (nao bloqueia se API falhar)
  }
}
```

### Fase 5: Adicionar Botao de Sincronizacao

**Modificar:** `src/pages/cadastro/AssociadoDetalhe.tsx`

Adicionar botao para sincronizar status manualmente:

```typescript
const sincronizarStatusMutation = useMutation({
  mutationFn: async () => {
    const { data, error } = await supabase.functions.invoke(
      'rede-veiculos-sincronizar-status',
      { body: { associadoId: id } }
    );
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    toast.success('Status sincronizado com a plataforma');
    refetch();
  },
});

// No header do associado
<Button 
  variant="outline" 
  onClick={() => sincronizarStatusMutation.mutate()}
  disabled={sincronizarStatusMutation.isPending}
>
  <RefreshCw className="h-4 w-4 mr-2" />
  Sincronizar Plataforma
</Button>
```

### Fase 6: Criar Edge Function de Sincronizacao

**Novo arquivo:** `supabase/functions/rede-veiculos-sincronizar-status/index.ts`

```typescript
// Fluxo:
// 1. Consultar status do cliente na Rede Veiculos
// 2. Consultar status de todos os veiculos na Rede Veiculos
// 3. Atualizar banco local para refletir status da plataforma
// 4. Registrar historico de sincronizacao
// 5. Retornar diferencas encontradas
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-obter-status-cliente/index.ts` | Consultar status cliente |
| `supabase/functions/rede-veiculos-obter-status-veiculo/index.ts` | Consultar status veiculo |
| `supabase/functions/rede-veiculos-sincronizar-status/index.ts` | Sincronizar status local com plataforma |
| `src/hooks/useRedeVeiculosStatus.ts` | Hooks de consulta de status |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Exibir status plataforma e botao sincronizar |
| `supabase/functions/criar-chamado-assistencia/index.ts` | Validar status na plataforma |
| `supabase/functions/criar-sinistro/index.ts` | Validar status na plataforma |
| `supabase/config.toml` | Registrar novas edge functions |

---

## Payload Esperado para Endpoints

### POST /obterStatusCliente (Hipotetico)

**Request:**
```json
{
  "cpfCnpj": "12345678901"
}
```

**Response:**
```json
{
  "codigo": 1,
  "idCliente": 12345,
  "status": "ativo",
  "dataUltimaAtualizacao": "2025-01-29T10:30:00",
  "veiculosVinculados": 2
}
```

### POST /obterStatusVeiculo (Hipotetico)

**Request:**
```json
{
  "idVeiculo": 12345
}
```

**Response:**
```json
{
  "codigo": 1,
  "idVeiculo": 12345,
  "status": "ativo",
  "adimplente": true,
  "ultimaPosicao": "2025-01-29T12:00:00",
  "rastreadorAtivo": true
}
```

---

## Consideracoes Finais

**IMPORTANTE:** Antes de implementar, confirmar com documentacao da API Rede Veiculos:

1. **Existencia dos endpoints:**
   - `POST /obterStatusCliente` existe?
   - `POST /obterStatusVeiculo` existe?
   - Ou o status vem junto com outros endpoints (ex: `/clientes/{id}`)?

2. **Campos retornados:**
   - Quais campos indicam status ativo/inativo?
   - Ha campo de adimplencia?
   - Ha campo de data ultima atualizacao?

3. **Limites de requisicao:**
   - Quantas consultas por minuto/hora sao permitidas?
   - Deve-se implementar cache?

4. **Comportamento esperado:**
   - Se status na plataforma for diferente do local, qual prevalece?
   - Sistema deve atualizar automaticamente ou aguardar acao manual?

**Recomendacao:** Solicitar documentacao oficial da API Rede Veiculos para esclarecer estes pontos antes de implementar.

---

## Checklist de Verificacao Pos-Implementacao

- [ ] Edge function `rede-veiculos-obter-status-cliente` criada
- [ ] Edge function `rede-veiculos-obter-status-veiculo` criada
- [ ] Edge function `rede-veiculos-sincronizar-status` criada
- [ ] Hook `useStatusClienteRedeVeiculos` criado
- [ ] Hook `useStatusVeiculoRedeVeiculos` criado
- [ ] Ficha do associado exibe status da plataforma
- [ ] Badge de dessincronizacao visivel quando houver diferenca
- [ ] Botao de sincronizar funciona
- [ ] Chamado de assistencia valida status na plataforma
- [ ] Sinistro valida status na plataforma
- [ ] Logs registrados em `rastreadores_api_logs`
- [ ] Status ativo/inativo claramente diferenciados
- [ ] Consulta em tempo real (nao cache de longa duracao)

---

## Teste Recomendado: Consultar Status

### Pre-requisitos

1. Associado com veiculo e rastreador Rede Veiculos
2. `REDE_VEICULOS_TOKEN` valido
3. Acesso ao painel Rede Veiculos para comparar

### Passos do Teste

**Parte 1: Consultar Status**

1. Acessar sistema como atendente
2. Navegar para Cadastro > Associados > [Associado teste]
3. Verificar se status na plataforma e exibido
4. Comparar com painel Rede Veiculos
5. Confirmar que status esta sincronizado

**Parte 2: Simular Dessincronizacao**

6. Alterar status do cliente diretamente no painel Rede Veiculos
7. Atualizar pagina no SGA
8. Verificar que badge "Dessincronizado" aparece
9. Clicar em "Sincronizar"
10. Verificar que status local foi atualizado

### Resultado Esperado

- Status da plataforma exibido em tempo real
- Dessincronizacoes detectadas e sinalizadas
- Sincronizacao manual funciona corretamente

