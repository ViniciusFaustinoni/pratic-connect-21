
# Plano: Adicionar Status "Recusado" para Associados

## Problema Identificado

Na imagem enviada, o associado "Marcus Vinicius" aparece com status **"Suspenso"** mesmo tendo sido recusado durante o processo de vistoria ou análise de proposta. O status correto deveria ser **"Recusado"**.

### Causa Raiz

O valor `'recusado'` **NÃO existe** no sistema:

| Componente | Status Atual |
|------------|-------------|
| Enum `status_associado` no banco | Não inclui `'recusado'` |
| Tipo TypeScript `StatusAssociado` | Não inclui `'recusado'` |
| Labels `STATUS_ASSOCIADO_LABELS` | Não inclui `'recusado'` |
| Cores `statusColors` | Não inclui `'recusado'` |

Os hooks estão usando valores incorretos:
- `useRecusarVeiculoServico`: usa `'suspenso'`
- `useReprovarProposta`: usa `'reprovado' as any` (contornando a verificação de tipo)

---

## Solução Proposta

### 1. Adicionar Valor ao Enum do Banco de Dados

**Migração SQL:**

```sql
-- Adicionar 'recusado' ao enum status_associado
ALTER TYPE status_associado ADD VALUE IF NOT EXISTS 'recusado' AFTER 'bloqueado';
```

### 2. Atualizar Tipo TypeScript

**Arquivo:** `src/types/database.ts`

```typescript
export type StatusAssociado =
  | 'em_analise'
  | 'pendente_vistoria'
  | 'aprovado'
  | 'documentacao_pendente'
  | 'aguardando_instalacao'
  | 'ativo'
  | 'inadimplente'
  | 'suspenso'
  | 'cancelado'
  | 'bloqueado'
  | 'recusado';  // NOVO
```

### 3. Atualizar Labels

**Arquivo:** `src/types/database.ts`

```typescript
export const STATUS_ASSOCIADO_LABELS: Record<StatusAssociado, string> = {
  em_analise: 'Em Análise',
  pendente_vistoria: 'Pendente de Vistoria',
  aprovado: 'Aprovado',
  documentacao_pendente: 'Doc. Pendente',
  aguardando_instalacao: 'Aguard. Instalação',
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
  bloqueado: 'Bloqueado',
  recusado: 'Recusado',  // NOVO
};
```

### 4. Atualizar Cores na Página de Associados

**Arquivo:** `src/pages/cadastro/Associados.tsx`

```typescript
const statusColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-yellow-100 text-yellow-800',
  pendente_vistoria: 'bg-violet-100 text-violet-800',
  aprovado: 'bg-blue-100 text-blue-800',
  documentacao_pendente: 'bg-orange-100 text-orange-800',
  aguardando_instalacao: 'bg-purple-100 text-purple-800',
  ativo: 'bg-green-100 text-green-800',
  inadimplente: 'bg-orange-500 text-white',
  suspenso: 'bg-red-100 text-red-800',
  cancelado: 'bg-muted text-muted-foreground',
  bloqueado: 'bg-destructive text-destructive-foreground',
  recusado: 'bg-red-500 text-white',  // NOVO - vermelho forte
};
```

### 5. Atualizar Hook useRecusarVeiculoServico

**Arquivo:** `src/hooks/useServicos.ts`

Modificar linha 1156-1158:

```typescript
// Antes:
await supabase
  .from('associados')
  .update({
    status: 'suspenso',  // ERRADO
    updated_at: agora,
  })

// Depois:
await supabase
  .from('associados')
  .update({
    status: 'recusado',  // CORRETO
    updated_at: agora,
  })
```

### 6. Atualizar Hook useReprovarProposta

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

Modificar linha 1897:

```typescript
// Antes:
await supabase
  .from('associados')
  .update({
    status: 'reprovado' as any,  // HACK
  })

// Depois:
await supabase
  .from('associados')
  .update({
    status: 'recusado',  // CORRETO
  })
```

### 7. Atualizar Hook useRemoverBlacklist

**Arquivo:** `src/hooks/useBlacklist.ts`

Quando o diretor reverter uma recusa, o status volta para `'pendente_vistoria'` (não para `'em_analise'` de `'suspenso'`).

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Adicionar `'recusado'` ao enum `status_associado` |
| `src/types/database.ts` | Adicionar `'recusado'` ao tipo e labels |
| `src/pages/cadastro/Associados.tsx` | Adicionar cor para status `'recusado'` |
| `src/hooks/useServicos.ts` | Usar `'recusado'` em vez de `'suspenso'` |
| `src/hooks/usePropostasPendentes.ts` | Usar `'recusado'` em vez de `'reprovado' as any` |

---

## Resultado Esperado

| Tela | Antes | Depois |
|------|-------|--------|
| **Associados - Badge** | "Suspenso" (vermelho claro) | "Recusado" (vermelho forte) |
| **Associados - Filtro** | Não aparece "Recusado" | Filtro "Recusado" disponível |
| **Blacklist** | Associado com status "Suspenso" | Associado com status "Recusado" |

---

## Fluxo Completo Após Correção

```text
┌─────────────────────────────────────────────────────────────┐
│  Recusa por Vistoriador ou Analista de Cadastro             │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Veículo → status = 'recusado'                              │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Associado → status = 'recusado'                            │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Blacklist → veículo inserido                               │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Na Página de Associados:                                   │
│  Badge vermelho forte com texto "Recusado"                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Testes Recomendados

1. Verificar se o associado LTB4J74 agora aparece com status "Recusado"
2. Verificar se o filtro "Recusado" aparece no dropdown de status
3. Recusar uma nova proposta/vistoria e confirmar que o associado fica com status "Recusado"
