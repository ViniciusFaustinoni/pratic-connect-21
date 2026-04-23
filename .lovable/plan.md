
## Plano: comissionamento por plano, grade, perfil e hierarquia

### O que já existe e será reaproveitado
O sistema já tem parte da base implementada:
- cadastro de grades de comissão;
- parcelas da grade, incluindo vitalícia;
- níveis por perfil de acesso (`vendedor_clt`, `vendedor_externo`, `agencia`, `supervisor_vendas`, `gerente_comercial`);
- atribuição de grade a usuários;
- hierarquia vendedor → supervisor → gerente → agência;
- motor que gera comissão ao pagar cobrança.

O ajuste necessário é mudar o modelo para que a comissão seja entendida assim:

```text
Plano vendido
  -> encontra a grade aplicável ao vendedor
  -> encontra as regras daquele plano dentro da grade
  -> calcula quanto cada perfil recebe
  -> resolve quem são as pessoas reais na hierarquia
  -> gera lançamentos para vendedor, supervisor, gerente e/ou agência
```

---

## 1. Tornar a grade vinculável a múltiplos planos

### Banco de dados
Criar uma tabela de vínculo entre grade e planos:

```text
grade_comissao_planos
- id
- grade_id
- plano_id
- ativo
- created_at
- updated_at
```

Regras:
- uma grade poderá ter vários planos;
- um plano poderá existir em mais de uma grade, porque a grade aplicada dependerá do vendedor/hierarquia vigente;
- o motor sempre usará a grade atribuída ao vendedor no momento da venda/pagamento.

Também serão adicionados índices e políticas RLS compatíveis com as regras atuais:
- leitura para usuários autenticados com acesso comercial/gestão;
- escrita apenas para diretoria/admin.

---

## 2. Fazer a grade mostrar quanto cada plano paga para cada perfil

### Ajuste no modelo de níveis
Hoje a grade define percentuais por parcela e perfil, mas não diferencia por plano.

Será criado um modelo de regra por:

```text
grade + plano + parcela + perfil
```

Estrutura proposta:

```text
grade_comissao_plano_regras
- id
- grade_id
- plano_id
- parcela_id
- role
- nome_nivel
- tipo_comissao: percentual | valor_fixo
- valor
- ativo
- ordem
```

Exemplo visual esperado:

```text
Grade: Comercial Padrão

Plano: Select Exclusive Passeio
Parcela 1 / Adesão
- Vendedor: 20%
- Supervisor: 5%
- Gerente: 3%

Parcela 2 / Mensalidade
- Vendedor: R$ 30,00
- Supervisor: R$ 10,00
- Gerente: R$ 5,00

Vitalícia a partir da parcela 3
- Vendedor: R$ 15,00
- Supervisor: R$ 5,00
```

Isso atende diretamente à regra:

> O sistema deve entender quanto cada plano paga de comissão a cada perfil de acesso.

---

## 3. Atualizar a tela de Grades de Comissão

Arquivos principais:
- `src/pages/configuracoes/GradesComissao.tsx`
- `src/pages/configuracoes/GradeComissaoForm.tsx`
- `src/components/comissoes/ParcelaEditor.tsx`

### Nova experiência da grade
Na criação/edição de uma grade, adicionar uma seção “Planos vinculados”.

A tela permitirá:
- selecionar um ou mais planos ativos;
- visualizar cada plano dentro da grade;
- configurar, para cada plano:
  - parcelas comissionadas;
  - perfil de acesso;
  - tipo de comissão: percentual ou valor fixo;
  - valor pago;
  - status ativo/inativo.

A listagem de grades também passará a exibir:
- quantidade de planos vinculados;
- quantidade de usuários atribuídos;
- resumo dos perfis configurados;
- indicação se a grade possui regra por plano.

---

## 4. Migrar a tela antiga “Comissionamento por Plano”

Arquivo atual:
- `src/pages/configuracoes/ComissionamentoPlano.tsx`

Essa tela já existe, mas hoje configura comissão por plano de forma separada da grade.

Ela será consolidada dentro da grade, para evitar duas fontes de verdade.

A rota antiga:
- `/configuracoes/comissionamento-plano`

já redireciona para:
- `/comissoes/grades`

Será mantida essa direção, mas a funcionalidade real passará a viver dentro da edição da grade.

---

## 5. Atualizar o motor de geração de comissões

Arquivo/migration relacionada:
- função `fn_gerar_comissoes_por_pagamento`
- função `fn_resolver_grade_vendedor_em`

### Regra nova do motor
Ao gerar comissão de uma cobrança paga:

1. identificar contrato;
2. identificar vendedor do contrato;
3. identificar plano vendido no contrato;
4. resolver a grade vigente atribuída ao vendedor;
5. verificar se o plano está vinculado àquela grade;
6. localizar a regra da parcela:
   - parcela específica;
   - ou regra vitalícia, se aplicável;
7. para cada perfil configurado:
   - se perfil for vendedor, pagar ao vendedor do contrato;
   - se perfil for supervisor, pagar ao supervisor vigente do vendedor;
   - se perfil for gerente, pagar ao gerente vigente do vendedor;
   - se perfil for agência, pagar à agência vigente do vendedor;
8. criar os lançamentos em `comissoes`.

### Hierarquia obrigatória
A grade atribuída ao vendedor será a base da cadeia.

Exemplo:

```text
Venda feita por Vendedor A
Vendedor A tem Grade X
Grade X tem regras para Plano Select Exclusive Passeio

Hierarquia vigente:
Vendedor A -> Supervisor B -> Gerente C

Resultado:
- comissão de vendedor usa regra da Grade X para o Plano vendido
- comissão de supervisor usa regra da Grade X para o perfil supervisor
- comissão de gerente usa regra da Grade X para o perfil gerente
```

Ou seja: supervisor e gerente não usam as próprias grades para essa venda. A estrutura hierárquica obedece à grade do vendedor que originou a venda, como solicitado.

---

## 6. Registrar mais contexto nos lançamentos de comissão

Na tabela `comissoes`, adicionar ou garantir os campos necessários para relatório e auditoria:

```text
grade_id
grade_versao_id
plano_id
parcela_numero
nivel_nome
role_destinatario
tipo_comissao
valor_base
percentual_aplicado
valor_comissao
valor_total
status
```

Se algum campo já existir, será reaproveitado. O objetivo é permitir rastrear:

```text
quem recebeu
por qual perfil recebeu
por qual plano recebeu
por qual grade recebeu
qual parcela gerou a comissão
qual cálculo foi aplicado
```

---

## 7. Atualizar o relatório de comissões por período

Criar uma tela de relatório no módulo de Comissões, por exemplo:

```text
/comissoes/relatorio
```

Com filtros:
- período inicial;
- período final;
- grade;
- plano;
- vendedor/destinatário;
- perfil;
- parcela;
- status:
  - gerado/pendente;
  - pago;
  - cancelado/contestado, se aplicável.

Exibição:
- total gerado;
- total pendente;
- total pago;
- quantidade de lançamentos;
- tabela detalhada com:
  - data;
  - vendedor origem;
  - destinatário;
  - perfil;
  - plano;
  - grade;
  - parcela;
  - base de cálculo;
  - percentual/valor fixo;
  - valor calculado;
  - status.

---

## 8. Ajustar navegação do módulo Comissões

Arquivo:
- `src/components/layout/AppSidebar.tsx`

Adicionar item no menu de Comissões:

```text
Comissões
- Dashboard
- Grades de Comissão
- Atribuição de Grades
- Relatório
- Pagamentos
```

---

## 9. Backfill/reprocessamento

Atualizar o backfill existente:
- `supabase/functions/comissoes-backfill/index.ts`

O backfill passará a usar o novo motor por plano + grade.

Cuidados:
- manter idempotência para não duplicar comissões;
- respeitar cobrança já paga;
- permitir simulação antes de executar;
- preservar comissões antigas quando possível;
- para reprocessamento real, gerar apenas o que estiver faltando ou substituir conforme regra segura.

---

## 10. Validação esperada

Validar os cenários:

### Cenário 1: grade com múltiplos planos
- Grade A possui Plano 1 e Plano 2.
- Cada plano tem valores diferentes por perfil.
- Sistema calcula corretamente conforme o plano vendido.

### Cenário 2: vendedor com supervisor e gerente
- Vendedor tem Grade A.
- Supervisor e gerente estão vinculados na hierarquia.
- Ao pagar cobrança, sistema gera comissão para os três conforme regras da Grade A.

### Cenário 3: supervisor/gerente com outra grade própria
- Supervisor tem Grade B atribuída a ele.
- Mesmo assim, na venda do vendedor, a comissão do supervisor usa a Grade A do vendedor.
- Isso confirma a regra hierárquica solicitada.

### Cenário 4: plano não vinculado à grade
- Venda tem plano sem regra na grade do vendedor.
- Sistema não gera comissão e registra motivo/auditoria ou deixa visível no relatório como sem regra configurada.

### Cenário 5: relatório
- Filtrar por período, grade, vendedor, plano, parcela e status.
- Conferir totais com a soma dos lançamentos.

---

## Arquivos previstos

### Banco/Supabase
- nova migration para tabelas de vínculo grade/plano e regras por plano;
- atualização da função `fn_gerar_comissoes_por_pagamento`;
- atualização de índices, RLS e grants;
- ajuste do backfill.

### Frontend
- `src/pages/configuracoes/GradesComissao.tsx`
- `src/pages/configuracoes/GradeComissaoForm.tsx`
- `src/components/comissoes/ParcelaEditor.tsx`
- novo componente/editor de regras por plano na grade
- nova página de relatório em `src/pages/comissoes/Relatorio.tsx`
- novo hook de relatório, por exemplo `src/hooks/useRelatorioComissoes.ts`
- `src/components/layout/AppSidebar.tsx`
- `src/App.tsx`

