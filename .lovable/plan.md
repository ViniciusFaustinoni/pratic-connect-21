
# Plano: Corrigir Erro "Serviço não encontrado" na Execução de Instalação

## Diagnóstico do Problema

O erro ocorre porque a consulta em `useServicoDetalhes` está tentando selecionar a coluna `tipo_veiculo` da tabela `veiculos`, mas essa coluna **não existe**.

### Evidência

**Request que falha:**
```
GET /rest/v1/servicos?select=*,veiculos:veiculo_id(id,...,tipo_veiculo)
Status: 400
Response: {"code":"42703","message":"column veiculos_1.tipo_veiculo does not exist"}
```

### Colunas disponíveis na tabela `veiculos`:

| Coluna Existente | Coluna Requisitada |
|------------------|-------------------|
| id | id |
| marca | marca |
| modelo | modelo |
| placa | placa |
| ano_modelo | ano_modelo |
| ano_fabricacao | ano_fabricacao |
| cor | cor |
| chassi | chassi |
| renavam | renavam |
| valor_fipe | valor_fipe |
| combustivel | - |
| - | **tipo_veiculo** (NAO EXISTE) |

## Correção Necessária

### Arquivo: `src/hooks/useServicos.ts`

Remover a coluna inexistente `tipo_veiculo` da query.

**Alteração na função `useServicoDetalhes` (linha ~751):**

```typescript
// ANTES
veiculos:veiculo_id (
  id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, tipo_veiculo
)

// DEPOIS
veiculos:veiculo_id (
  id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, combustivel
)
```

**NOTA:** A coluna `combustivel` existe e pode ser usada para detectar tipo de veículo (moto/carro) se necessário.

### Também verificar fallback na tabela `instalacoes` (linha ~773)

A mesma correção deve ser aplicada no fallback:

```typescript
// ANTES
veiculos (id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, tipo_veiculo)

// DEPOIS
veiculos (id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, combustivel)
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useServicos.ts` | Remover `tipo_veiculo` da query em 2 locais |

## Impacto

### Componente `InstaladorChecklist.tsx`

O componente usa `tipo_veiculo` para detectar tipo de veículo:

```typescript
const tipoVeiculo: TipoVeiculo = useMemo(() => {
  const veiculoData = servico?.veiculos as { tipo_veiculo?: string } | undefined;
  return detectarTipoVeiculo(veiculoData?.tipo_veiculo);  // <-- Usa tipo_veiculo
}, [servico?.veiculos]);
```

**Ajuste necessário:** Usar `combustivel` como fallback para detecção ou deixar como `undefined` (a função `detectarTipoVeiculo` já trata isso retornando 'automovel' como padrão).

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│  BUSCA DE SERVIÇO PARA EXECUÇÃO (CORRIGIDO)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Clica "Executar Instalação"                                 │
│     └─> Navigate para /instalador/instalacao/:id                │
│                                                                 │
│  2. useServicoDetalhes(id)                                      │
│     ├─> SELECT * FROM servicos WHERE id = :id                   │
│     ├─> JOIN veiculos (sem tipo_veiculo)                        │
│     └─> Retorna dados corretamente                              │
│                                                                 │
│  3. InstaladorChecklist renderiza                               │
│     ├─> Exibe dados do veículo                                  │
│     ├─> detectarTipoVeiculo() retorna 'automovel' (padrão)      │
│     └─> Checklist funciona normalmente                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Resumo

| Problema | Causa | Solução |
|----------|-------|---------|
| "Serviço não encontrado" | Query solicita coluna `tipo_veiculo` que não existe | Remover coluna da query |

## Alterações no Código

### `src/hooks/useServicos.ts` - Linha ~750-751

```typescript
// ANTES
veiculos:veiculo_id (
  id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, tipo_veiculo
)

// DEPOIS
veiculos:veiculo_id (
  id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, combustivel
)
```

### `src/hooks/useServicos.ts` - Linha ~773

```typescript
// ANTES  
veiculos (id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, tipo_veiculo)

// DEPOIS
veiculos (id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, combustivel)
```
