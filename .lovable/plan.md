

# Fix: Gravar tipo de entrada e rastreabilidade na substituição

## Problema
Quando a substituição é efetivada, o veículo novo não recebe um contrato com `tipo_entrada: 'substituicao_placa'`. A ficha do associado e a proposta não conseguem identificar que o veículo entrou por substituição. O veículo antigo também não registra por qual veículo foi substituído.

## Análise

- O campo `tipo_entrada` vive na tabela `contratos`, não em `veiculos`
- A coluna `substituido_por` já existe na tabela `veiculos` mas nunca é preenchida
- O Step 8 do `efetivar-substituicao` chama `autentique-create` com dados inline em vez de um `contratoId` — ignorando o fluxo de template que resolve `{{operacao.substituicao_placa}}`
- A `OrigemCadastroCard` já trata `substituicao_placa` como tipo de entrada (linha 119) e exibe dados de substituição (linhas 305-346) — só falta o contrato existir

## Correções — 1 arquivo

### `supabase/functions/efetivar-substituicao/index.ts`

**Step 1 — Inativar veículo antigo**: adicionar `substituido_por: substituicao.veiculo_novo_id` no update, para que o veículo antigo registre a placa do novo.

**Novo Step (entre 2 e 3) — Criar contrato do novo veículo**: inserir um registro em `contratos` com:
- `tipo_entrada: 'substituicao_placa'`
- `associado_id`, `veiculo_id: veiculo_novo_id`
- `plano_id` do associado
- `valor_mensal: mensalidade_nova`, `cota_participacao: cota_participacao_nova`
- `valor_adesao: taxa_substituicao`
- `vendedor_id: consultor_id`
- `data_carencia_inicio/fim` calculadas
- `status: 'ativo'`

Salvar o ID gerado e fazer update em `substituicoes_veiculo.contrato_novo_id`.

**Step 8 — Autentique**: mudar a chamada para usar `{ contratoId: novoContratoId }` em vez de dados inline. Isso faz o template resolver `{{operacao.substituicao_placa}}` como `(X)` automaticamente, via `template-utils.ts` (linha 126).

**Step 11 — Histórico**: adicionar `placa_anterior` e `rastreador_devolvido` no `metadata` para que `OrigemCadastroCard` encontre esses dados no fallback de histórico (linhas 323-338).

## Impacto downstream (zero mudanças necessárias)

- `OrigemCadastroCard` já busca contrato com `tipo_entrada === 'substituicao_placa'` e exibe os dados ✓
- `template-utils.ts` já resolve `operacao.substituicao_placa` via `dados.contrato.tipo_entrada` ✓  
- `AssociadoDetalhe` já exibe badge `tipo_entrada` por veículo via join com `contratos` ✓
- `useAssociadoSituacao` já lê carência do contrato ✓

## Detalhes técnicos

```text
efetivar-substituicao/index.ts
├── Step 1: + substituido_por: substituicao.veiculo_novo_id
├── Step 2: (sem mudança)
├── NEW Step 2.5: INSERT contratos → contrato_novo_id
├── Step 8: autentique-create({ contratoId }) em vez de dados inline
└── Step 11: + placa_anterior, rastreador_devolvido no metadata
```

O `plano_id` para o novo contrato será buscado do associado (campo `plano_id` da tabela `associados`). O número do contrato segue o padrão existente com prefixo `SUB-` + timestamp.

