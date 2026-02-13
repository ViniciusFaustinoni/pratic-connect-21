
# Adicionar polling automático em SinistroAnalise para detectar assinatura de termo

## Problema Identificado
A tela de análise de sinistro (`SinistroAnalise.tsx`) exibe um aviso "Aguardando assinatura do Termo de Entrada de Evento" quando `sinistro.autentique_documento_id` está preenchido mas `sinistro.termo_anuencia_assinado` é falso. Porém, não há polling automático para detectar quando o documento é assinado, então o diretor precisa recarregar manualmente a página para ver as ações desbloqueadas.

## Solução Proposta
Implementar polling automático similar ao encontrado em:
1. **`SinistroDetalhe.tsx`** (linhas 124-131): usa `queryClient.invalidateQueries` a cada 15s
2. **`PagamentoAdesao.tsx`** (linhas 50-78): usa query direta ao Supabase a cada 10s

Para `SinistroAnalise.tsx`, vou usar a abordagem mais simples e eficiente que já existe no projeto:

### Mudanças necessárias:

**1. Adicionar useEffect com polling em SinistroAnalise.tsx (logo após o componente ser carregado)**

O polling será ativado quando:
- `sinistro` está carregado
- `sinistro.autentique_documento_id` existe (documento foi enviado para assinatura)
- `sinistro.termo_anuencia_assinado === false` (ainda não foi assinado)

O polling será desativado quando:
- `sinistro.termo_anuencia_assinado === true` (assinatura detectada)
- Componente é desmontado

**2. Implementação do polling (em SinistroAnalise.tsx)**

```typescript
// Polling automático para detectar assinatura do termo
useEffect(() => {
  const aguardandoAssinatura = sinistro?.autentique_documento_id && !sinistro?.termo_anuencia_assinado;
  
  if (!aguardandoAssinatura) return;
  
  const interval = setInterval(() => {
    // Invalida a query principal que carrega o sinistro
    queryClient.invalidateQueries({ queryKey: ['sinistro-analise', id] });
  }, 10000); // 10 segundos
  
  return () => clearInterval(interval);
}, [sinistro?.autentique_documento_id, sinistro?.termo_anuencia_assinado, id, queryClient]);
```

**3. Imports necessários**
- Já existe `useQueryClient` importado em `useSinistroAnalise.ts`
- Precisa ser retornado pelo hook ou capturado através do `useQuery` do React Query

### Detalhes técnicos:

**Timing do polling**: 10 segundos
- Suficientemente rápido para UX aceitável
- Não causa throttling do Supabase (muito menos agressivo que conexões de chat real-time)
- Segue o padrão usado em `PagamentoAdesao.tsx`

**Critério de parada automática**: 
- O polling continua apenas enquanto `aguardandoAssinatura === true`
- Uma vez que `termo_anuencia_assinado` muda para `true`, o polling para automaticamente
- A interface atualiza com as ações desbloqueadas

**Realtime alternativo não usado**:
- Poderia usar Supabase Realtime (já subscrito em `useSinistroAnalise.ts` para documentos)
- Mas polling é mais simples e não adiciona complexidade
- Polling é padrão no projeto (PagamentoAdesao, SinistroDetalhe)

### Arquivos a modificar:

| Arquivo | Descrição |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar useEffect com polling automático (aprox. 8 linhas) |

### Fluxo visual após implementação:

```
1. Diretor abre tela de análise
   ↓
2. Sinistro aguarda assinatura do termo
   ↓
3. Polling iniciado (10s de intervalo)
   ↓
4. Associado assina pelo link público
   ↓
5. Polling detecta mudança em termo_anuencia_assinado (próximo ciclo)
   ↓
6. Interface atualiza automaticamente
   ↓
7. Botões "Aprovar" e "Reprovar" desbloqueiam
   ↓
8. Polling para (ou continua inerte já que condição está falsa)
```

### Benefícios:
- ✅ Sem necessidade de recarregar página
- ✅ Detecção automática em até 10 segundos
- ✅ Padrão já usado no projeto (consistente)
- ✅ Simples e sem overhead
- ✅ Limpo e sem polling desnecessário após assinatura
