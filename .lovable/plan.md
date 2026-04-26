## Contexto e regra confirmada

- O motor `fn_gerar_comissoes_por_pagamento` já usa **uma única grade** — a do **vendedor** que originou a venda — e distribui as fatias para supervisor/gerente/agência via cadeia hierárquica. A grade pessoal de supervisores/gerentes nunca é consultada.
- Hoje a UI ainda permite escolher uma grade para qualquer usuário das 5 roles de vendas, o que é confuso e cria registros sem efeito.
- Verifiquei no banco: **0 atribuições ativas** existem hoje para supervisor/gerente — ou seja, não há limpeza de dados a fazer, só travar a entrada.

Quem pode ter grade própria: `vendedor_clt`, `vendedor_externo`, `agencia`. Quem **não pode**: `supervisor_vendas`, `gerente_comercial`.

Caso o usuário acumule papéis (ex.: vendedor_clt + supervisor_vendas), a grade continua permitida — porque ele ainda origina vendas como vendedor. O bloqueio só vale quando o usuário é **exclusivamente** supervisor e/ou gerente.

## Mudanças

### 1. Banco — guard rail definitivo

Migration adicionando uma trigger `BEFORE INSERT/UPDATE` em `usuario_grade_comissao` que rejeita atribuição quando o `user_id` (profile.id) tem apenas roles em (`supervisor_vendas`, `gerente_comercial`) e nenhuma role de origem de venda. Mensagem: "Supervisores/Gerentes não recebem grade própria — comissionam pela grade do vendedor que originou a venda."

Sem CHECK constraint (regra depende de outra tabela). Encerrar quaisquer atribuições ativas residuais para essas roles, por segurança (`UPDATE ... SET data_fim = now()`).

### 2. Hook `useAtribuicaoComissoes.ts`

Expor um helper `podeReceberGrade(roles)` derivado de:
```
podeReceberGrade = roles.some(r => r in ['vendedor_clt','vendedor_externo','agencia'])
```
e usar em todos os pontos abaixo.

### 3. Tela `AtribuicaoGrades.tsx`

- Coluna **Grade Atual**: para usuários sem permissão, exibir badge cinza “Não aplicável (recebe pela grade do vendedor)” em vez de “Sem grade”.
- Não contar esses usuários no alerta `totalSemGrade`.
- Manter botão de editar (eles ainda configuram hierarquia/observações), mas o modal vai esconder o campo de grade.

### 4. Modal `AtribuirGradeModal.tsx` e `EditarHierarquiaModal.tsx`

- Quando `!podeReceberGrade(linha.usuario.roles)`: ocultar todo o bloco “Grade aplicada”, mostrar um aviso curto explicando que supervisor/gerente comissiona pela grade do vendedor que originou a venda, e permitir apenas configurar hierarquia/observações.
- Quando `podeReceberGrade`: comportamento atual.
- No `handleSave`, só chamar `atribuirGrade.mutateAsync` se o usuário pode receber grade.

### 5. Detalhes técnicos adicionais

- Não mexer em `fn_atribuir_grade_usuario` — a trigger no INSERT já barra qualquer chamada indevida (UI, RPC ou SQL direto).
- Tipos: nenhuma mudança em `AtribuicaoLinha` necessária; a flag é derivada de `usuario.roles`.
- Sem migração de dados destrutiva — apenas encerramento (data_fim) das atribuições ativas residuais (se aparecer alguma entre agora e o deploy).

## Resultado esperado

- Diretor abre `/configuracoes/atribuicao-comissoes`: supervisores/gerentes aparecem com a tag “Não aplicável” em Grade, sem alarme de pendência.
- Ao editar um supervisor/gerente, o seletor de grade simplesmente não aparece — só hierarquia.
- Qualquer tentativa programática de gravar grade para essas roles é rejeitada pelo banco com mensagem clara.
