# Plano para corrigir o sumiço recorrente de cotações na tela do consultor

## Diagnóstico confirmado
A cotação informada (`COT-20260427-160753911-031`) não sumiu por filtro visual nem por RLS.

O banco mostra que ela foi:
1. criada às 19:08,
2. excluída às 19:12,
3. recriada como uma nova cotação (`COT-20260427-161537806-513`) às 19:15,
4. excluída novamente às 19:21.

Os logs de auditoria provam isso:
- `Cotação COT-20260427-160753911-031 criada`
- `Cotação COT-20260427-160753911-031 excluída com cascata`
- `Cotação COT-20260427-161537806-513 criada`
- `Cotação COT-20260427-161537806-513 excluída com cascata`

Ou seja: a causa raiz é fluxo de exclusão/substituição de cotação, não o filtro da listagem.

## Causa provável no código
Hoje o sistema permite que a ação de duplicar/excluir remova a cotação original do banco via `delete-cotacao`.
Isso ocorre em pontos como:
- `src/hooks/useCotacoes.ts` (`useDuplicarCotacao`)
- `supabase/functions/delete-cotacao/index.ts`
- telas que disparam duplicação/substituição em `Cotacoes.tsx` e `CotacaoDetalhe.tsx`

Esse desenho é frágil porque transforma “corrigir uma cotação” em “apagar a original”. Resultado:
- a cotação some do consultor,
- o número original deixa de existir,
- o histórico fica quebrado para auditoria e suporte,
- o problema parece aleatório para o time comercial.

## Implementação proposta
### 1. Parar de apagar cotações como caminho padrão de correção
Alterar o fluxo de duplicação para que a original nunca seja removida em correções comuns.

Mudança:
- substituir o comportamento `acaoOriginal = 'excluir'` por um fluxo de “substituída/corrigida”, mantendo a cotação original no banco.
- a nova cotação continua sendo criada, mas a original fica marcada com rastreabilidade.

Resultado esperado:
- a cotação antiga não desaparece mais,
- o consultor e a diretoria conseguem auditar o encadeamento da correção,
- suporte não perde o número que o consultor copiou/compartilhou.

### 2. Introduzir status visual e regras claras para cotações substituídas
Ajustar a listagem para tratar a cotação original como registro histórico, não como item ativo “apagado”.

Mudança:
- exibir badge/estado de “Substituída” quando houver `substituida_por_cotacao_id`;
- remover ações indevidas na original substituída;
- manter a duplicata como a cotação operacional ativa.

Resultado esperado:
- a tela deixa de parecer inconsistente,
- o consultor entende por que aquela cotação antiga não deve mais ser usada,
- o número antigo continua pesquisável.

### 3. Bloquear exclusão destrutiva para cotações comerciais normais
Restringir o uso de exclusão física para cenários realmente administrativos/excepcionais.

Mudança:
- endurecer `useDuplicarCotacao` para nunca chamar `delete-cotacao` em duplicação comum;
- opcionalmente manter exclusão física só em ação explícita de diretoria/admin fora do fluxo de correção comercial;
- reforçar logs com motivo e vínculo entre original e duplicata.

Resultado esperado:
- elimina a recorrência do problema “sumiu da tela”;
- reduz perdas acidentais de histórico;
- mantém trilha de auditoria íntegra.

### 4. Corrigir a experiência da listagem do consultor
Ajustar os componentes da lista para refletirem o novo modelo.

Mudança:
- revisar `Cotacoes.tsx`, `CotacaoCard.tsx`, `CotacoesTable.tsx` e `CotacoesMobileList.tsx`;
- garantir que registros substituídos possam ser encontrados por número/placa/nome;
- decidir se ficam visíveis por padrão com badge ou em filtro específico, mas sem desaparecer do banco.

Resultado esperado:
- o consultor continua encontrando a cotação informada mesmo após uma correção;
- a diretoria consegue conferir o histórico completo.

### 5. Validar com consulta real e teste manual
Depois da implementação:
- criar/duplicar uma cotação de teste,
- confirmar no banco que a original permaneceu,
- entrar como diretor e validar a listagem,
- pesquisar pelo número original e pelo novo,
- confirmar que nenhuma das duas some por exclusão automática.

## Arquivos mais prováveis de ajuste
- `src/hooks/useCotacoes.ts`
- `src/pages/vendas/Cotacoes.tsx`
- `src/pages/vendas/CotacaoDetalhe.tsx`
- `src/components/cotacoes/DuplicarCotacaoDialog.tsx`
- `src/components/cotacoes/CotacaoCard.tsx`
- `src/components/cotacoes/CotacoesTable.tsx`
- `src/components/cotacoes/CotacoesMobileList.tsx`
- possivelmente `supabase/functions/delete-cotacao/index.ts` se for necessário restringir o uso do delete físico

## Detalhes técnicos
```text
Hoje:
Correção -> duplicar -> excluir original -> número some do banco

Depois:
Correção -> duplicar -> original marcada como substituída -> número continua pesquisável
```

Regras da correção:
- manter `cotacoes.vendedor_id` intacto na original;
- preencher `substituida_por_cotacao_id` e `motivo_substituicao`;
- impedir ações operacionais na cotação substituída;
- preservar auditoria e rastreabilidade.

## Observação importante
Também encontrei inconsistências históricas entre `profile.id` e `auth.user.id` em partes do módulo comercial, mas esse caso específico não foi causado por isso. O caso do Moacir foi exclusão real no banco. Se quiser, depois desta correção eu posso abrir uma segunda frente para sanear definitivamente essas inconsistências de IDs no módulo comercial.