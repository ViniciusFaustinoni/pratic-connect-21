
# Plano: Corrigir Atribuição de Vistoriador

## Problemas Identificados

### 1. Função `handleSaveAtribuicao` não implementada
A função no arquivo `src/pages/monitoramento/FilaVistorias.tsx` está marcada como **TODO**:
```typescript
const handleSaveAtribuicao = async (vistoriadorId: string) => {
  // TODO: Implementar mutação real para salvar no banco
  console.log('Atribuição vistoriador:', vistoriadorId);
  toast.success('Vistoriador atribuído com sucesso!');
  setAtribuirModalOpen(false);
};
```
O sistema apenas mostra o toast de sucesso, mas **não salva nada** no banco.

### 2. Query com status inválido
No arquivo `src/components/monitoramento/AtribuirVistoriadorModal.tsx`, a query de contagem de tarefas usa `"recusada"`:
```typescript
.not('status', 'in', '("cancelada","recusada")');
```

O enum `status_servico` **não tem `recusada`**. Os valores válidos são:
- pendente, agendada, em_rota, em_andamento, concluida, aprovada, reprovada, aprovada_ressalvas, em_analise, reagendada, cancelada

Isso causa um erro 400 na requisição, impedindo a contagem correta.

---

## Correções Necessárias

### Correção 1: Implementar `handleSaveAtribuicao`

**Arquivo:** `src/pages/monitoramento/FilaVistorias.tsx`

Substituir a função TODO por uma implementação real que:
1. Atualiza o `profissional_id` na tabela `servicos`
2. Muda o status para `agendada` (se estava `pendente`)
3. Invalida os caches de React Query
4. Mostra toast de sucesso apenas após confirmação do banco

```typescript
const handleSaveAtribuicao = async (vistoriadorId: string) => {
  if (!vistoriaParaAtribuir) return;
  
  try {
    // 1. Atualizar o serviço no banco
    const { error } = await supabase
      .from('servicos')
      .update({
        profissional_id: vistoriadorId,
        status: 'agendada', // Garantir que status é agendada
        updated_at: new Date().toISOString(),
      })
      .eq('id', vistoriaParaAtribuir.id);

    if (error) throw error;

    // 2. Invalidar cache para atualizar a lista
    queryClient.invalidateQueries({ queryKey: ['vistorias-fila'] });
    queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });

    // 3. Feedback de sucesso
    toast.success('Vistoriador atribuído com sucesso!');
    setAtribuirModalOpen(false);
  } catch (error) {
    console.error('Erro ao atribuir vistoriador:', error);
    toast.error('Erro ao atribuir vistoriador. Tente novamente.');
  }
};
```

### Correção 2: Corrigir status inválido na query

**Arquivo:** `src/components/monitoramento/AtribuirVistoriadorModal.tsx`

Substituir:
```typescript
.not('status', 'in', '("cancelada","recusada")');
```

Por:
```typescript
.not('status', 'in', '("cancelada","reprovada")');
```

Ou remover a filtragem por status e usar apenas:
```typescript
.not('status', 'eq', 'cancelada');
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/FilaVistorias.tsx` | Implementar `handleSaveAtribuicao` com update real no banco |
| `src/components/monitoramento/AtribuirVistoriadorModal.tsx` | Corrigir status `"recusada"` para `"reprovada"` |

---

## Resultado Esperado

Após as correções:
1. Ao selecionar um vistoriador e clicar "Confirmar Atribuição", o banco será atualizado
2. A coluna "Vistoriador" na lista mostrará o nome do profissional atribuído
3. A contagem de tarefas por dia funcionará corretamente
