

## Problema Identificado: Área do Cliente Não Atualiza ao Solicitar Documentos

### Diagnóstico

O código já implementa **Supabase Realtime** no hook `useCotacaoContratacao.ts` (linhas 189-232), escutando mudanças na tabela `documentos_solicitados`. Porém, a atualização automática não funciona porque:

| Componente | Status |
|------------|--------|
| Código de subscription Realtime | ✅ Implementado |
| Query de fallback com refetchInterval | ✅ 30 segundos |
| Tabela publicada no Realtime | ❌ **Não configurado** |

A consulta ao banco confirmou que `documentos_solicitados` **não está na publicação** `supabase_realtime`, então os eventos nunca chegam ao cliente.

### Solução

Adicionar a tabela `documentos_solicitados` à publicação Realtime do Supabase.

### Implementação

**SQL a executar (uma única query):**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.documentos_solicitados;
```

### Resultado Esperado

Após a alteração:

```
┌───────────────────────────────────────────────────────────────────────┐
│ ANALISTA                          │  CLIENTE                         │
├───────────────────────────────────┼──────────────────────────────────┤
│ Clica em "Solicitar Documentos"   │                                  │
│ ↓                                 │                                  │
│ INSERT em documentos_solicitados  │ → Realtime dispara callback      │
│                                   │ → refetchDocs() é chamado        │
│                                   │ → UI atualiza instantaneamente   │
└───────────────────────────────────┴──────────────────────────────────┘
```

### Fluxo Técnico

```
Analista solicita docs
        │
        ▼
┌────────────────────────┐
│ INSERT na tabela       │
│ documentos_solicitados │
└────────────────────────┘
        │
        ▼ (após ADD TABLE)
┌────────────────────────┐
│ Supabase Realtime      │
│ emite evento postgres_ │
│ changes                │
└────────────────────────┘
        │
        ▼
┌────────────────────────┐
│ Cliente recebe evento  │
│ useCotacaoContratacao  │
│ linha 197-208          │
└────────────────────────┘
        │
        ▼
┌────────────────────────┐
│ refetchDocs()          │
│ UI mostra docs         │
│ pendentes              │
└────────────────────────┘
```

### Impacto

- **Atualização instantânea**: A área do cliente exibirá os documentos solicitados em tempo real
- **Sem refresh manual**: O cliente não precisa recarregar a página
- **Experiência fluida**: Consistente com outras partes do sistema que já usam Realtime (associados, instalacoes)

### Observação Adicional

O código de fallback com `refetchInterval: 30000` (30 segundos) continuará funcionando como backup caso haja algum problema com a conexão WebSocket.

