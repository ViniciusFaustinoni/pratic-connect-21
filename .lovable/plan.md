
## Plano: auditoria de alterações em grades de comissão e atribuições

### Objetivo
Adicionar aos **Logs de Auditoria** rastreabilidade completa para:

```text
1. Alterações em Grades de Comissão
   - quem alterou
   - quando alterou
   - qual grade/plano/parcela/perfil mudou
   - versão anterior e nova versão
   - dados anteriores e dados novos

2. Alterações em Atribuições
   - quem atribuiu/alterou
   - quando alterou
   - usuário/vendedor afetado
   - grade anterior e nova grade
   - supervisor/gerente/agência anteriores e novos
   - vigência encerrada e nova vigência
```

Isso permitirá rastrear versões, mudanças retroativas e entender por que uma comissão foi calculada de determinada forma.

---

## Situação atual

Já existe uma tabela e tela de auditoria:

- `logs_auditoria`
- `src/hooks/useAuditLog.ts`
- `src/pages/diretoria/LogsAuditoria.tsx`

A tela já exibe:

- usuário;
- data/hora;
- ação;
- módulo;
- descrição;
- dados anteriores;
- dados novos.

Também já existem pontos importantes para auditar:

- `GradeComissaoForm.tsx`, onde grades são criadas/editadas;
- `fn_atribuir_grade_usuario`, onde uma grade é atribuída ao usuário;
- `fn_upsert_hierarquia_vendedor`, onde supervisor/gerente/agência são alterados.

O que falta é registrar eventos detalhados nesses fluxos e melhorar a tela de auditoria para filtrar/visualizar especificamente comissões, grades, versões e atribuições.

---

## 1. Registrar logs ao criar ou editar grades de comissão

Arquivo principal:

- `src/pages/configuracoes/GradeComissaoForm.tsx`

### Ao criar grade
Registrar log com:

```text
Ação: criar
Módulo: configuracoes ou comissoes
Tabela: grades_comissao
Registro: grade_id
Descrição: Grade de comissão criada
Dados novos:
  - nome
  - descrição
  - versão
  - planos vinculados
  - regras por plano/parcela/perfil
```

### Ao editar grade
Registrar log com:

```text
Ação: editar
Módulo: configuracoes ou comissoes
Tabela: grades_comissao
Registro: grade_id
Descrição: Grade de comissão atualizada para nova versão
Dados anteriores:
  - snapshot/versão anterior
  - planos anteriores
  - regras anteriores

Dados novos:
  - snapshot/versão nova
  - planos atuais
  - regras atuais
```

### Resultado esperado
Na auditoria será possível ver:

```text
Diretor X alterou a Grade Select RJ em 23/04 às 14:30
Versão anterior: v2
Nova versão: v3
Plano alterado: Select Exclusive
Parcela: 2ª
Supervisor: 4% -> 5%
Gerente: 2% -> 3%
```

---

## 2. Registrar logs ao atribuir grade a usuário

Banco/função:

- `fn_atribuir_grade_usuario`

Hoje a função fecha a atribuição vigente e cria uma nova. Vou ajustar a função para também inserir em `logs_auditoria`.

### O log deverá registrar

```text
Ação: atribuir
Módulo: comissoes
Tabela: usuario_grade_comissao
Registro: nova_atribuicao_id
Descrição: Grade atribuída ao usuário/vendedor

Dados anteriores:
  - atribuição anterior
  - grade anterior
  - data_inicio anterior
  - data_fim encerrada

Dados novos:
  - usuário afetado
  - grade nova
  - atribuído por
  - data_inicio
```

### Importante
Se a grade for a mesma da vigente, a função deve evitar gerar log duplicado desnecessário ou registrar como “sem alteração”, conforme a lógica atual permitir.

---

## 3. Registrar logs ao alterar cadeia hierárquica

Banco/função:

- `fn_upsert_hierarquia_vendedor`

Hoje a função fecha a hierarquia vigente e cria uma nova quando algo muda.

Vou ajustar para gravar log quando houver alteração real em:

- supervisor;
- gerente;
- agência;
- observações.

### O log deverá registrar

```text
Ação: editar
Módulo: comissoes
Tabela: hierarquia_vendas
Registro: nova_hierarquia_id
Descrição: Hierarquia de comissão alterada

Dados anteriores:
  - vendedor
  - supervisor anterior
  - gerente anterior
  - agência anterior
  - observações anteriores
  - vigente_desde
  - vigente_ate encerrado

Dados novos:
  - vendedor
  - supervisor novo
  - gerente novo
  - agência nova
  - observações novas
  - vigente_desde
```

### Resultado esperado
Na auditoria será possível ver:

```text
Diretor X alterou a cadeia do vendedor João
Supervisor: Maria -> Pedro
Gerente: Carlos -> Carlos
Agência: nenhuma -> Agência RJ
```

---

## 4. Melhorar a tela de Logs de Auditoria

Arquivo:

- `src/pages/diretoria/LogsAuditoria.tsx`

### Novos filtros
Adicionar filtros para facilitar rastreio de comissões:

```text
Módulo:
- Comissões
- Configurações
- Diretoria
- Financeiro
- etc.

Tabela/Origem:
- grades_comissao
- grades_comissao_versoes
- usuario_grade_comissao
- hierarquia_vendas
- comissoes
- comissoes_pagamentos

Busca:
- nome do usuário que alterou
- nome da grade
- nome do vendedor afetado
- ID do registro
```

### Novas ações visuais
Expandir o mapa de ações para incluir:

```text
atribuir
reativar
desativar
configuracao
```

Hoje algumas ações existem no hook, mas a tela não destaca todas.

---

## 5. Criar visualização amigável para diferenças

Arquivo:

- `src/pages/diretoria/LogsAuditoria.tsx`

Além do JSON bruto, adicionar uma seção resumida quando o log for de comissões/grades/atribuições.

### Para grades
Mostrar resumo como:

```text
Grade: Grade Select RJ
Versão: v2 -> v3
Planos:
- Select Exclusive
- Select Diesel

Alterações principais:
- Plano Select Exclusive / 2ª Parcela / Supervisor: 4% -> 5%
- Plano Select Exclusive / 2ª Parcela / Gerente: 2% -> 3%
- Plano Select Diesel adicionado
```

### Para atribuições
Mostrar resumo como:

```text
Usuário afetado: João Silva
Grade: Grade Antiga -> Grade Select RJ
Supervisor: Maria -> Pedro
Gerente: Carlos -> Carlos
Agência: — -> Agência RJ
```

### Manter JSON técnico
A tela continuará exibindo `dados_anteriores` e `dados_novos` completos para auditoria técnica.

---

## 6. Exportação CSV com detalhes de auditoria

Arquivo:

- `src/pages/diretoria/LogsAuditoria.tsx`

Atualizar exportação para incluir:

```text
Data/Hora
Usuário executor
Ação
Módulo
Tabela
Registro ID
Descrição
Resumo da alteração
Dados anteriores
Dados novos
IP
```

Assim será possível exportar alterações de grades e atribuições para conferência externa.

---

## 7. Banco de dados / migrations

Será criada uma migration para atualizar as funções:

- `fn_atribuir_grade_usuario`
- `fn_upsert_hierarquia_vendedor`

Essas funções passarão a inserir registros em `logs_auditoria` com `dados_anteriores` e `dados_novos`.

Não será necessário criar nova tabela, porque `logs_auditoria` já suporta:

```text
acao
modulo
tabela
registro_id
dados_anteriores
dados_novos
usuario_id
usuario_nome
created_at
```

Se necessário, adicionarei apenas índices para melhorar filtros:

```text
logs_auditoria(modulo)
logs_auditoria(tabela)
logs_auditoria(registro_id)
logs_auditoria(created_at)
```

---

## 8. Compatibilidade com versões e retroativos

A auditoria usará dois níveis de rastreabilidade:

```text
1. grades_comissao_versoes.snapshot
   - preserva a configuração comercial versionada da grade

2. logs_auditoria
   - registra quem mudou, quando mudou e o que mudou
```

Isso permite responder:

```text
Quem mudou a regra?
Quando mudou?
Qual era a regra antes?
Qual regra ficou depois?
Essa mudança afetou novas comissões ou uma geração retroativa?
Quem alterou a atribuição do vendedor?
Qual hierarquia estava vigente antes?
```

---

## Arquivos envolvidos

### Frontend
- `src/pages/configuracoes/GradeComissaoForm.tsx`
- `src/pages/diretoria/LogsAuditoria.tsx`
- opcional: criar helpers em `src/lib/auditoria-formatters.ts`

### Banco/Supabase
- migration para atualizar:
  - `fn_atribuir_grade_usuario`
  - `fn_upsert_hierarquia_vendedor`
- opcional: índices em `logs_auditoria`

---

## Validação esperada

### Cenário 1: criar grade
- Criar uma nova grade.
- Abrir Logs de Auditoria.
- Filtrar por módulo “Comissões” ou tabela `grades_comissao`.
- Ver quem criou, quando criou e snapshot da configuração.

### Cenário 2: editar grade
- Alterar percentual de um perfil em um plano.
- Salvar nova versão.
- Ver log com dados anteriores e novos.
- Ver resumo da diferença.

### Cenário 3: atribuir grade
- Ir em Atribuição de Grades.
- Alterar a grade de um vendedor.
- Ver log com grade anterior e nova grade.

### Cenário 4: alterar hierarquia
- Alterar supervisor/gerente/agência de um vendedor.
- Ver log com cadeia anterior e nova cadeia.

### Cenário 5: exportação
- Exportar logs filtrados.
- CSV deve conter tabela, registro, descrição, dados anteriores e dados novos.
