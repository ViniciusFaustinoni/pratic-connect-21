

## Plano: Remover blocos de assinatura manual dos aditivos

### Causa raiz

Em `supabase/functions/_shared/template-utils.ts`, a função `buscarEGerarAditivos` (linhas 1197-1203) injeta um bloco de assinatura manual em **cada aditivo**:

```
Local: _________________ Data: ____/____/____
_________________________________________
Assinatura do Associado
```

Este bloco é hardcoded no código, não vem do template do banco. A sanitização parcialmente o remove (underscores e "Assinatura do Associado"), mas a linha `Local: ___ Data: ___` e o `<div>` wrapper sobrevivem. Além disso, os templates do banco ainda podem conter `NOME — CPF:` que aparece depois da substituição de variáveis.

### Alterações

**1. `supabase/functions/_shared/template-utils.ts` — remover bloco de assinatura dos aditivos**

Remover as linhas 1197-1203 (o `<div>` com Local/Data, underscores e "Assinatura do Associado") da função `buscarEGerarAditivos`. A assinatura é feita pela Autentique, não precisa de bloco manual.

O trecho ficará apenas:
```
  ${conteudo}
</div>
```

**2. `supabase/functions/_shared/template-utils.ts` — reforçar sanitização**

Adicionar regra para capturar `<p>` com `Local:` seguido de underscores e `Data:` (padrão `Local: ___ Data: ___`), como fallback caso algum template do banco contenha este padrão.

**3. Deploy das edge functions**

Fazer deploy de `autentique-create` e `autentique-create-by-token` para que a correção entre em produção.

### Resultado esperado
- Nenhum bloco manual de assinatura aparecerá nos aditivos
- A Autentique continua gerenciando rubrica (INITIALS) e assinatura (SIGNATURE) digitalmente
- O documento final não terá "Local: ___" nem "Nome — CPF" residuais

