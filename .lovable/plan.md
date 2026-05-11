## Problema

Na troca de titularidade, quando o monitoramento solicita vistoria, o novo titular executa pelo link público. As fotos/vídeo são salvos em `vistoria_fotos`, ligadas a uma `vistoria` cujo `veiculo_id` é o **mesmo veículo sendo transferido** (NOT NULL na tabela). Porém o histórico de mídias do veículo (`useFotosVistoriaPorVeiculo`, exibido em `VeiculoDetalhesModal` → aba "Fotos/Docs") busca por **caminho indireto**:

```
veiculos → contratos.veiculo_id → vistorias.contrato_id → vistoria_fotos
```

Esse caminho perde fotos quando:
- A vistoria foi criada **antes** do contrato do novo titular existir/ser vinculado.
- A vistoria está vinculada apenas via `instalacao_id`/`cotacao_id` e `contrato_id` ainda nulo.
- Em geral, qualquer vistoria sem `contrato_id` populado.

Resultado: as fotos da vistoria de troca de titularidade não aparecem no histórico do veículo.

## Mudança (1 arquivo, sem schema)

### `src/hooks/useVeiculoDetalhes.ts` — `useFotosVistoriaPorVeiculo`

Trocar o caminho indireto por consulta direta à tabela `vistorias` por `veiculo_id` (campo NOT NULL e canônico):

```
1) vistorias.select('id, status, modalidade, tipo, created_at').eq('veiculo_id', veiculoId)
2) vistoria_fotos.select(...).in('vistoria_id', vistoriaIds).order('created_at')
3) Enriquecer cada foto com vistoria_status / vistoria_modalidade (já feito) +
   vistoria_tipo (entrada / saida / sinistro) e vistoria_created_at — útil para o agrupamento
```

Isso pega automaticamente:
- Vistorias originais do contrato vigente.
- Vistorias da troca de titularidade (executadas pelo novo titular pelo link público).
- Qualquer vistoria futura (saída, sinistro, periódica) ligada ao veículo.

Manter a interface `FotoVistoriaVeiculo` retro-compatível (apenas adicionar campos opcionais; nada é removido). `VeiculoDetalhesModal` continua funcionando sem alteração — o `agruparFotosVeiculo` agrupa por `tipo` da foto, não da vistoria.

## Fora de escopo

- Nenhuma mudança em edge functions, RLS, schema ou no fluxo de criação da vistoria.
- Nenhuma alteração visual no `VeiculoDetalhesModal` (a aba "Fotos/Docs" passa a mostrar mais itens automaticamente).
- Histórico de **vídeos** (`vistorias.video_360_url`) — atual modal só lista fotos; se desejado posteriormente, podemos expor o vídeo da vistoria como item separado.
