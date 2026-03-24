

# Área de Documentação da API do Sistema

## Resumo

Criar uma nova seção "API do Sistema" dentro de Configurações, acessível apenas por diretores, com documentação interativa de todos os endpoints disponíveis. Inclui a criação de novas edge functions para os endpoints que ainda não existem e uma página de documentação estilo "developer portal".

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/configuracoes/ApiDocumentation.tsx` | **Criar** — Página principal com documentação interativa |
| `src/components/api-docs/ApiEndpointCard.tsx` | **Criar** — Card de endpoint com exemplos de request/response |
| `src/components/api-docs/ApiPlayground.tsx` | **Criar** — Área de teste de endpoints (try it) |
| `src/components/api-docs/ApiSidebar.tsx` | **Criar** — Navegação lateral dos endpoints |
| `supabase/functions/api-externa/index.ts` | **Criar** — Edge function roteadora para todos os endpoints da API externa |
| `src/pages/configuracoes/ConfiguracoesSidebar.tsx` | **Editar** — Adicionar link para API |
| `src/App.tsx` | **Editar** — Adicionar rota |

## Design da Página

Página estilo developer docs com:
- Header: "API do Sistema" + badge "Diretor"
- Sidebar esquerda: lista de endpoints agrupados por recurso
- Conteúdo principal: documentação de cada endpoint com método HTTP, URL, headers, body, exemplos de request/response, e códigos de erro
- Área de teste: painel colapsável para testar endpoints com a API key do usuário

## Edge Function `api-externa`

Uma única edge function roteadora que recebe todas as chamadas da API externa. Autenticação via `x-api-key` header (mesma tabela `api_keys` existente). Roteamento por path:

### Endpoints

**1. POST /associados** — Criar associado
- Campos obrigatórios: `nome`, `cpf`, `email`, `telefone`
- Campos opcionais: `rg`, `data_nascimento`, `sexo`, `estado_civil`, `profissao`, `whatsapp`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `plano_id`, `dia_vencimento`
- Insere em `associados` com status `em_analise`

**2. POST /veiculos** — Criar veículo
- Campos obrigatórios: `associado_id` (ou `associado_cpf`), `placa`, `marca`, `modelo`, `ano_fabricacao`, `ano_modelo`
- Campos opcionais: `chassi`, `renavam`, `cor`, `combustivel`, `valor_fipe`, `codigo_fipe`, `uso_aplicativo`, `blindado`, flags de risco
- Insere em `veiculos` com status `em_analise`

**3. POST /prestadores** — Criar prestador de assistência
- Campos obrigatórios: `razao_social`, `telefone`, `cidade`, `estado`
- Campos opcionais: `nome_fantasia`, `cnpj`, `cpf`, `tipo_pessoa`, `whatsapp`, `email`, endereço, `raio_atendimento_km`, `cidades_atendidas`, `tipos_servico`, dados bancários

**4. POST /sinistros** — Criar sinistro (evento)
- Campos obrigatórios: `associado_id` (ou `associado_cpf`), `veiculo_id` (ou `veiculo_placa`), `tipo`, `data_ocorrencia`, `canal`
- Campos opcionais: `descricao`, `local_descricao`, `bo_numero`, `valor_fipe`, condutor, local, flags

**5. POST /faturas** — Criar fatura
- Campos obrigatórios: `associado_id` (ou `associado_cpf`), `valor`, `data_vencimento`, `tipo`
- Fluxo: cria cliente no Asaas se não existir (via `asaas-clientes`), cria cobrança no Asaas (via `asaas-cobrancas`), registra em `cobrancas` local
- Respeita `notificationDisabled: true` conforme política

**6. POST /chamados** — Criar chamado de assistência
- Campos obrigatórios: `associado_id`, `tipo_servico`, `canal`
- Campos opcionais: endereço origem/destino, `descricao`

**7. GET /associados/:id** — Consultar associado
**8. GET /veiculos/:id** — Consultar veículo
**9. GET /sinistros/:id** — Consultar sinistro
**10. GET /faturas/:id** — Consultar fatura/cobrança

Cada endpoint retorna erros padronizados: `{ error, code, details? }`

## Documentação Interativa

A página mostra para cada endpoint:
- Método + URL com base URL dinâmica (`https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/api-externa/associados`)
- Tabela de campos (nome, tipo, obrigatório, descrição)
- Exemplo de request (cURL e JavaScript/fetch)
- Exemplo de response (sucesso e erro)
- Seção de códigos de erro

## Acesso

- Sidebar de configurações: novo item "API do Sistema" com ícone `Code2`, marcado como `diretorOnly: true`
- Rota: `/configuracoes/api`
- A página integra com o gerenciamento de API keys existente (link para `/configuracoes/integracoes/api-keys`)

