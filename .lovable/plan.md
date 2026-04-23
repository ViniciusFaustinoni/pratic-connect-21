
## Ajuste da lógica de grades de comissão

### Correção conceitual
A área de **Grades de Comissão** deve servir apenas para configurar regras comerciais:

```text
Grade
  -> Planos vinculados
    -> Parcela
      -> Perfil de acesso
        -> quanto esse perfil recebe
```

Ela **não deve atribuir a grade a usuários**.

A área de **Atribuição de Grades** deve ser o único lugar para:

```text
Usuário / vendedor
  -> grade atribuída
  -> supervisor
  -> gerente
  -> agência
```

Quando um vendedor tiver uma grade atribuída, toda a cadeia hierárquica dele receberá conforme as regras daquela grade para o plano vendido.

---

## 1. Ajustar a tela “Grades de Comissão”

Arquivo:
- `src/pages/configuracoes/GradeComissaoForm.tsx`

### O que será alterado
Vou reforçar visual e funcionalmente que essa tela configura **quanto cada plano paga por perfil**, e não quem recebe.

A tela ficará organizada assim:

```text
Dados da grade
- Nome
- Descrição

Planos da grade
- Selecionar um ou mais planos

Regras de pagamento por plano
- Plano A
  - Parcela 1 / Taxa de Adesão
    - Vendedor CLT: 20%
    - Supervisor: 5%
    - Gerente: 3%
  - Parcela 2
    - Vendedor CLT: R$ 30,00
    - Supervisor: R$ 10,00

- Plano B
  - Regras próprias do Plano B
```

### Mudança importante
Hoje o formulário já permite selecionar planos, mas as regras de parcelas/perfis estão compartilhadas entre todos os planos selecionados.

Vou ajustar para que cada plano possa ter regras próprias.

Isso atende diretamente à regra:

> O diretor determina quanto cada plano paga para cada perfil de acesso.

---

## 2. Remover qualquer sensação de “atribuir usuário” da criação da grade

Arquivos:
- `src/pages/configuracoes/GradeComissaoForm.tsx`
- `src/pages/configuracoes/GradesComissao.tsx`

### Ajustes de texto e layout
Vou alterar textos como:
- “níveis comissionados”
- “vincular grade”
- “usuários atribuídos”
- “grades com níveis”

Para mensagens mais claras:

```text
Configuração comercial da grade
Planos configurados
Perfis remunerados
Regras por parcela
```

Na listagem de grades, manterei a informação de quantos usuários usam aquela grade apenas como indicador, mas deixando claro:

```text
Usada por X usuário(s) na área de Atribuição
```

E não como algo gerenciado ali.

---

## 3. Criar editor por plano dentro da grade

Arquivos:
- `src/pages/configuracoes/GradeComissaoForm.tsx`
- `src/components/comissoes/ParcelaEditor.tsx`

### Nova estrutura de estado no formulário
Em vez de uma lista única de parcelas para toda a grade, o formulário passará a trabalhar com regras por plano:

```text
selectedPlanIds: string[]

regrasPorPlano: {
  [planoId]: {
    parcelas: [
      {
        numero_parcela
        vitalicia
        perfis: [
          {
            role
            tipo_comissao
            valor
          }
        ]
      }
    ]
  }
}
```

### Comportamento esperado
Ao selecionar um plano:
- ele aparece em uma aba/card próprio;
- o diretor configura as parcelas e perfis daquele plano;
- outro plano pode ter valores totalmente diferentes.

Ao remover um plano:
- suas regras saem da grade;
- o sistema não tentará gerar comissão para aquele plano nessa grade.

---

## 4. Persistir corretamente as regras por plano

Tabelas já existentes e reaproveitadas:
- `grade_comissao_planos`
- `grade_comissao_plano_regras`
- `grades_comissao_parcelas`
- `grades_comissao_niveis`

### Ajuste de salvamento
Ao salvar a grade:

1. Salvar a grade em `grades_comissao`.
2. Salvar os planos em `grade_comissao_planos`.
3. Salvar as parcelas/regras por plano em `grade_comissao_plano_regras`.
4. Manter `grades_comissao_parcelas` e `grades_comissao_niveis` apenas como compatibilidade/estrutura auxiliar, se ainda forem usados por outras telas.
5. Salvar o snapshot da versão com os dados separados por plano.

### Resultado
O banco conseguirá responder:

```text
Na Grade X,
para o Plano Y,
na Parcela Z,
quanto recebe o perfil vendedor/supervisor/gerente/agência?
```

---

## 5. Ajustar a área “Atribuição de Grades”

Arquivos:
- `src/pages/configuracoes/AtribuicaoGrades.tsx`
- `src/components/comissoes/AtribuirGradeModal.tsx`
- `src/hooks/useAtribuicaoComissoes.ts`

### O que será mantido ali
Essa área continuará sendo o local correto para:

- atribuir uma grade a um usuário;
- definir supervisor;
- definir gerente;
- definir agência;
- consultar quem está sem grade;
- visualizar a cadeia hierárquica.

### Ajustes de texto
Vou deixar explícito que:

```text
A grade atribuída ao vendedor define as regras de comissão para toda a hierarquia dele.
```

Exemplo exibido na tela/modal:

```text
Se João tem a Grade Select RJ, as comissões de João, supervisor, gerente e agência serão calculadas pelas regras da Grade Select RJ para o plano vendido.
```

### Ajuste funcional
O modal continuará atribuindo grade ao usuário, mas com labels mais claros:

```text
Grade aplicada às vendas deste usuário
Supervisor da cadeia
Gerente da cadeia
Agência da cadeia
```

---

## 6. Garantir a regra hierárquica no motor de cálculo

Banco/função:
- `fn_gerar_comissoes_por_pagamento`

A lógica deve permanecer/ser ajustada para:

```text
Venda feita pelo vendedor A
  -> buscar grade vigente do vendedor A
  -> buscar plano vendido
  -> buscar regras da grade do vendedor A para aquele plano
  -> pagar:
      vendedor A
      supervisor vigente de A
      gerente vigente de A
      agência vigente de A
```

### Regra essencial
Supervisor, gerente e agência **não usam suas próprias grades** para a venda do vendedor.

Eles recebem conforme a grade atribuída ao vendedor que originou a venda.

---

## 7. Ajustar relatório para refletir a nova lógica

Arquivo:
- `src/pages/comissoes/Relatorio.tsx`
- `src/hooks/useRelatorioComissoes.ts`

O relatório deve mostrar claramente:

- plano vendido;
- grade usada;
- vendedor de origem;
- destinatário da comissão;
- perfil do destinatário;
- parcela;
- tipo de cálculo;
- valor base;
- percentual ou valor fixo;
- valor calculado;
- status.

Isso permitirá auditar:

```text
Por que esse supervisor recebeu esse valor?
Resposta:
Porque o vendedor X tinha a Grade Y, vendeu o Plano Z, e a regra da Grade Y para supervisor era N%.
```

---

## 8. Validação esperada

### Cenário 1: diretor cria grade
- Diretor cria uma grade.
- Seleciona Plano A e Plano B.
- Define valores diferentes para vendedor, supervisor e gerente em cada plano.
- Nenhum usuário é escolhido nessa tela.

### Cenário 2: atribuição separada
- Diretor vai em “Atribuição de Grades”.
- Escolhe o vendedor.
- Atribui a grade.
- Define supervisor e gerente.

### Cenário 3: geração de comissão
- Vendedor vende Plano A.
- Sistema usa a grade do vendedor.
- Comissão é gerada para vendedor, supervisor e gerente conforme as regras do Plano A dentro daquela grade.

### Cenário 4: plano diferente
- Mesmo vendedor vende Plano B.
- Sistema usa a mesma grade do vendedor, mas aplica as regras específicas do Plano B.

### Cenário 5: supervisor com outra grade
- Supervisor tem outra grade própria.
- Ainda assim, na venda do vendedor, o supervisor recebe conforme a grade do vendedor.

---

## Arquivos envolvidos

### Frontend
- `src/pages/configuracoes/GradeComissaoForm.tsx`
- `src/pages/configuracoes/GradesComissao.tsx`
- `src/components/comissoes/ParcelaEditor.tsx`
- `src/pages/configuracoes/AtribuicaoGrades.tsx`
- `src/components/comissoes/AtribuirGradeModal.tsx`
- `src/hooks/useAtribuicaoComissoes.ts`
- `src/pages/comissoes/Relatorio.tsx`
- `src/hooks/useRelatorioComissoes.ts`

### Banco/Supabase
- revisar/ajustar função `fn_gerar_comissoes_por_pagamento`
- revisar consistência de `grade_comissao_planos`
- revisar consistência de `grade_comissao_plano_regras`
- se necessário, criar migration apenas para campos/índices faltantes, sem duplicar estrutura já criada
