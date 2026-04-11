

## Plano: Corrigir template "Técnico a Caminho" — contato real e remoção do link

### Diagnóstico

1. **Contato "Não informado"**: O profissional "[TESTE 2] VISTORIADOR" (id `05b67f5f`) tem `telefone = NULL` e `whatsapp = NULL` no banco. O código já tenta buscar `profissional.whatsapp || profissional.telefone`, mas ambos são nulos. A solução é garantir que o telefone seja preenchido no perfil OU buscar um fallback (telefone da empresa/base).

2. **"Link de contato" no corpo da mensagem**: O template Meta `tecnico_a_caminho_1` tem 6 variáveis, sendo que a variável `{{4}}` mapeia para "Link de contato" no corpo do template aprovado na Meta. O código envia o telefone formatado nesse campo, mas o label "Link de contato" vem do template Meta. Para remover essa linha, seria necessário criar um novo template na Meta sem esse campo — ou reaproveitar o campo `{{4}}` com o telefone formatado e atualizar o `variaveis_exemplo`.

### Alterações propostas

**1. `supabase/functions/notificar-inicio-rota/index.ts` — fallback para telefone da empresa**

Quando `profissional.whatsapp` e `profissional.telefone` forem nulos, buscar o telefone da empresa na tabela `configuracoes` (chave `empresa_telefone` ou similar) como fallback, em vez de enviar "Não informado".

**2. `supabase/functions/notificar-cliente/index.ts` — remover param 4 (link)**

Alterar o `getParams` de `tecnico_em_rota` para enviar apenas 5 params, removendo o param duplicado do link/telefone (posição 4). O template Meta precisa ser atualizado para 5 variáveis.

**3. Alternativa: criar novo template Meta sem "Link de contato"**

Se não for possível editar o template na Meta, a alternativa é:
- Criar um novo template `tecnico_a_caminho_2` sem a linha "Link de contato"
- Atualizar o código para usar o novo template
- Atualizar `variaveis_exemplo` na tabela `whatsapp_meta_templates`

**4. Migration SQL — atualizar `variaveis_exemplo`**

Atualizar o registro de `tecnico_a_caminho_1` para refletir que param 4 é telefone formatado (não wa.me link), ou remover param 4 se o template Meta for atualizado.

**5. Garantir telefone do profissional**

Adicionar validação na UI de cadastro de profissional para exigir pelo menos um telefone, e/ou adicionar um fallback no código da edge function.

### Decisão necessária

O template `tecnico_a_caminho_1` está aprovado na Meta com 6 variáveis incluindo "Link de contato". As opções são:

- **Opção A**: Manter o template atual, enviar o telefone formatado no campo "Link de contato" (funciona mas o label fica estranho)
- **Opção B**: Submeter novo template na Meta sem a linha "Link de contato" e atualizar o código

Em ambos os casos, o fallback para telefone da empresa será implementado quando o profissional não tiver telefone cadastrado.

### Resultado esperado
- O contato do técnico sempre será preenchido (telefone real ou fallback da empresa)
- A linha "Link de contato" será removida ou substituída por informação útil

