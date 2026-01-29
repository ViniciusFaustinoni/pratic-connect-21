
# Revisao Completa - Fluxo de Desvinculacao de Equipamento na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /desvincularClienteVeiculo | **NAO EXISTE** | Nao ha edge function para desvinculacao |
| Desvinculacao ao cancelar contrato | **NAO IMPLEMENTADO** | Apenas atualiza banco local |
| Desvinculacao ao substituir equipamento | **NAO IMPLEMENTADO** | Funcionalidade nao existe |
| Desvinculacao ao vender veiculo | **NAO IMPLEMENTADO** | Funcionalidade nao existe |
| Desvinculacao ao dar baixa no estoque | **NAO IMPLEMENTADO** | Apenas atualiza status local |
| IMEI enviado corretamente | **NAO** | Nenhuma integracao ativa |
| CPF/CNPJ do cliente enviado | **NAO** | Nenhuma integracao ativa |
| Placa/Chassi enviado | **NAO** | Nenhuma integracao ativa |
| Equipamento liberado apos desvinculacao | **PARCIAL** | Status atualizado localmente, mas nao na plataforma |

---

## Analise Detalhada

### 1. Estado Atual - Nenhuma Integracao de Desvinculacao

Diferentemente da Softruck que possui o endpoint `desassociar-device-veiculo` na edge function `softruck-api`, a Rede Veiculos **nao possui nenhuma implementacao de desvinculacao**.

**Comparacao das Plataformas:**

| Funcionalidade | Softruck | Rede Veiculos |
|----------------|----------|---------------|
| Vincular equipamento | `softruck-ativar-dispositivo` | `rede-veiculos-vincular-cliente` |
| Desvincular equipamento | `softruck-api` (desassociar-device-veiculo) | **NAO EXISTE** |
| Retornar ao estoque | **PARCIAL** (apenas local) | **PARCIAL** (apenas local) |

### 2. Cenarios Onde Deveria Chamar /desvincularClienteVeiculo

#### 2.1 Quando o Associado Cancela o Contrato

**Arquivo:** `src/hooks/useAssociados.ts` (linha 540-554)

```typescript
const cancelarAssociado = useMutation({
  mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
    // APENAS atualiza status local
    const { error } = await supabase.from('associados').update({
      status: 'cancelado',
      motivo_bloqueio: motivo,
    }).eq('id', id);
  },
});
```

**Gap:** Nao busca rastreadores vinculados e nao notifica a plataforma Rede Veiculos.

#### 2.2 Quando Ha Substituicao de Equipamento por Defeito

**Status:** Funcionalidade **NAO EXISTE** no sistema.

Nao ha interface ou fluxo para:
- Trocar um rastreador defeituoso por outro
- Desvincular o equipamento antigo
- Vincular o equipamento novo
- Manter historico de substituicoes

#### 2.3 Quando o Veiculo e Vendido

**Status:** Funcionalidade **NAO EXISTE** no sistema.

Nao ha processo para:
- Marcar veiculo como vendido
- Liberar o rastreador para nova instalacao
- Desvincular na plataforma

#### 2.4 Quando Ha Baixa do Rastreador no Estoque

**Arquivo:** `src/components/rastreadores/RastreadorDetailDrawer.tsx` (linha 82-85)

```typescript
const handleStatusChange = async (status: StatusRastreador) => {
  if (!rastreadorId) return;
  await updateStatus.mutateAsync({ id: rastreadorId, status });
};
```

**Arquivo:** `src/hooks/useRastreadores.ts` (linha 224-258)

```typescript
export function useUpdateRastreadorStatus() {
  return useMutation({
    mutationFn: async ({ id, status, veiculo_id }) => {
      const updateData = { status };
      
      // If status is not 'instalado', clear vehicle association
      if (status !== 'instalado') {
        updateData.veiculo_id = null; // APENAS LOCAL!
      }

      const { data: result, error } = await supabase
        .from('rastreadores')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    },
  });
}
```

**Gap Critico:** Ao mudar status para `estoque`, `manutencao` ou `baixado`:
- Atualiza `veiculo_id = null` apenas localmente
- **NAO** chama API da Rede Veiculos
- **NAO** libera equipamento na plataforma
- Equipamento continua vinculado na Rede Veiculos

---

## Impactos dos Gaps

### Impacto 1: Equipamentos "Fantasma" na Plataforma

Quando um rastreador e desvinculado localmente:
- Na Rede Veiculos, o equipamento continua vinculado ao cliente/veiculo
- Pode gerar cobrancas indevidas na plataforma
- Cliente continua recebendo notificacoes de veiculo que nao possui mais

### Impacto 2: Impossibilidade de Reutilizar Equipamento

Se o equipamento nao for desvinculado na plataforma:
- Ao tentar vincular a outro cliente, pode dar erro de duplicidade
- Historico fica poluido com dados de clientes anteriores

### Impacto 3: Problemas na Substituicao

Sem fluxo de substituicao:
- Tecnico precisa manualmente:
  1. Recolher equipamento defeituoso
  2. Dar baixa no sistema
  3. Instalar novo equipamento
  4. Vincular manualmente
- Perdas de historico e rastreabilidade

---

## Plano de Implementacao

### Fase 1: Criar Edge Function rede-veiculos-desvincular-cliente

**Novo arquivo:** `supabase/functions/rede-veiculos-desvincular-cliente/index.ts`

```typescript
interface RequestBody {
  imei: string;
  cpfCnpj?: string;
  placa?: string;
  chassi?: string;
  motivo?: string;
}

// Fluxo:
// 1. Buscar rastreador local pelo IMEI
// 2. Validar que e plataforma rede_veiculos
// 3. Buscar veiculo vinculado (para obter placa/chassi)
// 4. Buscar associado vinculado (para obter CPF/CNPJ)
// 5. Chamar POST /desvincularClienteVeiculo na API Rede Veiculos
// 6. Atualizar banco local:
//    - rastreador.status = 'estoque'
//    - rastreador.veiculo_id = null
//    - rastreador.plataforma_device_id = null (limpar vinculo)
// 7. Registrar log de desvinculacao
```

**Payload esperado para API:**
```json
{
  "imei": "123456789012345",
  "cpfCnpj": "12345678901",
  "placa": "ABC1234",
  "motivo": "cancelamento_contrato"
}
```

### Fase 2: Integrar nos Momentos Apropriados

#### 2.1 Ao Cancelar Associado

**Modificar:** `src/hooks/useAssociados.ts`

```typescript
const cancelarAssociado = useMutation({
  mutationFn: async ({ id, motivo }) => {
    // 1. Buscar veiculos do associado com rastreadores
    const { data: veiculos } = await supabase
      .from('veiculos')
      .select('id, placa, chassi, rastreadores(*)')
      .eq('associado_id', id);
    
    // 2. Para cada rastreador Rede Veiculos, desvincular
    for (const veiculo of veiculos || []) {
      const rastreador = veiculo.rastreadores?.[0];
      if (rastreador?.plataforma === 'rede_veiculos') {
        await supabase.functions.invoke('rede-veiculos-desvincular-cliente', {
          body: {
            imei: rastreador.imei,
            motivo: 'cancelamento_contrato',
          },
        });
      }
    }
    
    // 3. Atualizar status do associado
    await supabase.from('associados').update({
      status: 'cancelado',
      motivo_bloqueio: motivo,
    }).eq('id', id);
  },
});
```

#### 2.2 Ao Mudar Status do Rastreador

**Modificar:** `src/hooks/useRastreadores.ts`

```typescript
export function useUpdateRastreadorStatus() {
  return useMutation({
    mutationFn: async ({ id, status }) => {
      // 1. Buscar rastreador atual
      const { data: rastreador } = await supabase
        .from('rastreadores')
        .select('*, veiculos(placa, chassi, associados(cpf))')
        .eq('id', id)
        .single();
      
      // 2. Se estava instalado e vai para outro status, desvincular
      if (rastreador?.status === 'instalado' && status !== 'instalado') {
        if (rastreador.plataforma === 'rede_veiculos' && rastreador.veiculo_id) {
          await supabase.functions.invoke('rede-veiculos-desvincular-cliente', {
            body: { imei: rastreador.imei, motivo: `status_${status}` },
          });
        } else if (rastreador.plataforma === 'softruck') {
          // Softruck ja tem fluxo de desassociacao
          await supabase.functions.invoke('softruck-api', {
            body: {
              operation: 'desassociar-device-veiculo',
              data: { associationId: rastreador.softruck_association_id },
            },
          });
        }
      }
      
      // 3. Atualizar banco local
      return await supabase.from('rastreadores').update({
        status,
        veiculo_id: status !== 'instalado' ? null : undefined,
      }).eq('id', id).select().single();
    },
  });
}
```

### Fase 3: Criar Funcionalidade de Substituicao de Equipamento

**Novo arquivo:** `src/hooks/useSubstituirEquipamento.ts`

```typescript
interface SubstituirEquipamentoParams {
  rastreadorAntigoId: string;
  rastreadorNovoImei: string;
  motivoSubstituicao: string;
}

export function useSubstituirEquipamento() {
  return useMutation({
    mutationFn: async ({ rastreadorAntigoId, rastreadorNovoImei, motivoSubstituicao }) => {
      // 1. Buscar rastreador antigo com veiculo/associado
      const { data: antigo } = await supabase
        .from('rastreadores')
        .select('*, veiculos(*, associados(*))')
        .eq('id', rastreadorAntigoId)
        .single();
      
      // 2. Desvincular antigo na plataforma
      if (antigo.plataforma === 'rede_veiculos') {
        await supabase.functions.invoke('rede-veiculos-desvincular-cliente', {
          body: { imei: antigo.imei, motivo: motivoSubstituicao },
        });
      }
      
      // 3. Vincular novo na plataforma
      await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
        body: {
          imei: rastreadorNovoImei,
          veiculoId: antigo.veiculo_id,
          associadoId: antigo.veiculos.associado_id,
        },
      });
      
      // 4. Atualizar banco local
      // - Antigo: status = 'manutencao', veiculo_id = null
      // - Novo: status = 'instalado', veiculo_id = antigo.veiculo_id
    },
  });
}
```

**Novo componente:** `src/components/rastreadores/SubstituirEquipamentoDialog.tsx`

Modal com:
- Campo para selecionar novo rastreador (do estoque)
- Campo para motivo da substituicao (defeito, upgrade, etc)
- Botao para confirmar substituicao

### Fase 4: Criar Funcionalidade de Veiculo Vendido

**Novo arquivo:** `src/hooks/useVenderVeiculo.ts`

```typescript
export function useVenderVeiculo() {
  return useMutation({
    mutationFn: async ({ veiculoId, dataVenda, compradorInfo }) => {
      // 1. Buscar rastreador do veiculo
      const { data: rastreador } = await supabase
        .from('rastreadores')
        .select('*')
        .eq('veiculo_id', veiculoId)
        .maybeSingle();
      
      // 2. Desvincular na plataforma
      if (rastreador?.plataforma === 'rede_veiculos') {
        await supabase.functions.invoke('rede-veiculos-desvincular-cliente', {
          body: { imei: rastreador.imei, motivo: 'venda_veiculo' },
        });
      }
      
      // 3. Atualizar rastreador (retorna ao estoque)
      if (rastreador) {
        await supabase.from('rastreadores').update({
          status: 'estoque',
          veiculo_id: null,
        }).eq('id', rastreador.id);
      }
      
      // 4. Marcar veiculo como vendido
      await supabase.from('veiculos').update({
        status: 'vendido',
        data_venda: dataVenda,
        comprador_info: compradorInfo,
      }).eq('id', veiculoId);
    },
  });
}
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-desvincular-cliente/index.ts` | Edge Function para desvinculacao |
| `src/hooks/useSubstituirEquipamento.ts` | Hook para substituicao |
| `src/hooks/useVenderVeiculo.ts` | Hook para venda de veiculo |
| `src/components/rastreadores/SubstituirEquipamentoDialog.tsx` | Modal de substituicao |
| `src/components/veiculos/VenderVeiculoDialog.tsx` | Modal de venda |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/hooks/useRastreadores.ts` | Chamar desvinculacao ao mudar status |
| `src/hooks/useAssociados.ts` | Desvincular rastreadores ao cancelar |
| `src/components/rastreadores/RastreadorDetailDrawer.tsx` | Adicionar botao "Substituir" |
| `supabase/config.toml` | Registrar nova edge function |

---

## Payload Esperado para POST /desvincularClienteVeiculo

Baseado no padrao da API de vinculacao:

```typescript
interface DesvincularRequest {
  // Identificacao do equipamento (obrigatorio)
  imei: string;
  
  // Identificacao do cliente (opcional, para validacao)
  cpfCnpj?: string;
  
  // Identificacao do veiculo (opcional, para validacao)
  placa?: string;
  chassi?: string;
  
  // Motivo da desvinculacao (para auditoria)
  motivo?: 'cancelamento_contrato' | 'substituicao_defeito' | 'venda_veiculo' | 'baixa_equipamento' | 'outros';
}
```

---

## Checklist de Verificacao Pos-Implementacao

- [ ] Edge function `rede-veiculos-desvincular-cliente` criada
- [ ] Ao cancelar associado, rastreadores Rede Veiculos sao desvinculados
- [ ] Ao mudar status para `estoque/manutencao/baixado`, equipamento e desvinculado
- [ ] Funcionalidade de substituicao de equipamento implementada
- [ ] Funcionalidade de venda de veiculo implementada
- [ ] IMEI enviado corretamente na desvinculacao
- [ ] CPF/CNPJ enviado na desvinculacao
- [ ] Placa/Chassi enviado como identificador adicional
- [ ] Apos desvinculacao, equipamento fica com status `estoque`
- [ ] Equipamento aparece disponivel no estoque do SGA
- [ ] Log de desvinculacao registrado em `rastreadores_api_logs`

---

## Teste Recomendado: Desvinculacao Completa

### Pre-requisitos

1. Associado ativo com veiculo e rastreador Rede Veiculos instalado
2. `REDE_VEICULOS_TOKEN` valido e configurado
3. Acesso ao painel da Rede Veiculos para verificar

### Passos do Teste

1. **Acessar o sistema como administrador**
2. **Navegar para Cadastro > Associados**
3. **Localizar associado com veiculo/rastreador Rede Veiculos**
4. **Clicar em "Cancelar Associado"**
5. **Verificar no banco:**
   - `rastreadores.status = 'estoque'`
   - `rastreadores.veiculo_id = null`
   - `rastreadores_api_logs` com registro de desvinculacao
6. **Verificar na plataforma Rede Veiculos:**
   - Equipamento nao mais vinculado ao cliente
   - Cliente/veiculo desassociado

### Resultado Esperado

- Equipamento aparece no estoque do SGA
- Equipamento desvinculado na plataforma Rede Veiculos
- Log de auditoria registrado
- Equipamento disponivel para nova instalacao

---

## Consideracoes Finais

**IMPORTANTE:** Antes de implementar, e necessario confirmar com a documentacao da API Rede Veiculos:

1. **URL exata do endpoint:** `POST /desvincularClienteVeiculo` ou similar
2. **Formato do payload:** Campos obrigatorios e opcionais
3. **Codigos de resposta:** Sucesso, erros possiveis
4. **Comportamento esperado:** O equipamento fica liberado ou precisa de acao adicional?

**Recomendacao:** Solicitar documentacao oficial da API Rede Veiculos antes de iniciar a implementacao.
