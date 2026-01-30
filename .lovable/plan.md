
# Correção: Mensagem de Erro Clara para Veículo com Status Não-Ativo

## Diagnóstico

O erro ao criar sinistro de roubo/furto **não está relacionado às mudanças no wizard**. A causa real é:

```
ERROR [criar-sinistro] Veículo não está ativo: instalacao_pendente
```

O veículo selecionado (`f14d8be0-1964-4cc0-ba4c-1963aba54fa1`) está com status `instalacao_pendente`, e a edge function valida corretamente que apenas veículos **ativos** podem ter sinistros registrados.

## Problema de UX

A mensagem de erro retornada ao frontend não está sendo exibida de forma clara ao usuário. O toast mostra apenas "Erro ao enviar sinistro. Tente novamente." em vez da mensagem real do backend.

## Solução

Melhorar a exibição da mensagem de erro e traduzir o status do veículo para linguagem amigável:

### 1. `supabase/functions/criar-sinistro/index.ts`

Melhorar a mensagem de erro quando veículo não está ativo:

```typescript
// Antes (linha 290-299):
if (veiculo.status !== 'ativo') {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: `Este veículo não está ativo (status: ${veiculo.status}). Entre em contato com a central.` 
    }),
    ...
  );
}

// Depois:
if (veiculo.status !== 'ativo') {
  const statusLabels: Record<string, string> = {
    instalacao_pendente: 'aguardando instalação do rastreador',
    inativo: 'inativo',
    cancelado: 'cancelado',
    bloqueado: 'bloqueado',
  };
  const statusLabel = statusLabels[veiculo.status] || veiculo.status;
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: `Não é possível registrar sinistro: veículo ${statusLabel}. Entre em contato com a central.` 
    }),
    ...
  );
}
```

### 2. `src/pages/app/AppSinistroNovo.tsx` e `src/pages/app/NovoSinistro.tsx`

Garantir que a mensagem de erro do backend seja exibida ao usuário:

```typescript
// Verificar se o toast já exibe a mensagem correta
// O hook useSinistros já faz isso, mas verificar se está propagando corretamente
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/criar-sinistro/index.ts` | Melhorar mensagem de erro com labels amigáveis |

## Nota sobre o Teste

O veículo usado no teste (`MARCUS VINICIUS FAUSTINONI DE FREITAS`) está com status `instalacao_pendente` - isso significa que ainda não teve o rastreador instalado. Para testar a criação de sinistro com sucesso, será necessário:

1. Usar um veículo que tenha status `ativo`, **ou**
2. Alterar o status do veículo para `ativo` no banco de dados

## Tempo Estimado

~5 minutos
