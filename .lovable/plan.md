

## Diagnóstico

As KPIs estão zeradas no preview, mas **no banco existem 9.519 associados visíveis ao diretor** (9.496 ativos + 23 pendente vistoria). O código atual (`useAssociadosContagem` em `src/hooks/useAssociados.ts` linhas 249-285) está correto — faz count puro por status, sem filtro de origem. A RLS `is_funcionario(auth.uid())` libera tudo para staff e o usuário de teste tem `tipo='funcionario'` + role `diretor`.

### Por que está zerado na tela

O último deploy falhou — exatamente o erro que você colou agora:
```
dist upload failed: generate R2 credentials ... Client.Timeout
```

Então o navegador ainda está carregando a **versão antiga** do bundle, que tinha `.eq('origem_cadastro', 'interno')` nas queries. Como **100% dos 9.496 ativos são `api_externa`** (vindos da base Hinova), o filtro antigo zera tudo. Os 23 `interno` que aparecem no banco estão em `pendente_vistoria`, e o status `pendente_vistoria` nem é contado nas cards da tela — por isso "Em Análise = 0" também.

Conclusão: **o código já está corrigido, falta apenas o build subir**.

## Ação

Não há edição de código para fazer. Plano:

1. **Republicar**: usar o botão "Publish". O erro anterior foi timeout transitório do Cloudflare R2, não do código. Uma nova tentativa normalmente sobe.
2. **Após o build subir**, no preview: forçar hard-refresh (Ctrl+Shift+R ou abrir aba anônima). Os hooks já têm `refetchOnMount: 'always'` adicionados na última iteração, então o cache do React Query também será quebrado.
3. **Validar**: Total Geral deve mostrar ~9.519, Ativos ~9.496, e a busca por "WILLIAM" / placa "LSP3E65" deve retornar resultados.

## Se após republicar ainda ficar zerado

Aí sim é outro problema. Coisas a investigar (só se o sintoma persistir):
- Se existe Service Worker agressivo mantendo bundle em cache → desregistrar em DevTools → Application → Service Workers.
- Se a contagem `head:true` sem `*` está sendo bloqueada por alguma policy de coluna → testar alterar `select('*', {count:'exact',head:true})` para `select('id',{count:'exact',head:true})`.

Mas isso só se o republish não resolver. Neste momento, **só republicar**.

