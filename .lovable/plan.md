

## Checkboxes condicionais no template por tipo de operação

### Situação atual
O campo `tipo_entrada` existe na tabela `contratos` (varchar), mas só tem o valor "nova". Não há campo que diferencie adesão, migração, inclusão, troca de titularidade, reativação ou substituição de placa.

### Plano

**1. Banco de dados** — Atualizar o campo `tipo_entrada` para armazenar os tipos de operação:
- Valores possíveis: `adesao`, `migracao`, `inclusao`, `troca_titularidade`, `reativacao`, `substituicao_placa`
- Atualizar registros existentes com `tipo_entrada = 'nova'` para `tipo_entrada = 'adesao'` (já que "nova" é uma adesão)

**2. `supabase/functions/_shared/template-utils.ts`** — Adicionar variáveis condicionais no `criarMapeamentoVariaveis`:
- Receber `tipo_entrada` no `ContratoData`
- Criar variáveis que resolvem para `(X)` ou `( )`:
  - `operacao.adesao` → `(X)` se tipo_entrada === 'adesao', senão `( )`
  - `operacao.migracao` → `(X)` se tipo_entrada === 'migracao', senão `( )`
  - `operacao.inclusao` → idem
  - `operacao.troca_titularidade` → idem
  - `operacao.reativacao` → idem
  - `operacao.substituicao_placa` → idem

**3. `supabase/functions/_shared/termo-afiliacao-utils.ts`** — Adicionar `tipo_entrada` ao `ContratoData` e ao mapeamento de dados

**4. `supabase/functions/autentique-create-by-token/index.ts`** — Garantir que `tipo_entrada` é buscado do contrato e passado para o template

**5. Template no banco** — No editor de template, o usuário usará:
```
{{operacao.adesao}} Adesão - {{operacao.migracao}} Migração - {{operacao.inclusao}} Inclusão - {{operacao.troca_titularidade}} Troca de Titularidade - {{operacao.reativacao}} Reativação -
{{operacao.substituicao_placa}} Subs. Placa
```

**6. UI do Cotador/Contrato** — Adicionar campo de seleção "Tipo de Operação" onde o vendedor escolhe o tipo ao criar a cotação/contrato, gravando em `tipo_entrada`

### Resultado
O template renderiza `(X) Adesão - ( ) Migração - ( ) Inclusão...` automaticamente com base no tipo de operação selecionado no contrato.

