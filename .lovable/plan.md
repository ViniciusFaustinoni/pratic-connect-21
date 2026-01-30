
# Plano: Impedimento de Duplicidade de Placa em Cotações

## Resumo

Implementar uma validação que impede um vendedor de criar cotação para uma placa que já está sendo atendida por outro consultor, exibindo um alerta pop-up com informações do responsável atual.

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| Bloqueio de duplicidade | Se a placa já existe em cotação ativa de outro vendedor, bloquear |
| Cotações ativas | Status: `rascunho`, `enviada`, `aceita` (não expiradas) |
| Período de validade | Cotações com menos de 7 dias da criação |
| Mesmo vendedor | Permitir que o mesmo vendedor crie nova cotação (com aviso informativo) |
| Cotações fechadas | Placas de cotações `recusada` ou `expirada` ficam livres |

## Dados Exibidos no Alerta

Quando houver conflito, o modal exibirá:
- Aviso: "Esta placa já está vinculada a outro consultor"
- Nome do consultor responsável
- Data e hora do cadastro original
- Número da cotação existente

## Componentes da Solução

### 1. Novo Hook: `useVerificarPlaca.ts`

Hook para verificar duplicidade de placa antes de criar cotação.

```typescript
// src/hooks/useVerificarPlaca.ts

interface PlacaDuplicadaInfo {
  cotacaoId: string;
  numero: string;
  vendedorId: string;
  vendedorNome: string;
  createdAt: string;
  status: string;
}

export function useVerificarPlacaDuplicada() {
  return useMutation({
    mutationFn: async (placa: string): Promise<PlacaDuplicadaInfo | null> => {
      // Buscar cotações ativas com essa placa nos últimos 7 dias
      // Status: rascunho, enviada, aceita
      // Retornar dados do vendedor responsável se existir
    }
  });
}
```

### 2. Novo Componente: `PlacaDuplicadaModal.tsx`

Modal de alerta com:
- Ícone de alerta vermelho
- Mensagem clara de bloqueio
- Dados do vendedor responsável (nome)
- Data/hora do cadastro original
- Número da cotação
- Botão "Entendido" para fechar

### 3. Integração no Cotador

Modificar `src/pages/vendas/Cotador.tsx`:

Na função `handleBuscarPlaca` (após encontrar veículo):
1. Chamar `verificarPlacaDuplicada(placa)`
2. Obter `profile.id` do usuário atual via auth
3. Se retornar dados e `vendedor_id !== profile.id` → Exibir modal e bloquear
4. Se retornar dados do mesmo vendedor → Exibir toast informativo
5. Se não retornar → Prosseguir normalmente

### 4. Integração no CotacaoFormDialog

Modificar `src/components/cotacoes/CotacaoFormDialog.tsx`:

Na função `buscarPorPlaca` (após encontrar veículo):
1. Aplicar a mesma lógica de verificação
2. Bloquear avanço se placa duplicada de outro vendedor

## Fluxo Visual do Modal

```text
┌─────────────────────────────────────────────────┐
│  ⚠️  PLACA JÁ EM ATENDIMENTO                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  A placa ABC-1234 já está vinculada a outro     │
│  consultor e não pode ser utilizada para uma    │
│  nova cotação no momento.                       │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Consultor: João Silva                     │  │
│  │ Cotação: COT-20260130-001                 │  │
│  │ Cadastrada em: 29/01/2026 às 14:32       │  │
│  │ Status: Enviada                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Para atender este cliente, entre em contato    │
│  com o consultor responsável.                   │
│                                                 │
│                           [ Entendido ]         │
└─────────────────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useVerificarPlaca.ts` | **Criar** - Hook de verificação de placa |
| `src/components/cotacoes/PlacaDuplicadaModal.tsx` | **Criar** - Modal de alerta |
| `src/pages/vendas/Cotador.tsx` | Adicionar verificação em `handleBuscarPlaca` |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Adicionar verificação em `buscarPorPlaca` |

## Casos de Uso

| Cenário | Comportamento |
|---------|---------------|
| Placa nova (sem cotação) | Prossegue normalmente |
| Placa com cotação do mesmo vendedor | Toast informativo, permite continuar |
| Placa com cotação de outro vendedor (ativa) | **Bloqueia** e exibe modal |
| Placa com cotação expirada (>7 dias) | Prossegue normalmente |
| Placa com cotação recusada | Prossegue normalmente |

## Detalhes Técnicos

### Consulta SQL da Verificação

```sql
SELECT 
  c.id, c.numero, c.vendedor_id, c.created_at, c.status,
  p.nome as vendedor_nome
FROM cotacoes c
LEFT JOIN profiles p ON c.vendedor_id = p.id
WHERE c.veiculo_placa = '<PLACA_NORMALIZADA>'
  AND c.status IN ('rascunho', 'enviada', 'aceita')
  AND c.created_at >= NOW() - INTERVAL '7 days'
ORDER BY c.created_at DESC
LIMIT 1;
```

### Obtenção do Vendedor Atual

Utilizando o AuthContext existente:
```typescript
const { profile } = useAuth();
const vendedorAtualId = profile?.id;
```

### Comparação de Vendedores

```typescript
if (cotacaoExistente && cotacaoExistente.vendedorId !== vendedorAtualId) {
  // Bloquear e mostrar modal
  setPlacaDuplicada(cotacaoExistente);
  setShowPlacaDuplicadaModal(true);
} else if (cotacaoExistente) {
  // Mesmo vendedor - apenas informar
  toast.info(`Você já possui uma cotação ativa para esta placa: ${cotacaoExistente.numero}`);
}
```

## Benefícios

1. **Evita conflitos comerciais** - Cada cliente é atendido por apenas um consultor
2. **Transparência** - O vendedor sabe exatamente quem está responsável
3. **Organização do funil** - Evita duplicidade de trabalho
4. **Rastreabilidade** - Mantém histórico claro de responsabilidades
