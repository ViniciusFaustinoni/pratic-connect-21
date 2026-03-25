

# Adicionar variáveis `{{oficina.*}}` nos Termos e Aditivos

## Problema
As variáveis `{{oficina.nome}}`, `{{oficina.cnpj}}`, `{{oficina.telefone}}`, `{{oficina.whatsapp}}` e `{{oficina.endereco}}` já aparecem no seletor de variáveis do editor de templates, mas **não são substituídas** quando um termo ou aditivo é gerado via `autentique-create` / `autentique-create-by-token`. Apenas o fluxo de OS de saída (`autentique-os-saida-create`) já mapeia essas variáveis.

## Solução
Adicionar suporte a oficina no fluxo principal de geração de documentos (termos/aditivos). Como contratos não possuem `oficina_id` diretamente, buscaremos a oficina vinculada pela **Ordem de Serviço** do contrato (se existir), permitindo que templates de termos e aditivos usem dados da oficina quando o contexto permitir.

## Alterações

### 1. `supabase/functions/_shared/termo-afiliacao-utils.ts`
- Adicionar campo opcional `oficina?` à interface `TermoAfiliacaoData` com os campos: `nome`, `cnpj`, `telefone`, `whatsapp`, `logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep`

### 2. `supabase/functions/_shared/template-utils.ts`
- No `criarMapeamentoVariaveis`, adicionar bloco condicional `...(dados.oficina ? { ... } : {})` mapeando:
  - `oficina.nome` → nome_fantasia ou razao_social
  - `oficina.cnpj`
  - `oficina.telefone`
  - `oficina.whatsapp`
  - `oficina.endereco` → endereço formatado completo (logradouro, numero - bairro - cidade/estado - CEP)

### 3. `supabase/functions/autentique-create/index.ts`
- Após buscar o contrato, buscar OS vinculada (`ordens_servico` via `contrato_id` ou `veiculo_id + associado_id`) para obter `oficina_id`
- Se encontrar `oficina_id`, buscar dados da oficina na tabela `oficinas`
- Injetar em `templateData.oficina`

### 4. `supabase/functions/autentique-create-by-token/index.ts`
- Mesma lógica: buscar OS → oficina e injetar nos dados do template

### Comportamento
- Se não houver oficina vinculada (ex: contrato novo sem OS), as variáveis `{{oficina.*}}` serão substituídas por "—" (comportamento padrão de limpeza já existente)
- Nenhuma mudança no banco de dados necessária — as tabelas `oficinas` e `ordens_servico` já existem com os campos necessários

### Arquivos editados
1. `supabase/functions/_shared/termo-afiliacao-utils.ts` — interface
2. `supabase/functions/_shared/template-utils.ts` — mapeamento
3. `supabase/functions/autentique-create/index.ts` — busca e injeção
4. `supabase/functions/autentique-create-by-token/index.ts` — busca e injeção

