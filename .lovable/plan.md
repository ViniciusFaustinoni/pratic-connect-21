

# Plano: Correção da Integração Softruck

## Resumo dos Erros

A API Softruck está rejeitando a criação de veículos com 3 erros de validação:

| Campo | Valor Enviado | Valor Correto |
|-------|---------------|---------------|
| `type` | `carro` (PT) | `car` (EN) |
| `color` | `Azul` (texto) | `#2196F3` (hex) |
| `enterprise.id` | UUID 36 chars | `oydMqwmvgeLJ1kB` |

## Correções Necessárias

### 1. Enterprise ID Fixo

O Enterprise ID será **sempre** `oydMqwmvgeLJ1kB` (hardcoded nas Edge Functions).

Isso elimina a dependência do secret `SOFTRUCK_ENTERPRISE_ID` e garante consistência.

### 2. Mapeamento de Tipo de Veículo (PT → EN)

**Arquivo:** `supabase/functions/softruck-api/index.ts`

```typescript
function mapVehicleType(combustivel: string | null): string {
  const mapping: Record<string, string> = {
    'gasolina': 'car',
    'etanol': 'car',
    'flex': 'car',
    'diesel': 'truck',
    'eletrico': 'car',
    'hibrido': 'car',
    'gnv': 'car',
    'carro': 'car',
    'caminhao': 'truck',
    'moto': 'motorcycle',
  };
  return mapping[combustivel?.toLowerCase() || ''] || 'car';
}
```

### 3. Mapeamento de Cores (Texto → Hexadecimal)

**Arquivo:** `supabase/functions/softruck-api/index.ts`

```typescript
const SOFTRUCK_COLORS: Record<string, string> = {
  'branco': '#FFFFFF',
  'preto': '#212121',
  'prata': '#9E9E9E',
  'cinza': '#9E9E9E',
  'vermelho': '#FF5722',
  'azul': '#2196F3',
  'verde': '#8BC34A',
  'amarelo': '#FFC107',
  'laranja': '#FF9800',
  'marrom': '#795548',
  'bege': '#E1C699',
  'rosa': '#F8BBD0',
  'roxo': '#9C27B0',
  'vinho': '#C2185B',
  'dourado': '#FFC107',
  'champagne': '#E1C699',
};

function mapVehicleColor(cor: string | null): string {
  if (!cor) return '#9E9E9E';
  const normalized = cor.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SOFTRUCK_COLORS[normalized] || '#9E9E9E';
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/softruck-api/index.ts` | Corrigir mapeamentos e usar Enterprise ID fixo |
| `supabase/functions/softruck-ativar-dispositivo/index.ts` | Corrigir mapeamentos e usar Enterprise ID fixo |
| `src/types/softruck.ts` | Atualizar constantes para valores em inglês |

## Detalhes das Alterações

### Arquivo: `supabase/functions/softruck-api/index.ts`

**Alteração 1** - Substituir mapeamento de tipo (linha ~192-203):

```typescript
function mapVehicleType(combustivel: string | null): string {
  const mapping: Record<string, string> = {
    'gasolina': 'car',
    'etanol': 'car',
    'flex': 'car',
    'diesel': 'truck',
    'eletrico': 'car',
    'hibrido': 'car',
    'gnv': 'car',
    'carro': 'car',
    'caminhao': 'truck',
    'caminhão': 'truck',
    'moto': 'motorcycle',
    'motocicleta': 'motorcycle',
  };
  return mapping[combustivel?.toLowerCase() || ''] || 'car';
}
```

**Alteração 2** - Adicionar mapeamento de cor:

```typescript
const SOFTRUCK_COLORS: Record<string, string> = {
  'branco': '#FFFFFF',
  'preto': '#212121',
  'prata': '#9E9E9E',
  'cinza': '#9E9E9E',
  'vermelho': '#FF5722',
  'azul': '#2196F3',
  'verde': '#8BC34A',
  'amarelo': '#FFC107',
  'laranja': '#FF9800',
  'marrom': '#795548',
  'bege': '#E1C699',
  'rosa': '#F8BBD0',
  'roxo': '#9C27B0',
  'vinho': '#C2185B',
  'dourado': '#FFC107',
  'champagne': '#E1C699',
};

function mapVehicleColor(cor: string | null): string {
  if (!cor) return '#9E9E9E';
  if (/^#[0-9A-Fa-f]{6}$/.test(cor)) return cor.toUpperCase();
  const normalized = cor.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SOFTRUCK_COLORS[normalized] || '#9E9E9E';
}
```

**Alteração 3** - Usar Enterprise ID fixo na criação de veículo:

```typescript
// Substituir qualquer referência a enterpriseId dinâmico por:
const SOFTRUCK_ENTERPRISE_ID = 'oydMqwmvgeLJ1kB';
```

**Alteração 4** - Usar `mapVehicleColor` na criação de veículo:

```typescript
// ANTES
color: cor?.substring(0, 7),

// DEPOIS  
color: mapVehicleColor(cor),
```

### Arquivo: `supabase/functions/softruck-ativar-dispositivo/index.ts`

**Mesmas alterações:**
- Corrigir `mapVehicleType` para retornar valores em inglês
- Adicionar `mapVehicleColor` para converter cores
- Usar Enterprise ID fixo: `oydMqwmvgeLJ1kB`

### Arquivo: `src/types/softruck.ts`

Atualizar constantes para refletir valores corretos:

```typescript
export const SOFTRUCK_VEHICLE_TYPES = [
  'car', 'utility', 'van', 'scooter', 'motorcycle', 
  'tricycle', 'quadricycle', 'pickup truck', 'truck', 
  'bus', 'micro bus', 'other', 'implement', 
  'agricultural machine', 'tractor truck', 'tractor'
] as const;

export const COMBUSTIVEL_TO_VEHICLE_TYPE: Record<string, string> = {
  'gasolina': 'car',
  'etanol': 'car',
  'flex': 'car',
  'diesel': 'truck',
  'eletrico': 'car',
  'hibrido': 'car',
  'gnv': 'car',
};
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│  CRIAÇÃO DE VEÍCULO NA SOFTRUCK (CORRIGIDO)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Recebe dados do veículo local                               │
│     └─> { placa: "LTB4J74", cor: "Azul", combustivel: null }    │
│                                                                 │
│  2. Aplica mapeamentos corrigidos                               │
│     ├─> tipo: "car" (padrão em inglês) ✅                       │
│     ├─> cor: "#2196F3" (azul → hex) ✅                          │
│     └─> enterpriseId: "oydMqwmvgeLJ1kB" (fixo) ✅               │
│                                                                 │
│  3. Envia para API Softruck                                     │
│     └─> POST /v2/vehicles → 201 Created ✅                      │
│                                                                 │
│  4. Continua fluxo de ativação                                  │
│     └─> Cria device, associa, ativa ✅                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tabela de Mapeamentos

### Tipos de Veículo

| Português/Combustível | Inglês (API) |
|-----------------------|--------------|
| gasolina, etanol, flex, elétrico, híbrido, gnv | car |
| diesel, caminhão | truck |
| moto, motocicleta | motorcycle |
| (padrão) | car |

### Cores

| Português | Hexadecimal |
|-----------|-------------|
| Branco | #FFFFFF |
| Preto | #212121 |
| Prata/Cinza | #9E9E9E |
| Vermelho | #FF5722 |
| Azul | #2196F3 |
| Verde | #8BC34A |
| Amarelo | #FFC107 |
| Laranja | #FF9800 |
| Marrom | #795548 |
| Bege/Champagne | #E1C699 |
| Rosa | #F8BBD0 |
| Roxo | #9C27B0 |
| Vinho | #C2185B |
| Dourado | #FFC107 |
| (padrão) | #9E9E9E |

## Resumo

| Item | Valor |
|------|-------|
| **Enterprise ID** | `oydMqwmvgeLJ1kB` (fixo, hardcoded) |
| **Tipo padrão** | `car` (em inglês) |
| **Cor padrão** | `#9E9E9E` (cinza) |
| **Arquivos modificados** | 3 |

