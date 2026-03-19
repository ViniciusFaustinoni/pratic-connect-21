

# Expandir Seção "Origem do Cadastro" para Todos os Tipos de Entrada

## Resumo

Refatorar o `OrigemCadastroCard` para exibir informações contextuais baseadas no `tipo_entrada` do contrato: `adesao`, `migracao`, `reativacao`, `troca_titularidade`, `substituicao_placa`, e indicação (via tabela `indicacoes`).

## Fontes de dados existentes

| Tipo | Fonte principal | Dados disponíveis |
|------|----------------|-------------------|
| **Nova Adesão** | `contratos` | `vendedor_id` (consultor), `created_at` |
| **Migração** | `solicitacoes_migracao` | Já implementado — manter |
| **Indicação** | `indicacoes` + `contratos` | `indicador_id`, `data_conversao`, `vendedor_id` |
| **Reativação** | `associados_historico` (tipo=`status_alterado`, dados com `caminho`) | `caminho` (1/2/3), `diasAtraso`, `created_at`, carência se caminho 3 |
| **Troca Titularidade** | `contratos.origem_troca_titularidade_id` + `chat_solicitacoes_ia` | cenário (A/B via `dados`), titular anterior, `created_at` |
| **Substituição Placa** | `associados_historico` + `chat_solicitacoes_ia` | placa anterior (via `dados_anteriores`), rastreador devolvido, `created_at` |

## Implementação

### 1. Refatorar hook `useOrigemCadastro` em `OrigemCadastroCard.tsx`

Expandir o hook para buscar dados adicionais conforme o `tipo_entrada`:

- **Reativação**: buscar em `associados_historico` o registro mais recente com `tipo = 'status_alterado'` e `descricao LIKE '%Reativação%'` para extrair `caminho` e `diasAtraso` de `dados_anteriores`. Se caminho 3, usar `data_carencia_inicio/fim` do contrato.
- **Troca de titularidade**: usar `origem_troca_titularidade_id` do contrato para buscar o contrato anterior e obter nome do titular anterior. Buscar em `chat_solicitacoes_ia` (tipo=`troca_titularidade`, associado_id) para cenário (dados).
- **Substituição de placa**: buscar em `associados_historico` ou `chat_solicitacoes_ia` registros de substituição para obter placa anterior e info de rastreador.
- **Indicação**: já parcialmente implementado — adicionar verificação de permissão para link clicável.

O hook retorna um objeto tipado com todos os campos possíveis, preenchidos conforme o tipo.

### 2. Refatorar componente `OrigemCadastroCard`

Substituir a renderização condicional atual por seções dedicadas por tipo:

- Extrair sub-componentes internos (funções) para cada tipo: `renderNovaAdesao`, `renderMigracao`, `renderIndicacao`, `renderReativacao`, `renderTrocaTitularidade`, `renderSubstituicaoPlaca`.
- Cada seção exibe apenas os campos relevantes àquele tipo.
- Badge colorido por tipo (verde=ativo/migração, azul=indicação, amber=reativação, purple=troca, orange=substituição).

### 3. Link condicional na indicação

Receber uma prop ou usar contexto de permissão para determinar se o link para a ficha do indicador deve ser clicável. O componente pai (`AssociadoResumoTab`) não usa auth atualmente, então passar a info via prop `canLinkToAssociado` derivada das permissões do usuário no `AssociadoDetalhe.tsx`.

### 4. Fallback

Se `tipo_entrada` é nulo ou não reconhecido, exibir como "Nova Adesão" (comportamento padrão).

## Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `src/components/associados/detalhe/OrigemCadastroCard.tsx` | Refatorar hook e componente completo |
| `src/components/associados/detalhe/AssociadoResumoTab.tsx` | Passar prop `canLinkToAssociado` |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Derivar e passar permissão de acesso ao cadastro |

Nenhuma mudança de banco necessária — todos os dados já existem nas tabelas atuais.

