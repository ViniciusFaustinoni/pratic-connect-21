## Causa raiz (confirmada)

Gleice e João Victor aparecem corretamente na fila **Monitoramento › Aprovação de Associados** (são `servicos` do tipo `vistoria_entrada`, status `concluida`, com veículo sem `cobertura_total` e associado em `aguardando_instalacao`).

Mas ao abrir o detalhe (`/monitoramento/aprovacao-associados/{id}`), a tela mostra **"Serviço não encontrado"**.

O problema **não é dado faltando** nem RLS. É um bug na query do hook `useServicoDetalheAprovacao` em `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` (linha 57):

```ts
veiculo:veiculo_id(id, placa, marca, modelo, ano_modelo, cor, valor_fipe,
  combustivel, categoria, cobertura_roubo_furto, cobertura_total)
```

A coluna **`categoria` não existe na tabela `veiculos`** (verificado no `information_schema`). Categoria de veículo no nosso modelo vive em `contratos.veiculo_categoria` (taxi/leilão) e o tipo (carro/moto) é derivado de `marca+modelo` — conforme memory `cotacao-categoria-vs-tipo-veiculo`.

PostgREST devolve erro 400 nessa SELECT, o `if (error) throw error` dispara, `data` fica `undefined` no React Query e a UI cai no fallback "Serviço não encontrado". Acontece para **todos** os itens dessa fila — Gleice e João Victor são apenas os primeiros que aparecem agora.

Confirmação no DB:
- `servicos` 35dd6fb5… (Gleice, placa LTV3631) e 1ceb80e7… (João Victor, placa RKL6I08) existem, ambos `vistoria_entrada / concluida`.
- Coluna `categoria` ausente em `veiculos` (apenas `placa, marca, modelo, ano_modelo, cor, valor_fipe, combustivel, cobertura_roubo_furto, cobertura_total` existem).

## Plano (mudança mínima, só frontend)

**Arquivo:** `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`, linha 57.

1. Remover `categoria` do select do join `veiculo:veiculo_id(...)`. O campo não é referenciado em nenhum lugar do arquivo (`rg veiculo.categoria` não retorna ocorrências), então remover é seguro e não quebra nenhum render.
2. Validar abrindo o detalhe da Gleice (`35dd6fb5-3e68-45cd-9526-37202cba2128`) e do João Victor (`1ceb80e7-5c7b-4cab-880f-8c70c8abbedd`) como diretor — devem carregar com fotos, vistoria, documentos e botões Aprovar/Reprovar.

## Por que não é paliativo

A coluna nunca existiu em `veiculos` — categoria é por contrato/derivada. O SELECT estava simplesmente errado. A correção elimina o 400 do PostgREST que era a única causa do "Serviço não encontrado". Não há trade-off, não há feature perdida, não há mudança de schema.

## Fora de escopo

- Nenhuma migration.
- Nenhuma mudança em hooks de fila, edge functions, RLS ou fluxo de aprovação.
