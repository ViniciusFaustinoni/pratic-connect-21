## Diagnóstico — DOUGLAS / KZK1I95 (sub-FIPE)

Estado atual no banco (diferente do que a migration anterior pretendia — os flags voltaram para "aprovado"):

| Entidade | Campo | Valor atual | Esperado (sub-FIPE em Cadastro) |
|---|---|---|---|
| `associados` | `status` | `aguardando_aprovacao_monitoramento` | `em_analise` |
| `contratos` (`ae3b10af`) | `cadastro_aprovado` | `true` | `false` |
| `contratos` | `aprovado_em` / `aprovado_por` | preenchidos | `NULL` |
| `veiculos` | `cobertura_roubo_furto` | `true` (R/F já liberado) | `false` (Cadastro libera) |
| `veiculos` | `cobertura_suspensa` | `true` | `true` (mantém) |
| `vistorias` (`0b97ef06`) | `status='pendente'`, `modalidade='autovistoria'`, 3 fotos (enxuta) | — | mantém como autovistoria pendente para análise |
| `servicos` `vistoria_entrada` (`fc91afa8`) | `status='em_analise'`, sem profissional | — | mantém |

Resultado: ele pulou Cadastro, foi direto pro Monitoramento com R/F já liberado e cobertura ativa via fluxo enxuta — exatamente o cenário que o sub-FIPE deve impedir.

## Correção (somente este caso — sem mexer em código)

1. `UPDATE associados SET status='em_analise' WHERE id='e1823797-eaf9-4e97-8f20-dd1e7276f485'`
2. `UPDATE contratos SET cadastro_aprovado=false, aprovado_em=NULL, aprovado_por=NULL WHERE id='ae3b10af-100a-462d-8394-6be39a54d801'`
3. `UPDATE veiculos SET cobertura_roubo_furto=false, cobertura_total=false, cobertura_suspensa=true WHERE placa='KZK1I95'`
4. Nota de auditoria nas 3 tabelas: `[2026-05-18] Sub-FIPE: devolvido ao Cadastro — autovistoria enxuta (3 fotos) será reavaliada; Monitoramento decide depois se exige vistoria presencial.`

Após isso, DOUGLAS aparece em **Cadastro › Propostas/Análise** com a autovistoria pendente. Quando o Cadastro aprovar manualmente, R/F é liberado e o veículo segue para o Monitoramento como o fluxo canônico sub-FIPE.

## O que NÃO está no escopo deste plano (pergunto antes de seguir)

- **SGA Hinova**: o veículo já foi promovido a ATIVO manualmente no painel. Quer que eu rebaixe (`alterar-situacao-para 3 = PENDENTE`) para associado e veículo?
- **Causa raiz no link público** (gate da autovistoria enxuta passando em sub-FIPE): quer que eu investigue/feche a brecha em `finalizar-autovistoria-cotacao` para impedir que se repita?

Responda "aplica" para rodar a correção do DOUGLAS, e diga se quer que eu inclua SGA e/ou causa raiz.
