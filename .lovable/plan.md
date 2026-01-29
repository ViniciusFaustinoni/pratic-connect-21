
# Revisão Completa - Fluxo de Atualização de Dados do Veículo na Rede Veículos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /atualizarDadosVeiculo | **NAO EXISTE** | Não há edge function para atualização de dados do veículo |
| Atualização quando associado edita dados do veículo | **NAO IMPLEMENTADO** | Não existe tela de edição de veículo no sistema |
| Atualização quando há correção de informações FIPE | **NAO IMPLEMENTADO** | Apenas atualiza banco local |
| Atualização quando veículo é transferido para outro associado | **NAO IMPLEMENTADO** | Funcionalidade não existe |
| Atualização quando há correção de chassi/renavam | **NAO IMPLEMENTADO** | Apenas atualiza banco local |
| Dados corretos enviados para veículo específico | **NAO** | Nenhuma integração ativa |
| Identificador do veículo (placa/chassi) correto | **NAO** | Nenhuma integração ativa |
| Atualizações de valor FIPE refletem no sistema | **PARCIAL** | Atualiza apenas localmente |
| Histórico do veículo mantido após atualização | **SIM** | Via audit log local |

---

## Análise Detalhada

### 1. Estado Atual - Nenhuma Integração de Atualização de Veículo

A plataforma Rede Veículos possui os seguintes endpoints implementados:

| Endpoint | Edge Function | Status |
|----------|---------------|--------|
| POST /vincularClienteVeiculo | `rede-veiculos-vincular-cliente` | Implementado |
| POST /desvincularClienteVeiculo | `rede-veiculos-desvincular-cliente` | Implementado |
| POST /atualizarDadosCliente | `rede-veiculos-atualizar-cliente` | Implementado |
| **POST /atualizarDadosVeiculo** | **NAO EXISTE** | **Gap crítico** |

### 2. Comparação com Softruck

A Softruck possui operação de atualização de veículo na edge function `softruck-api`:

```typescript
// softruck-api/index.ts - operação: atualizar-veiculo
case 'atualizar-veiculo': {
  const { veiculoId, placa, chassi, marca, modelo, ano, cor, tipo } = data;
  
  // Monta payload apenas com campos informados
  if (placa) attrs.plate = placa;
  if (chassi) attrs.vin = chassi;
  if (marca) attrs.brand = marca;
  if (modelo) attrs.model = modelo;
  if (ano) attrs.year = ano;
  if (cor) attrs.color = cor;
  if (tipo) attrs.type = tipo;

  result = await softruckRequest('PATCH', `/v2/vehicles/${veiculoId}`, token, updateData);
}
```

**Rede Veículos: Nenhum equivalente implementado.**

### 3. Cenários Onde Deveria Chamar /atualizarDadosVeiculo

#### 3.1 Quando o Associado Atualiza Dados do Veículo

**Estado atual:** Não existe tela de edição de veículo no app do associado.

O arquivo `src/pages/app/AppPerfil.tsx` exibe os veículos do associado, mas **sem opção de edição**.

#### 3.2 Quando há Edição pelo Painel Administrativo

**Arquivo:** `src/pages/cadastro/AssociadoDetalhe.tsx` (linha 838-840)

```tsx
<Button size="sm" variant="outline">
  <Edit className="mr-2 h-4 w-4" /> Editar
</Button>
```

**Gap crítico:** O botão existe mas **não tem funcionalidade implementada** - é apenas visual.

#### 3.3 Quando há Correção de Informações FIPE

**Arquivo:** `src/components/contratos/ContratoWizard.tsx` (linhas 551-563)

```typescript
veiculo = await updateVeiculo.mutateAsync({
  id: veiculo.id,
  marca: data.marca,
  modelo: data.modelo,
  cor: data.cor,
  chassi: data.chassi,
  renavam: data.renavam,
  valor_fipe: data.valor_fipe,  // Atualiza FIPE localmente
});
```

**Gap:** Apenas atualiza banco local - Rede Veículos continua com dados antigos.

#### 3.4 Quando o Veículo é Transferido para Outro Associado

**Status:** Funcionalidade **NAO EXISTE** no sistema.

Não há processo para:
- Transferir veículo entre associados da mesma família
- Atualizar proprietário na plataforma
- Manter histórico de transferências

#### 3.5 Quando há Correção de Chassi/Renavam

**Hook atual:** `src/hooks/useVeiculos.ts` (linhas 101-126)

```typescript
export function useUpdateVeiculo() {
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('veiculos')
        .update(updates)
        .eq('id', id);
      // APENAS atualiza banco local
      // NAO notifica plataforma Rede Veículos
    },
  });
}
```

---

## Campos do Veículo na Tabela Local

```sql
-- Campos principais da tabela veiculos
id, associado_id, placa, chassi, renavam, marca, modelo,
ano_fabricacao, ano_modelo, cor, combustivel, valor_fipe,
codigo_fipe, ativo, status,
rede_veiculos_cliente_id,  -- ID do cliente na plataforma
rede_veiculos_veiculo_id   -- ID do veículo na plataforma
```

---

## Impactos dos Gaps

### Impacto 1: Dados de Veículo Dessincronizados

Quando a cor do veículo é corrigida no SGA:
- Banco local: cor atualizada
- Rede Veículos: cor antiga
- Consequência: Relatórios e alertas com informação errada

### Impacto 2: Valor FIPE Desatualizado

Quando o valor FIPE é atualizado (consulta mais recente):
- Sistema local pode ter valor correto
- Plataforma Rede Veículos tem valor da vinculação
- Consequência: Cobertura pode estar subvalorizada/supervalorizada

### Impacto 3: Placa Remarcada Não Atualizada

Quando veículo tem placa remarcada (transferência entre estados):
- Novo formato de placa não sincronizado
- Alertas podem não identificar veículo corretamente

### Impacto 4: Chassi/Renavam com Erro

Erros de digitação no chassi ou renavam:
- Podem causar problemas em acionamentos de roubo/furto
- Boletins de ocorrência com dados incorretos

---

## Plano de Implementação

### Fase 1: Criar Edge Function rede-veiculos-atualizar-veiculo

**Novo arquivo:** `supabase/functions/rede-veiculos-atualizar-veiculo/index.ts`

```typescript
interface RequestBody {
  veiculoId: string;
  camposAlterados: {
    placa?: string;        // Apenas em caso de remarcação
    marca?: string;
    modelo?: string;
    ano?: number;
    cor?: string;
    chassi?: string;       // Correção de erro
    renavam?: string;      // Correção de erro
    valorFipe?: number;    // Atualização de tabela
    codigoFipe?: string;
  };
}

// Fluxo:
// 1. Buscar veículo local com rede_veiculos_veiculo_id
// 2. Validar que há vínculo ativo na plataforma
// 3. Usar rede_veiculos_veiculo_id como identificador
// 4. Montar payload apenas com campos alterados
// 5. Chamar POST /atualizarDadosVeiculo na API Rede Veículos
// 6. Registrar log de atualização
```

**Payload esperado para API:**
```json
{
  "idVeiculo": 12345,
  "camposAlterados": {
    "cor": "BRANCO",
    "valorFipe": 85000.00
  }
}
```

### Fase 2: Criar Dialog de Edição de Veículo

**Novo arquivo:** `src/components/veiculos/VeiculoEditDialog.tsx`

Modal com campos editáveis:
- Cor (dropdown com cores padrão)
- Placa (bloqueado por padrão, liberado apenas com justificativa)
- Chassi (bloqueado por padrão, liberado apenas para correção)
- Renavam
- Valor FIPE (com botão para reconsulta)
- Código FIPE

### Fase 3: Integrar no Hook useUpdateVeiculo

**Modificar:** `src/hooks/useVeiculos.ts`

```typescript
export function useUpdateVeiculo() {
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      // 1. Buscar veículo atual para saber se tem vínculo Rede Veículos
      const { data: veiculoAtual } = await supabase
        .from('veiculos')
        .select('rede_veiculos_veiculo_id')
        .eq('id', id)
        .single();
      
      // 2. Atualizar banco local
      const { data, error } = await supabase
        .from('veiculos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      // 3. Se tem vínculo Rede Veículos, sincronizar
      if (veiculoAtual?.rede_veiculos_veiculo_id) {
        await supabase.functions.invoke('rede-veiculos-atualizar-veiculo', {
          body: {
            veiculoId: id,
            camposAlterados: updates,
          },
        });
      }
      
      return data;
    },
  });
}
```

### Fase 4: Criar Funcionalidade de Transferência de Veículo

**Novo arquivo:** `src/hooks/useTransferirVeiculo.ts`

```typescript
interface TransferirVeiculoParams {
  veiculoId: string;
  novoAssociadoId: string;
  motivoTransferencia: string;
}

export function useTransferirVeiculo() {
  return useMutation({
    mutationFn: async ({ veiculoId, novoAssociadoId, motivoTransferencia }) => {
      // 1. Buscar dados do novo associado
      // 2. Atualizar associado_id do veículo localmente
      // 3. Se tem Rede Veículos:
      //    a) Desvincular do cliente antigo
      //    b) Vincular ao cliente novo
      // 4. Registrar histórico de transferência
    },
  });
}
```

### Fase 5: Habilitar Botão de Edição no Painel

**Modificar:** `src/pages/cadastro/AssociadoDetalhe.tsx`

```tsx
// Adicionar estado para controlar modal
const [veiculoEditar, setVeiculoEditar] = useState<Veiculo | null>(null);

// Modificar botão existente (linha ~838)
<Button 
  size="sm" 
  variant="outline"
  onClick={() => setVeiculoEditar(v)}
>
  <Edit className="mr-2 h-4 w-4" /> Editar
</Button>

// Adicionar modal
<VeiculoEditDialog
  open={!!veiculoEditar}
  onClose={() => setVeiculoEditar(null)}
  veiculo={veiculoEditar}
/>
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/rede-veiculos-atualizar-veiculo/index.ts` | Edge Function principal |
| `src/components/veiculos/VeiculoEditDialog.tsx` | Modal de edição |
| `src/hooks/useTransferirVeiculo.ts` | Hook para transferência |
| `src/components/veiculos/TransferirVeiculoDialog.tsx` | Modal de transferência |

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/hooks/useVeiculos.ts` | Integrar sincronização após update |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Conectar botão ao modal de edição |
| `src/components/cadastro/VeiculoDetalhesModal.tsx` | Adicionar aba de edição |
| `supabase/config.toml` | Registrar nova edge function |

---

## Payload Esperado para POST /atualizarDadosVeiculo

Baseado no padrão da API de vinculação:

```typescript
interface AtualizarDadosVeiculoRequest {
  // Identificador do veículo na plataforma (obrigatório)
  idVeiculo: number;  // rede_veiculos_veiculo_id
  
  // OU identificador alternativo
  placa?: string;
  chassi?: string;
  
  // Campos alteráveis
  camposAlterados: {
    // Dados básicos
    tipo?: 'carro' | 'moto' | 'caminhao' | 'van';
    marca?: string;
    modelo?: string;
    ano?: number;
    cor?: string;
    
    // Identificação (apenas correção)
    placa?: string;   // Remarcação
    chassi?: string;  // Erro digitação
    renavam?: string;
    
    // Valor
    valorFipe?: number;
    codigoFipe?: string;
  };
}
```

---

## Checklist de Verificação Pós-Implementação

- [ ] Edge function `rede-veiculos-atualizar-veiculo` criada
- [ ] Modal de edição de veículo implementado
- [ ] Botão "Editar" funcional na página do associado
- [ ] Ao atualizar cor, plataforma é sincronizada
- [ ] Ao atualizar placa (remarcação), plataforma é sincronizada
- [ ] Ao corrigir chassi/renavam, plataforma é sincronizada
- [ ] Ao atualizar valor FIPE, plataforma é sincronizada
- [ ] Funcionalidade de transferência implementada
- [ ] rede_veiculos_veiculo_id usado como identificador
- [ ] Apenas campos alterados são enviados
- [ ] Histórico do veículo mantido (audit log)
- [ ] Log de atualização registrado em `rastreadores_api_logs`

---

## Teste Recomendado: Atualização de Cor

### Pré-requisitos

1. Veículo ativo com rastreador Rede Veículos instalado
2. `rede_veiculos_veiculo_id` preenchido no banco
3. `REDE_VEICULOS_TOKEN` válido e configurado
4. Acesso ao painel da Rede Veículos para verificar

### Passos do Teste

1. **Acessar o sistema como administrador**
2. **Navegar para Cadastro > Associados > [Associado com veículo]**
3. **Na aba Veículos, clicar em "Editar"**
4. **Alterar a cor do veículo** de "PRATA" para "BRANCO"
5. **Salvar**
6. **Verificar no banco:**
   - `veiculos.cor = 'BRANCO'`
   - `rastreadores_api_logs` com registro de atualização
7. **Verificar na plataforma Rede Veículos:**
   - Veículo com cor atualizada

### Resultado Esperado

- Cor atualizada no SGA e na Rede Veículos simultaneamente
- Apenas campo `cor` enviado para API (não cadastro completo)
- Log de auditoria registrado
- Histórico do veículo mantido

---

## Considerações Finais

**IMPORTANTE:** Antes de implementar, é necessário confirmar com a documentação da API Rede Veículos:

1. **URL exata do endpoint:** `POST /atualizarDadosVeiculo` ou similar
2. **Campo identificador:** `idVeiculo` (numérico) ou `placa/chassi` (string)?
3. **Formato do payload:** Aceita campos parciais ou exige cadastro completo?
4. **Campos editáveis:** Quais campos podem ser alterados após vinculação?
5. **Restrições:** Placa pode ser alterada? Chassi pode ser corrigido?
6. **Valor FIPE:** Campo existe no cadastro do veículo na plataforma?

**Recomendação:** Solicitar documentação oficial da API Rede Veículos antes de iniciar a implementação.
