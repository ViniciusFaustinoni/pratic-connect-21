
# Auto-atualizar pagina ao detectar assinatura

## Problema
O polling que verifica a assinatura so roda dentro do modal (`OSConclusaoModal`). Porem, apos enviar o termo, o modal fecha (`onOpenChange(false)`). A pagina de detalhe usa `useOrdemServico` que e um `useQuery` sem `refetchInterval`, entao **nunca re-busca os dados** e a pagina fica parada mostrando "Concluido" em vez de "Pendente de Assinatura" -> "Finalizado".

## Solucao

### 1. Adicionar polling na pagina de detalhe (`OrdemServicoDetalhe.tsx`)

Quando o status da OS for `pendente_assinatura`, ativar um `refetchInterval` no `useOrdemServico` para verificar a cada 10 segundos se `termo_saida_assinado` mudou para `true`. Quando detectar a assinatura, a pagina atualiza automaticamente (badge, botoes, historico).

### 2. Modificar `useOrdemServico` no hook (`useOrdensServico.ts`)

Adicionar um parametro opcional `refetchInterval` ao hook para que a pagina possa controlar quando ativar o polling:

```
useOrdemServico(id, { refetchInterval: os?.status === 'pendente_assinatura' ? 10000 : false })
```

Como o hook precisa do resultado para decidir o intervalo, a abordagem mais simples e usar `refetchInterval` como funcao no proprio hook: se o dado retornado tiver `status === 'pendente_assinatura'` e `termo_saida_assinado === false`, refetch a cada 10s. Caso contrario, sem polling.

### Mudanca tecnica

**Arquivo: `src/hooks/useOrdensServico.ts`** (funcao `useOrdemServico`)
- Adicionar `refetchInterval` como funcao que verifica o status do dado retornado:

```typescript
refetchInterval: (query) => {
  const data = query.state.data;
  if (data && data.status === 'pendente_assinatura' && !data.termo_saida_assinado) {
    return 10000; // 10s
  }
  return false;
},
```

Isso garante:
- Polling automatico SOMENTE quando OS esta pendente de assinatura
- Para de fazer polling assim que detectar a assinatura ou status mudar
- Nenhuma mudanca necessaria na pagina de detalhe - o hook se auto-gerencia

### Arquivo alterado
- `src/hooks/useOrdensServico.ts` - adicionar `refetchInterval` dinamico ao `useOrdemServico`
