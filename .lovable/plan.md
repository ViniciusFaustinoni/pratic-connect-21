## Problema

O termo de cancelamento enviado em troca de titularidade / substituição é gerado pela edge function `autentique-cancelamento-create`. Ela tenta buscar um template em `documento_templates` ligado ao `document_types.code = 'termo_cancelamento'`, mas como **não existe nenhum registro** para esse tipo, o código cai no `else` e usa um HTML **hardcoded** dentro da função.

Confirmado no banco:
- `document_types` tem `termo_cancelamento` ativo
- `documento_templates` **não tem nenhuma linha** vinculada a esse `document_type_id`

Por isso a página `/documentos/templates` (que lista a partir de `documento_templates`) não mostra o termo, e não há como editá-lo pela UI.

## Solução

Criar uma migração que insere o template padrão de Termo de Cancelamento em `documento_templates`, marcado como `is_default=true`, vinculado:
- `document_type_id` → id do `termo_cancelamento`
- `categoria_id` → categoria "Termos"

O `conteudo` será o texto/markdown equivalente ao HTML hardcoded hoje em `supabase/functions/autentique-cancelamento-create/index.ts` (linhas 154–202), usando as variáveis já suportadas pela função:
- `{{associado.nome}}`, `{{associado.cpf}}`, `{{associado.telefone}}`, `{{associado.email}}`, `{{associado.endereco_completo}}`
- `{{veiculo.marca}}`, `{{veiculo.modelo}}`, `{{veiculo.placa}}`, `{{veiculo.ano}}`, `{{veiculo.cor}}`, `{{veiculo.chassi}}`, `{{veiculo.renavam}}`
- `{{contrato.numero}}`, `{{contrato.data_inicio}}`, `{{contrato.valor_mensal}}`
- `{{cancelamento.motivo}}`, `{{cancelamento.data}}`
- `{{empresa.nome}}`, `{{empresa.cnpj}}`, `{{empresa.endereco}}`, `{{sistema.data_extenso}}`

A função já tem o caminho que usa o template do banco (linhas 86–96 e 134–152) — basta haver a linha. Nenhum código JS/TS precisa mudar.

## Arquivos

- **Nova migração SQL** `supabase/migrations/<timestamp>_seed_termo_cancelamento_template.sql`
  - `INSERT INTO documento_templates (...)` idempotente (`ON CONFLICT (codigo) DO NOTHING` ou guard via `WHERE NOT EXISTS`).

## Validação após approve

1. Abrir `/documentos/templates` → confirmar card "Termo de Cancelamento" na categoria Termos.
2. Editar conteúdo, salvar e confirmar persistência.
3. Disparar termo numa troca/substituição e validar que o PDF usa o conteúdo editado (log: `[autentique-cancelamento-create] Usando template do banco`).