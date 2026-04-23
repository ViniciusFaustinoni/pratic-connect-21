
## Revisão da lógica de Grades de Comissão e Atribuição de Grades

### Diagnóstico

A lógica principal já foi parcialmente ajustada:

- `GradeComissaoForm.tsx` já configura regras por **plano, parcela e perfil de acesso**.
- `AtribuicaoGrades.tsx` já existe como área separada para vincular grades a usuários e configurar hierarquia.
- O motor `fn_gerar_comissoes_por_pagamento` já calcula comissão pela **grade do vendedor de origem**, usando a cadeia hierárquica para pagar supervisor, gerente e agência.

Ainda existem pontos que podem causar confusão ou inconsistência:

1. A listagem de grades ainda mostra “Usada por X usuários”, o que pode parecer que a grade é criada para um usuário específico.
2. A tela de grades ainda carrega dados auxiliares antigos (`grades_comissao_niveis`, `grades_comissao_parcelas`) junto com a nova estrutura por plano.
3. A função antiga `fn_resolver_grade_vendedor_em` em uma migration usa `ugc.usuario_id`, mas a tabela atual usa `user_id`. Vou revisar a versão efetiva no banco e corrigir se necessário.
4. A duplicação de grade precisa garantir que copie corretamente as regras por plano/perfil, não uma estrutura antiga incompleta.
5. A área de atribuição precisa deixar visualmente claro que ali é o único lugar onde usuário recebe uma grade.

---

## Objetivo final

Separar definitivamente as responsabilidades:

```text
Grades de Comissão
  -> Define regra comercial
  -> Plano vendido
  -> Parcela
  -> Perfil de acesso
  -> Percentual ou valor fixo pago

Atribuição de Grades
  -> Define qual grade vale para cada usuário/vendedor
  -> Define supervisor, gerente e agência da cadeia
```

---

## 1. Ajustar tela de Grades de Comissão

Arquivo:

- `src/pages/configuracoes/GradesComissao.tsx`

### Mudanças

Remover qualquer leitura visual que sugira “grade criada para usuário”.

A tela passará a focar em:

- nome da grade;
- versão;
- status;
- quantidade de planos configurados;
- quantidade de parcelas/regras;
- quantidade de perfis remunerados;
- se possui regra vitalícia;
- ações: editar, duplicar, ativar/inativar, excluir.

### Ajuste de texto

Trocar mensagens como:

```text
Usada por X usuários
```

por algo mais neutro:

```text
X atribuições ativas
```

ou mover essa informação para uma área secundária com tooltip:

```text
Esta informação vem da área de Atribuição de Grades.
```

### Exclusão

Manter a proteção contra excluir grade com atribuição ativa, mas ajustar o texto:

```text
Esta grade possui atribuições ativas. Remova os vínculos na área de Atribuição de Grades antes de excluir.
```

---

## 2. Ajustar formulário de criação/edição de grade

Arquivo:

- `src/pages/configuracoes/GradeComissaoForm.tsx`

### Manter

A estrutura atual correta:

```text
Grade
  -> Planos configurados
    -> Parcelas
      -> Perfis remunerados
        -> Percentual ou valor fixo
```

### Melhorar clareza

Adicionar/ajustar textos para reforçar:

```text
Esta tela não define quem recebe comissão.
Ela define quanto cada perfil recebe quando esta grade for aplicada a uma venda.
```

### Validações

Revisar:

- não permitir plano selecionado sem parcela;
- não permitir parcela sem perfil remunerado, se a intenção for gerar comissão naquela parcela;
- não permitir perfil duplicado dentro da mesma parcela do mesmo plano;
- manter limite de 100% apenas para regras percentuais;
- permitir valor fixo sem afetar o percentual da empresa.

### Persistência

Garantir que o salvamento use como fonte principal:

- `grade_comissao_planos`;
- `grade_comissao_plano_regras`;
- `grades_comissao_versoes.snapshot`.

E que as tabelas auxiliares antigas sejam usadas apenas se ainda forem necessárias para compatibilidade visual.

---

## 3. Ajustar duplicação de grade

Arquivo:

- `src/pages/configuracoes/GradesComissao.tsx`

A duplicação deve copiar a configuração comercial completa:

```text
grade_comissao_planos
grade_comissao_plano_regras
grades_comissao_versoes.snapshot
```

Sem copiar atribuições de usuários.

A nova grade duplicada deve nascer como:

```text
Grade X (Cópia)
versão 1
sem usuários atribuídos
mesmas regras comerciais por plano/perfil
```

---

## 4. Ajustar área de Atribuição de Grades

Arquivos:

- `src/pages/configuracoes/AtribuicaoGrades.tsx`
- `src/components/comissoes/AtribuirGradeModal.tsx`
- `src/hooks/useAtribuicaoComissoes.ts`

### Mudanças visuais

Reforçar na tela:

```text
Aqui você escolhe qual grade comercial será aplicada às vendas de cada usuário.
A grade do vendedor de origem determina quanto vendedor, supervisor, gerente e agência recebem.
```

### Modal

O modal continuará sendo o único local para:

- atribuir grade ao usuário;
- alterar supervisor;
- alterar gerente;
- alterar agência;
- registrar observações.

### Melhorias

Adicionar um bloco de explicação no modal:

```text
A grade selecionada não paga apenas este usuário.
Ela define a regra usada nas vendas originadas por ele.
Os perfis pagos serão resolvidos conforme a cadeia configurada.
```

---

## 5. Revisar função de resolução da grade do vendedor

Banco/Supabase:

- `fn_resolver_grade_vendedor_em`

Vou verificar a função efetiva no banco e corrigir se ela ainda usa campo incorreto.

A versão correta deve buscar a grade vigente por:

```sql
usuario_grade_comissao.user_id = vendedor_id
data_inicio <= data_referencia
data_fim is null or data_fim > data_referencia
```

Não deve usar:

```sql
usuario_id
ativo
```

a menos que essas colunas realmente existam no schema atual.

---

## 6. Revisar motor de geração de comissões

Banco/Supabase:

- `fn_gerar_comissoes_por_pagamento`

Confirmar que o fluxo segue esta regra:

```text
1. Pega vendedor de origem do contrato.
2. Resolve a grade atribuída a esse vendedor.
3. Verifica se o plano vendido existe na grade.
4. Resolve a parcela paga.
5. Busca regras por perfil:
   - vendedor_clt
   - vendedor_externo
   - supervisor_vendas
   - gerente_comercial
   - agencia
6. Resolve destinatário:
   - vendedor -> vendedor origem
   - supervisor -> supervisor da cadeia
   - gerente -> gerente da cadeia
   - agência -> agência da cadeia
7. Gera comissão com snapshot.
```

Também vou manter a regra conceitual:

```text
Supervisor, gerente e agência não usam suas próprias grades nessa venda.
Eles recebem conforme a grade do vendedor de origem.
```

---

## 7. Revisar logs de auditoria

Como já houve implementação recente de auditoria, vou garantir que os logs reflitam a separação correta:

### Alteração de grade

Log deve indicar:

```text
Quem alterou
Quando alterou
Qual grade
Qual plano
Qual parcela
Qual perfil
Valor anterior
Valor novo
```

### Atribuição de grade

Log deve indicar:

```text
Quem atribuiu
Quando atribuiu
Usuário afetado
Grade anterior
Grade nova
Hierarquia anterior/nova quando aplicável
```

---

## 8. Arquivos envolvidos

### Frontend

- `src/pages/configuracoes/GradesComissao.tsx`
- `src/pages/configuracoes/GradeComissaoForm.tsx`
- `src/pages/configuracoes/AtribuicaoGrades.tsx`
- `src/components/comissoes/AtribuirGradeModal.tsx`
- `src/hooks/useAtribuicaoComissoes.ts`

### Banco/Supabase

- revisar/corrigir `fn_resolver_grade_vendedor_em`
- revisar `fn_gerar_comissoes_por_pagamento`
- se necessário, criar migration corretiva sem duplicar estrutura existente

---

## Validação esperada

### Cenário 1: criar grade

- Diretor acessa Grades de Comissão.
- Cria uma grade sem escolher usuário.
- Configura planos, parcelas e perfis remunerados.
- Salva a grade.

Resultado esperado:

```text
Nenhum usuário é atribuído nessa tela.
A grade fica disponível para atribuição depois.
```

### Cenário 2: atribuir grade

- Diretor acessa Atribuição de Grades.
- Escolhe um usuário/vendedor.
- Seleciona a grade.
- Define supervisor, gerente e agência.

Resultado esperado:

```text
Usuário passa a ter grade vigente.
Hierarquia fica configurada separadamente.
```

### Cenário 3: geração de comissão

- Venda/pagamento de um contrato com vendedor de origem.
- Sistema usa a grade atribuída ao vendedor.
- Sistema paga os perfis configurados no plano/parcela.
- Supervisor/gerente/agência recebem conforme cadeia, não conforme grades próprias.

### Cenário 4: edição de grade

- Diretor edita uma grade.
- Nova versão é criada.
- Logs mostram o que mudou.
- Comissões futuras usam nova versão.
- Comissões antigas continuam auditáveis pelo snapshot.

