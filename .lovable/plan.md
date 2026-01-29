

# Revisao Completa - Fluxo de Ativacao e Inativacao de Veiculo na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /ativarVeiculo | **NAO IMPLEMENTADO** | Nenhuma edge function para ativar veiculo na plataforma |
| Endpoint POST /inativarVeiculo | **NAO IMPLEMENTADO** | Nenhuma edge function para inativar veiculo na plataforma |
| Ativacao quando instalacao concluida | **PARCIAL** | Apenas vincula via `/vincularClienteVeiculo`, nao ativa explicitamente |
| Ativacao quando associado reativa apos suspensao | **PARCIAL** | Usa `/vincularClienteVeiculo` como fallback, nao `/ativarVeiculo` |
| Ativacao quando liberado apos sinistro | **NAO IMPLEMENTADO** | Funcionalidade nao existe |
| Inativacao quando associado solicita cancelamento | **NAO** | Usa apenas `/desvincularClienteVeiculo` |
| Inativacao quando ha perda total (sinistro) | **NAO IMPLEMENTADO** | Nao ha automacao para isso |
| Inativacao quando veiculo vendido | **NAO** | Usa apenas `/desvincularClienteVeiculo` |
| Inativacao por suspensao temporaria | **NAO IMPLEMENTADO** | Usa `informarInadimplente`, nao `inativarVeiculo` |
| Veiculo inativo nao aparece no mapa do associado | **SIM** | Filtro `ativo=true` em `useMyVehicles` |
| Veiculo inativo nao gera alertas | **INDETERMINADO** | Depende da plataforma Rede Veiculos |
| Reativacao restaura funcionalidades | **PARCIAL** | Revincular funciona, mas nao ha `/ativarVeiculo` |
| Historico de ativacoes/inativacoes gravado | **PARCIAL** | Apenas via `associados_historico` |

---

## Analise Detalhada

### 1. Estado Atual - Endpoints Rede Veiculos

| Endpoint | Edge Function | Status | Uso |
|----------|---------------|--------|-----|
| POST /vincularClienteVeiculo | `rede-veiculos-vincular-cliente` | Implementado | Apos instalacao |
| POST /desvincularClienteVeiculo | `rede-veiculos-desvincular-cliente` | Implementado | Venda/cancelamento |
| POST /atualizarDadosCliente | `rede-veiculos-atualizar-cliente` | Implementado | Dados do associado |
| POST /atualizarDadosVeiculo | `rede-veiculos-atualizar-veiculo` | Implementado | Dados do veiculo |
| POST /informarVeiculoAdimplente | `rede-veiculos-informar-adimplente` | Implementado | Pagamento OK |
| POST /informarVeiculoInadimplente | `rede-veiculos-informar-inadimplente` | Implementado | Inadimplencia |
| **POST /ativarVeiculo** | **NAO EXISTE** | **Gap** | - |
| **POST /inativarVeiculo** | **NAO EXISTE** | **Gap** | - |

### 2. Comparacao com Softruck

A plataforma Softruck possui operacoes de ativacao/desativacao na edge function `softruck-api`:

```typescript
// supabase/functions/softruck-api/index.ts (linhas 403-414)
case 'ativar-veiculo': {
  const { veiculoId } = data as { veiculoId: string };
  if (!veiculoId) throw new Error('veiculoId é obrigatório');
  result = await softruckRequest('PATCH', `/v2/vehicles/${veiculoId}/status/activation`, token);
  break;
}

case 'desativar-veiculo': {
  const { veiculoId } = data as { veiculoId: string };
  if (!veiculoId) throw new Error('veiculoId é obrigatório');
  result = await softruckRequest('PATCH', `/v2/vehicles/${veiculoId}/status/deactivation`, token);
  break;
}
```

**Rede Veiculos: Nenhum equivalente implementado.**

### 3. Cenarios de Ativacao (Deveria Chamar POST /ativarVeiculo)

#### 3.1 Quando a Instalacao e Concluida pelo Instalador

**Fluxo atual:**
1. Instalador conclui instalacao via `useAprovarVeiculo` (src/hooks/useInstaladorInstalacoes.ts:205-277)
2. Analista ativa manualmente na plataforma via `softruck-ativar-dispositivo` (Softruck)
3. Para Rede Veiculos: Usa `rede-veiculos-vincular-cliente` (vincula, nao ativa)

**Gap:** Nao existe chamada especifica para `/ativarVeiculo` apos vinculacao.

#### 3.2 Quando Associado Reativa Apos Periodo Suspenso

**Arquivo:** `src/hooks/useAssociados.ts` (linhas 479-546)

```typescript
const reativarAssociado = useMutation({
  mutationFn: async (id: string) => {
    // 1. Atualizar status local
    await supabase.from('associados').update({ status: 'ativo', ... });
    
    // 2. Notificar Rede Veículos sobre adimplência
    await supabase.functions.invoke('rede-veiculos-informar-adimplente', { ... });
    
    // 3. Revincular veículos (usa vincularClienteVeiculo)
    for (const veiculo of veiculos) {
      if (rastreador?.plataforma === 'rede_veiculos') {
        await supabase.functions.invoke('rede-veiculos-vincular-cliente', { ... });
      }
    }
  },
});
```

**Gap:** Usa `informarAdimplente` + `vincularClienteVeiculo`, mas nao `/ativarVeiculo` especifico.

#### 3.3 Quando Ha Liberacao Apos Sinistro Resolvido

**Estado atual:** Funcionalidade **NAO EXISTE** no sistema.

Nao ha processo para:
- Reativar veiculo apos sinistro parcial resolvido
- Liberar rastreamento apos encerramento de sinistro
- Chamar `/ativarVeiculo` na plataforma

### 4. Cenarios de Inativacao (Deveria Chamar POST /inativarVeiculo)

#### 4.1 Quando Associado Solicita Cancelamento

**Arquivo:** `src/hooks/useAssociados.ts` (linhas 590-656)

```typescript
const cancelarAssociado = useMutation({
  mutationFn: async ({ id, motivo }) => {
    // 1. Buscar veículos do associado
    const { data: veiculos } = await supabase.from('veiculos').select('id, placa');
    
    // 2. Para cada rastreador Rede Veículos
    if (rastreador.plataforma === 'rede_veiculos') {
      await supabase.functions.invoke('rede-veiculos-desvincular-cliente', { ... });
      // USA DESVINCULAR, NÃO INATIVAR
    }
  },
});
```

**Gap:** Usa `desvincularClienteVeiculo` (remove completamente) em vez de `inativarVeiculo` (desativa mantendo cadastro).

#### 4.2 Quando Ha Perda Total do Veiculo (Sinistro)

**Arquivo:** `src/components/eventos/EmitirParecerModal.tsx` (linhas 113-130)

```typescript
// Calcular tipo_dano automaticamente
let tipoDano: 'parcial' | 'perda_total' | null = null;
if (resultado === 'aprovado' && valorIndenizacao && sinistro.valor_fipe) {
  const limite75 = sinistro.valor_fipe * 0.75;
  tipoDano = valorIndenizacao >= limite75 ? 'perda_total' : 'parcial';
}

await supabase.from('sinistros').update({
  tipo_dano: tipoDano,
  valor_indenizacao: valorIndenizacao,
  // NAO INATIVA VEICULO NA PLATAFORMA
});
```

**Gap:** Quando sinistro e perda total, o veiculo deveria ser automaticamente inativado na plataforma.

#### 4.3 Quando o Veiculo e Vendido

**Arquivo:** `src/hooks/useVenderVeiculo.ts` (linhas 59-123)

```typescript
if (rastreador.plataforma === 'rede_veiculos') {
  await supabase.functions.invoke('rede-veiculos-desvincular-cliente', {
    body: {
      rastreadorId: rastreador.id,
      motivo: 'venda_veiculo',
      atualizarBancoLocal: true,
    },
  });
}
```

**Comportamento:** Usa desvinculacao completa, nao inativacao. Pode ser aceitavel dependendo do caso de uso.

#### 4.4 Suspensao Temporaria por Solicitacao do Associado

**Estado atual:** Funcionalidade **NAO EXISTE** no sistema.

Hoje, suspensao apenas:
- Atualiza status local para `suspenso`
- Chama `rede-veiculos-informar-inadimplente`
- **NAO** chama `/inativarVeiculo`

---

## Fluxo Esperado vs Fluxo Atual

```text
FLUXO ESPERADO DE ATIVACAO:

[Instalacao Concluida] --> [vincularClienteVeiculo]
         |
         v
[Vincular OK] --> [POST /ativarVeiculo]
         |
         v
[Veiculo ativo na plataforma]
         |
         v
[Aparece no mapa do associado]


FLUXO ATUAL:

[Instalacao Concluida] --> [vincularClienteVeiculo]
         |
         v
[Vincular OK] --> [FIM - sem ativacao explicita]
```

```text
FLUXO ESPERADO DE INATIVACAO:

[Perda Total Aprovada] --> [POST /inativarVeiculo]
         |
         v
[Veiculo inativo na plataforma]
         |
         v
[Some do mapa do associado]


FLUXO ATUAL:

[Perda Total Aprovada] --> [Atualiza banco local apenas]
         |
         v
[Veiculo ainda ativo na plataforma!]
```

---

## Impactos dos Gaps

### Impacto 1: Veiculos Ficam em Estado Indefinido

Apos vinculacao, o veiculo pode nao estar efetivamente "ativo" na plataforma Rede Veiculos ate que haja uma chamada explicita de ativacao.

### Impacto 2: Perda Total Nao Bloqueia Acesso

Quando um sinistro de perda total e aprovado, o veiculo continua ativo na plataforma, permitindo rastreamento mesmo quando deveria estar bloqueado.

### Impacto 3: Suspensao Temporaria Nao Funciona Adequadamente

A opcao de "pausar" o servico temporariamente (ferias, viagem longa, etc) nao existe. Apenas suspensao por inadimplencia.

### Impacto 4: Historico Incompleto

Nao ha registro especifico de ativacoes/inativacoes de veiculos, apenas historico de associado.

---

## Plano de Implementacao

### Fase 1: Criar Edge Functions de Ativacao/Inativacao

**Novo arquivo:** `supabase/functions/rede-veiculos-ativar-veiculo/index.ts`

```typescript
interface RequestBody {
  veiculoId: string;
  motivo?: string;
}

// Fluxo:
// 1. Buscar veiculo com rede_veiculos_veiculo_id
// 2. Validar que ha vinculo ativo na plataforma
// 3. Chamar POST /ativarVeiculo com { idVeiculo: rede_veiculos_veiculo_id }
// 4. Atualizar banco local (veiculo.ativo = true)
// 5. Registrar log e historico
```

**Novo arquivo:** `supabase/functions/rede-veiculos-inativar-veiculo/index.ts`

```typescript
interface RequestBody {
  veiculoId: string;
  motivo: 'perda_total' | 'cancelamento' | 'suspensao_temporaria' | 'venda' | 'outro';
  observacoes?: string;
}

// Fluxo:
// 1. Buscar veiculo com rede_veiculos_veiculo_id
// 2. Validar que ha vinculo ativo na plataforma
// 3. Chamar POST /inativarVeiculo com { idVeiculo: rede_veiculos_veiculo_id, motivo }
// 4. Atualizar banco local (veiculo.ativo = false)
// 5. Registrar log e historico
```

### Fase 2: Integrar Apos Vinculacao

**Modificar:** `supabase/functions/rede-veiculos-vincular-cliente/index.ts`

Apos vinculacao bem-sucedida, chamar ativacao:

```typescript
// Apos codigo 1 da API (sucesso)
if (apiResult.codigo === 1) {
  // ... codigo existente ...
  
  // NOVO: Ativar veiculo na plataforma
  try {
    const ativarPayload = { idVeiculo: apiResult.idVeiculo };
    const ativarResponse = await fetch(`${baseUrl}/ativarVeiculo/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, ... },
      body: new URLSearchParams({ json: JSON.stringify(ativarPayload) }),
    });
    console.log('[RedeVeiculos Vincular] Veiculo ativado na plataforma');
  } catch (ativarError) {
    console.warn('[RedeVeiculos Vincular] Erro ao ativar:', ativarError);
  }
}
```

### Fase 3: Inativar em Perda Total

**Modificar:** `src/components/eventos/EmitirParecerModal.tsx`

Quando tipo_dano = 'perda_total', chamar inativacao:

```typescript
// Apos update do sinistro
if (tipoDano === 'perda_total' && sinistro.veiculo_id) {
  // Inativar veiculo na plataforma
  await supabase.functions.invoke('rede-veiculos-inativar-veiculo', {
    body: {
      veiculoId: sinistro.veiculo_id,
      motivo: 'perda_total',
      observacoes: `Sinistro ${sinistro.id} aprovado como perda total`,
    },
  });
  
  // Atualizar veiculo local
  await supabase.from('veiculos').update({
    ativo: false,
    status: 'baixado',
    updated_at: new Date().toISOString(),
  }).eq('id', sinistro.veiculo_id);
}
```

### Fase 4: Ativar Apos Sinistro Resolvido

**Criar hook:** `src/hooks/useReativarVeiculoPossinistro.ts`

```typescript
export function useReativarVeiculoPosSinistro() {
  return useMutation({
    mutationFn: async ({ veiculoId, sinistroId }) => {
      // 1. Verificar se sinistro foi dano parcial (nao perda total)
      // 2. Atualizar veiculo local (ativo = true)
      // 3. Chamar rede-veiculos-ativar-veiculo
      // 4. Registrar historico
    },
  });
}
```

### Fase 5: Adicionar Opcao de Suspensao Temporaria

**Criar modal:** `src/components/veiculos/SuspenderVeiculoDialog.tsx`

Permitir suspensao temporaria com motivo:
- Ferias / viagem longa
- Manutencao prolongada
- Outro motivo

Chamara `/inativarVeiculo` com motivo apropriado.

### Fase 6: Criar Hook de Historico de Ativacoes

**Criar:** `src/hooks/useVeiculoHistoricoAtivacoes.ts`

Buscar logs de ativacao/inativacao da tabela `rastreadores_api_logs`:

```typescript
export function useVeiculoHistoricoAtivacoes(veiculoId: string) {
  return useQuery({
    queryFn: async () => {
      const { data: logs } = await supabase
        .from('rastreadores_api_logs')
        .select('*')
        .eq('plataforma', 'rede_veiculos')
        .in('operacao', ['ativarVeiculo', 'inativarVeiculo'])
        .order('created_at', { ascending: false });
      
      return logs;
    },
  });
}
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-ativar-veiculo/index.ts` | Ativar veiculo na plataforma |
| `supabase/functions/rede-veiculos-inativar-veiculo/index.ts` | Inativar veiculo na plataforma |
| `src/hooks/useReativarVeiculoPosSinistro.ts` | Reativar apos sinistro parcial |
| `src/components/veiculos/SuspenderVeiculoDialog.tsx` | Modal de suspensao temporaria |
| `src/hooks/useVeiculoHistoricoAtivacoes.ts` | Historico de ativacoes |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/rede-veiculos-vincular-cliente/index.ts` | Adicionar ativacao apos vinculacao |
| `src/components/eventos/EmitirParecerModal.tsx` | Inativar em perda total |
| `src/hooks/useVenderVeiculo.ts` | Chamar inativar antes de desvincular |
| `src/hooks/useAssociados.ts` | Usar ativar/inativar em vez de vincular/desvincular |
| `supabase/config.toml` | Registrar novas edge functions |

---

## Payload Esperado para Endpoints

### POST /ativarVeiculo

```json
{
  "idVeiculo": 12345
}
```

**Resposta esperada:**
```json
{
  "codigo": 1,
  "msg": "Veiculo ativado com sucesso"
}
```

### POST /inativarVeiculo

```json
{
  "idVeiculo": 12345,
  "motivo": "perda_total",
  "observacoes": "Sinistro aprovado em 15/01/2025"
}
```

**Resposta esperada:**
```json
{
  "codigo": 1,
  "msg": "Veiculo inativado com sucesso"
}
```

---

## Controle de Acesso ao Rastreamento

### Estado Atual (CORRETO)

**Arquivo:** `src/hooks/useMyData.ts` (linhas 118-137)

```typescript
export function useMyVehicles() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .eq('associado_id', associado.id)
        .eq('ativo', true)  // FILTRO CORRETO - so veiculos ativos
        .order('created_at', { ascending: false });

      return data as Veiculo[];
    },
  });
}
```

**Resultado:** Veiculos inativos (ativo=false) nao aparecem no App do Associado. Este comportamento esta correto.

### Verificacao Adicional Necessaria

Confirmar que quando `veiculo.ativo = false`:
1. Nao aparece na lista de veiculos do associado no App
2. Nao permite solicitar assistencia 24h
3. Nao permite abrir sinistro (apenas se ja houver sinistro em andamento)
4. Historico ainda acessivel

---

## Checklist de Verificacao

- [ ] Edge function `rede-veiculos-ativar-veiculo` criada
- [ ] Edge function `rede-veiculos-inativar-veiculo` criada
- [ ] Ativacao automatica apos vinculacao implementada
- [ ] Inativacao em perda total implementada
- [ ] Inativacao na venda do veiculo implementada
- [ ] Opcao de suspensao temporaria criada
- [ ] Reativacao apos sinistro parcial implementada
- [ ] Historico de ativacoes/inativacoes disponivel
- [ ] Veiculos inativos nao aparecem no mapa do associado (ja funciona)
- [ ] Logs registrados em `rastreadores_api_logs`

---

## Teste Recomendado: Inativar Veiculo

### Pre-requisitos

1. Veiculo ativo com rastreador Rede Veiculos instalado
2. `rede_veiculos_veiculo_id` preenchido no banco
3. `REDE_VEICULOS_TOKEN` valido e configurado
4. Acesso ao App do Associado para verificar

### Passos do Teste

**Parte 1: Inativar**

1. **Acessar o sistema como diretor** (admin@teste.com)
2. **Navegar para Cadastro > Associados > [Associado teste]**
3. **Na aba Veiculos, clicar em "Suspender Veiculo" (novo botao)**
4. **Selecionar motivo: "Suspensao temporaria"**
5. **Confirmar**
6. **Verificar no banco:**
   - `veiculos.ativo = false`
   - `rastreadores_api_logs` com operacao `inativarVeiculo`
7. **Verificar no App do Associado:**
   - Veiculo **NAO** deve aparecer na lista
   - Rastreamento deve mostrar "Nenhum veiculo ativo"
8. **Verificar na plataforma Rede Veiculos:**
   - Veiculo marcado como inativo

**Parte 2: Reativar**

9. **Voltar ao painel administrativo**
10. **Clicar em "Reativar Veiculo"**
11. **Verificar no banco:**
    - `veiculos.ativo = true`
    - `rastreadores_api_logs` com operacao `ativarVeiculo`
12. **Verificar no App do Associado:**
    - Veiculo volta a aparecer na lista
    - Rastreamento funciona normalmente

### Resultado Esperado

- Veiculo some/aparece do App conforme status de ativacao
- Plataforma Rede Veiculos sincronizada
- Historico de mudancas registrado

---

## Consideracoes Finais

**IMPORTANTE:** Antes de implementar, confirmar com documentacao da API Rede Veiculos:

1. **Existencia dos endpoints:**
   - `POST /ativarVeiculo` existe?
   - `POST /inativarVeiculo` existe?
   - Ou sao operacoes dentro de `/atualizarDadosVeiculo`?

2. **Campos obrigatorios:**
   - Qual identificador usar? `idVeiculo` (numerico) ou `placa/chassi`?
   - `motivo` e obrigatorio para inativacao?

3. **Efeito na plataforma:**
   - O que acontece quando inativamos?
     - Bloqueia acesso ao portal do cliente?
     - Para de gerar alertas?
     - Mantem historico de posicoes?
   - E quando ativamos?
     - Restaura tudo automaticamente?

4. **Relacao com vincular/desvincular:**
   - Ativar/inativar e diferente de vincular/desvincular?
   - Ou ativar = vincular e inativar = desvincular?

**Recomendacao:** Solicitar documentacao oficial da API Rede Veiculos para esclarecer estes pontos antes de implementar.

