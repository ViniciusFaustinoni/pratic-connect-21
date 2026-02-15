

# Corrigir query do hook useVistoriaEventoDetalhe

## Problema

A query no hook `useVistoriaEventoDetalhe` referencia colunas que nao existem na tabela `sinistros`:
- `relato` (nao existe -- o campo correto eh `descricao`)
- `local_evento`, `local_numero`, `local_bairro`, `local_cidade`, `local_uf` (nao existem -- so existem `local_descricao` e `local_ocorrencia`)
- `terceiro_envolvido`, `terceiro_nome`, `terceiro_placa`, `terceiro_telefone`, `terceiro_seguradora` (nao existem)

Isso causa o erro HTTP 400: `column sinistros_1.relato does not exist`, impedindo o regulador de carregar qualquer vistoria.

## Solucao

**Arquivo: `src/hooks/useVistoriaEventoDetalhe.ts`**

Atualizar o select da query para usar apenas colunas que realmente existem na tabela `sinistros`:

```typescript
sinistro:sinistros!vistorias_evento_sinistro_id_fkey(
  id, protocolo, tipo, status, data_ocorrencia, created_at, descricao,
  local_descricao, local_ocorrencia, cidade_ocorrencia, estado_ocorrencia,
  condutor_nome, condutor_cnh, condutor_relacao,
  associado:associados!sinistros_associado_id_fkey(
    id, nome, cpf, telefone, email, plano_id, whatsapp
  ),
  veiculo:veiculos!sinistros_veiculo_id_fkey(
    id, placa, marca, modelo, ano_modelo, cor, chassi, valor_fipe
  )
)
```

Remover as colunas inexistentes (`relato`, `local_evento`, `local_numero`, `local_bairro`, `local_cidade`, `local_uf`, `terceiro_envolvido`, `terceiro_nome`, `terceiro_placa`, `terceiro_telefone`, `terceiro_seguradora`) e substituir pelos nomes corretos.

Os dados de terceiro e relato detalhado ficam no campo JSON `dados_etapa3` da tabela `sinistro_evento_links`, que ja eh buscado separadamente pelo hook (variavel `linkEvento`).

**Arquivo: `src/components/regulador/VistoriaEventoDados.tsx`** (se necessario)

Verificar se este componente referencia os campos antigos e ajustar para usar os nomes corretos ou extrair dos dados do `linkEvento`.

## Impacto

- Corrige o erro 400 que impede o regulador de carregar vistorias
- Nenhuma alteracao de banco de dados necessaria
- Alteracao apenas nos nomes de colunas na query do hook
