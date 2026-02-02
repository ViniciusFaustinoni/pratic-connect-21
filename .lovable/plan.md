
# Plano: Adicionar Botão de Atualizar Localização no Card de Veículo

## Contexto

Na tela de "Veículos em Tempo Real", cada card de veículo deve ter um botão para atualizar a localização daquele veículo específico, buscando posição em tempo real da API do rastreador (Softruck/Rede Veículos).

## Solução

### 1. Adicionar Mutation para Atualização Individual

Criar uma mutation usando a Edge Function `rastreador-posicao` já existente para buscar posição em tempo real de um rastreador específico:

```typescript
const atualizarPosicao = useMutation({
  mutationFn: async (rastreadorId: string) => {
    const { data, error } = await supabase.functions.invoke('rastreador-posicao', {
      body: { rastreador_id: rastreadorId }
    });
    if (error || !data.success) throw new Error(data?.error || 'Erro');
    return data;
  },
  onSuccess: () => {
    refetch(); // Recarrega lista de veículos
    toast.success('Posição atualizada!');
  }
});
```

### 2. Adicionar Botão no Card de Veículo

Adicionar um botão de refresh ao lado do botão de localizar no mapa:

```typescript
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8"
  onClick={(e) => {
    e.stopPropagation();
    atualizarPosicao.mutate(v.rastreador_id);
  }}
  disabled={atualizarPosicao.isPending}
>
  <RefreshCw className={`h-4 w-4 ${atualizarPosicao.isPending ? 'animate-spin' : ''}`} />
</Button>
```

### 3. Arquivo a Modificar

**Arquivo:** `src/pages/monitoramento/Mapa.tsx`

- Adicionar import `useMutation` do TanStack Query
- Adicionar import `RefreshCw` do Lucide
- Criar mutation `atualizarPosicao`
- Adicionar botão de refresh no card do veículo (linha ~377-389)

## Comportamento Esperado

1. Usuário clica no botão de refresh (ícone de seta circular) no card do veículo
2. Sistema chama a Edge Function `rastreador-posicao` para buscar posição em tempo real
3. Botão mostra animação de loading (gira)
4. Posição é atualizada no banco de dados
5. Lista de veículos é recarregada automaticamente
6. Toast de sucesso é exibido

## Detalhes Técnicos

A Edge Function `rastreador-posicao` já existe e:
- Busca posição em tempo real via API da plataforma (Softruck/Rede Veículos)
- Atualiza `rastreadores.ultima_posicao_*` no banco
- Salva posição no histórico `rastreador_posicoes`
- Suporta retry automático em erros de autenticação
