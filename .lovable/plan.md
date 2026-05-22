## Bug: badge "Roubo & Furto: Não optou" para quem optou pela autovistoria enxuta

### Diagnóstico (placa KRN9E64 / contrato CTR-20260519174318-1KFIG7)

| Campo | Valor | Significado |
|---|---|---|
| `cotacoes.valor_fipe` | R$ 36.469 | **Acima** do mínimo de R$ 30k (carro) → autovistoria opcional |
| `cotacoes.tipo_vistoria` | `agendada_base` | Tem vistoria presencial agendada |
| `vistorias.modalidade` | `autovistoria` | **Cliente também fez a autovistoria enxuta** (intencional, para antecipar R/F) |
| `veiculos.cobertura_roubo_furto` | `false` | Só vira `true` DEPOIS que o Cadastro aprovar a autovistoria |
| `plano_tem_roubo_furto` | (a confirmar — plano inclui R/F) | |

A badge em `PropostaDetalhesTabs.tsx:205` lê **apenas** `proposta.veiculo_cobertura_roubo_furto` (vindo de `veiculos.cobertura_roubo_furto`). Esse campo é inicializado `false` em `contrato-gerar` e só flipa em `aprovar-proposta`. Por isso, durante toda a janela "cliente já optou + Cadastro ainda não aprovou", o sistema rotula como "Não optou", contradizendo o próprio stepper que mostra "Liberar Cobertura R&F — Autovistoria enxuta".

A raiz é **conceitual**: o campo `cobertura_roubo_furto` representa "cobertura **ativada** no veículo", não "cliente **optou**". A badge mistura as duas coisas.

### Correção na raiz (sem mexer em DB nem fluxos)

Derivar um flag `optou_roubo_furto` no `usePropostasPendentes.ts` (e na variante por contrato) que reflita **intenção**, não estado de ativação:

```
optou_roubo_furto =
   veiculo.cobertura_roubo_furto === true          // já ativado
|| temAutovistoria === true                         // cliente fez/materializou autovistoria
|| plano_tem_roubo_furto === true                   // plano inclui R/F por padrão
```

Justificativa por cláusula:
1. `cobertura_roubo_furto=true` → já liberado (Cadastro aprovou).
2. `temAutovistoria` → variável já existente (`autovistoriaCompleta || temVistoriaPresencialMaterializada` — linha 767 do hook). Se cliente materializou autovistoria enxuta, o único motivo de fazê-la acima do mínimo FIPE é antecipar R/F. Logo, optou.
3. `plano_tem_roubo_furto` → se o plano contratado já inclui R/F, o cliente optou no momento da cotação.

Na UI (`PropostaDetalhesTabs.tsx`):
- Trocar a leitura para `proposta.optou_roubo_furto`.
- Manter os mesmos rótulos visuais ("Sim — optou" / "Não optou").
- Opcional: quando `optou_roubo_furto=true && veiculo.cobertura_roubo_furto=false`, mostrar tooltip "Optou via autovistoria enxuta — aguardando aprovação do Cadastro para ativar".

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/usePropostasPendentes.ts` | Adicionar campo `optou_roubo_furto: boolean` na interface `PropostaPendente`; calcular no map principal (linha 824) e no `usePropostaPorContrato` (linha 1543) usando `temAutovistoria` + `veiculoContrato?.cobertura_roubo_furto` + `planoTemRouboFurto`. |
| `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` | Trocar `proposta.veiculo_cobertura_roubo_furto` (linha 205) por `proposta.optou_roubo_furto`. Tooltip opcional explicando "aguardando ativação". |

### Não-mudanças (escopo)

- **Não** altero `veiculos.cobertura_roubo_furto` no DB nem o fluxo de `aprovar-proposta` — esse campo continua sendo "ativado", e o trigger/edge de ativação continuam responsáveis por flipá-lo.
- **Não** crio campo persistido — derivação é puramente de leitura, sem custo de migração nem risco de regressão em fluxos automáticos.
- **Não** mexo no card "Liberar Cobertura R&F" (stepper) — ele já está correto.

### Validação após o ajuste

1. Abrir `/cadastro/aprovar-proposta/<id>` para KRN9E64 → badge deve mostrar "Sim — optou".
2. Smoke em proposta nova sem autovistoria e plano sem R/F → continua "Não optou".
3. Smoke em proposta com cobertura já ativada → "Sim — optou" (sem mudança).