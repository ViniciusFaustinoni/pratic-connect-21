

# Vincular Indicação na Cotação

## Situação Atual

A infraestrutura já existe no banco de dados:
- **Tabela `leads`**: tem `origem` (enum com valor `'indicacao'`) e `indicador_id`
- **Tabela `indicacoes`**: tem `indicador_id`, `indicador_nome`, `indicador_telefone`, `lead_id`
- **Tabela `cotacoes`**: tem `lead_id` que conecta à lead

O que falta é **expor isso na tela de cotação** (Etapa 1 - Dados do Solicitante).

## Plano

### 1. Adicionar campo "Indicado por associado?" na Etapa 1

No componente `EtapaDadosAssociado`, adicionar após o Consultor Responsável:

- Um **switch/toggle** "Este cliente foi indicado por um associado?"
- Quando ativado, exibir um campo de **busca por nome ou telefone** que consulta a tabela `associados`
- Ao selecionar o associado indicador, guardar seu `id` e `nome`

### 2. Propagar dados no fluxo

No `CotacaoPage` (`src/pages/vendas/Cotacao.tsx`):

- Adicionar estados `isIndicacao` (boolean) e `indicadorId` / `indicadorNome` (string)
- Passar como props para `EtapaDadosAssociado`
- No `handleIniciarCadastro`, incluir esses dados no objeto `dadosCotacao` enviado para contratos
- Quando a cotação gerar o lead (ou usar um existente), setar `origem = 'indicacao'` e `indicador_id` no lead

### 3. Criar registro na tabela `indicacoes` automaticamente

Quando a cotação for salva/aprovada e tiver um indicador vinculado:
- Inserir na tabela `indicacoes` com `indicador_id`, `indicador_nome`, `indicado_nome` (nome do solicitante), `indicado_telefone`, `lead_id`, e `status = 'em_contato'`
- Isso conecta automaticamente ao sistema de marketing de indicações sem intervenção manual

### 4. Componente de busca de associados

Criar um componente simples de busca que:
- Faz query na tabela `associados` filtrando por `nome` (ilike) ou `telefone`
- Mostra resultados em um dropdown/combobox
- Retorna `id` e `nome` do associado selecionado

## Resumo das Alterações

| Arquivo | Alteração |
|---|---|
| `src/components/cotacao/EtapaDadosAssociado.tsx` | Adicionar toggle de indicação + busca de associado |
| `src/pages/vendas/Cotacao.tsx` | Novos estados e propagação dos dados de indicação |
| `src/hooks/useAssociadoSearch.ts` | Novo hook para buscar associados por nome/telefone |

Nenhuma alteração de banco de dados necessária — todas as colunas já existem.

