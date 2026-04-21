

## Correção definitiva — erro ao gerar cotação para todos os perfis comerciais

### Causa raiz confirmada

O erro acontece porque o sistema está usando **dois identificadores diferentes para o consultor/vendedor responsável pela cotação**.

Hoje, ao criar cotação, o formulário envia o ID do usuário autenticado ou o `user_id` do consultor selecionado. Porém, a regra estrutural atual da cotação também exige que esse campo corresponda ao ID interno do perfil do consultor.

Resultado: quando o consultor tem esses dois IDs diferentes, a criação da cotação é rejeitada.

A auditoria mostrou que isso afeta praticamente todos os perfis comerciais:

- Total de perfis comerciais auditados: **199**
- Com IDs diferentes entre usuário e perfil: **187**
- Vendedores CLT com IDs diferentes: **162 de 162**
- Vendedores externos com IDs diferentes: **20 de 27**
- Diretor de teste `admin@teste.com`: também tem IDs diferentes

Por isso o erro aparece para vendedor CLT, vendedor externo e também para diretor/gestor ao atribuir consultor.

### Problema técnico específico

O sistema está inconsistente:

1. Algumas regras e telas tratam `vendedor_id` como **ID de login do usuário**.
2. Outras relações tratam `vendedor_id` como **ID do perfil do vendedor**.
3. A criação da cotação envia o ID de login.
4. A validação estrutural também exige o ID do perfil.
5. Para a maioria dos vendedores, esses IDs não são iguais.
6. A cotação é bloqueada antes de ser criada.

### Plano de correção

#### 1. Padronizar `cotacoes.vendedor_id` como ID do usuário de login

Manter a cotação usando o ID do usuário autenticado como fonte principal do vendedor responsável.

Motivo:
- As permissões de visualização e edição já usam esse padrão.
- A criação atual do formulário já envia esse padrão.
- O vínculo com login, permissões e papéis comerciais fica mais direto.
- Evita quebrar a regra “vendedor vê suas próprias cotações”.

#### 2. Remover a relação conflitante com o ID interno do perfil

Criar uma migration para remover a constraint incorreta/conflitante que exige que `cotacoes.vendedor_id` exista como ID interno de perfil.

Manter apenas a relação compatível com o usuário autenticado.

#### 3. Corrigir joins e exibição do vendedor nas telas de cotação

Atualizar as consultas que buscam dados do vendedor para relacionar a cotação com o perfil através do ID de usuário, não pelo ID interno do perfil.

Arquivos principais:
- `src/hooks/useCotacoes.ts`
- `src/hooks/useVendedores.ts`
- `src/components/cotacoes/CotacaoFormDialog.tsx`

A lista de consultores continuará mostrando nomes normalmente, mas o valor salvo será sempre o ID de login do consultor.

#### 4. Corrigir o fallback do formulário

No formulário de cotação:

- Se gestor/diretor selecionar um consultor, salvar o ID de login do consultor selecionado.
- Se não selecionar, salvar o ID de login do usuário atual.
- Se vendedor CLT/externo criar a própria cotação, salvar o ID de login dele.
- Adicionar validação com mensagem clara caso o usuário logado não tenha perfil comercial válido.

#### 5. Revisar pontos sensíveis que usam `vendedor_id`

Auditar e ajustar usos em:
- listagem de cotações;
- detalhes da cotação;
- métricas comerciais;
- permissões de edição/visualização;
- duplicação de cotação;
- geração/aceite de contrato a partir da cotação.

Atenção: contratos parecem usar outro padrão em parte do sistema. A correção será limitada à geração de cotação para não misturar fluxos sem necessidade.

#### 6. Melhorar mensagem de erro

Trocar a mensagem genérica “Erro ao gerar cotação” por uma mensagem operacional mais clara quando o problema for vendedor/consultor inválido:

“Não foi possível identificar o consultor responsável. Atualize a página ou selecione outro consultor.”

E manter o erro técnico no console para auditoria.

### Critérios de aceitação

1. Diretor `admin@teste.com` consegue gerar cotação sem selecionar consultor.
2. Diretor consegue gerar cotação selecionando vendedor CLT.
3. Diretor consegue gerar cotação selecionando vendedor externo.
4. Vendedor CLT consegue gerar cotação própria.
5. Vendedor externo consegue gerar cotação própria.
6. A cotação criada aparece na listagem correta do vendedor.
7. Gestores continuam vendo todas as cotações.
8. Vendedor continua vendo apenas suas próprias cotações.
9. Nome, e-mail e WhatsApp do consultor continuam aparecendo corretamente na cotação e no PDF.
10. Não há mais erro estrutural ao inserir cotação por conflito de vendedor.

### Fora de escopo

- Reestruturar contratos e comissões.
- Migrar todas as tabelas comerciais para um único padrão de vendedor.
- Alterar papéis/permissões comerciais.
- Corrigir métricas históricas que dependam de contratos antigos.

