## Diagnóstico — por que LLF7F07 não apareceu na Aprovação de Associados

**Linha do tempo do contrato `9326ba5a` (placa LLF7F07, FIPE R$ 29.178 → sub-FIPE car <30k):**

```text
04/05 17:54:59  contrato: pendente_vistoria → aguardando_instalacao (trigger DB)
04/05 17:55:04  contrato: aguardando_instalacao → ATIVO
                source = edge:ativar-associado <- edge:aprovar-proposta
                payload: jaTemInstalacaoConcluida=false, planoTemRouboFurto=true
18/05 15:55     fotos canônicas sub-FIPE materializadas (3: motor, chassi, video_360)
                vistorias.status = pendente, modalidade=autovistoria
20/05 15:51-15:58  técnico executa vistoria presencial completa (31 fotos + selfie + assinatura)
                   instalacoes.status = concluida (dispensa_rastreador=true)
                   cotacoes.status_contratacao já era 'ativo' desde 04/05
```

**Causa raiz (não é bug atual, é resíduo histórico):**

- O contrato foi promovido a `ativo` em **04/05/2026**, antes da blindagem `aprovar-proposta` que hoje (linha 815 do arquivo) força sub-FIPE / "ninguém precisa de rastreador" a aguardar Monitoramento.
- Na época, `aprovar-proposta` chamava `ativar-associado` direto mesmo com `jaTemInstalacaoConcluida=false`, pulando a fila.
- Quando as fotos chegaram em 20/05, **não havia mais nada para enfileirar**: o contrato já estava ativo há 16 dias. Por isso a aba Aprovação de Associados não mostra nada.

**Confirmação da guarda atual:** `aprovar-proposta` (linhas 811-851) já decide corretamente `deveAguardarInstalacao = !jaTemInstalacaoConcluida || !algumPrecisouRastreador` → contrato fica `assinado` + associado `aguardando_aprovacao_monitoramento`. Novos casos não vazam mais.

**6 contratos irmãos na mesma situação** (todos com vistoria materializada em 18/05 15:55, status=pendente, contrato=ativo):

| Placa    | FIPE      | Contrato |
|----------|-----------|----------|
| LLF7F07  | 29.178    | 9326ba5a |
| KNO3F78  | 19.838    | ac1b293b |
| LMF8I79  | 31.935    | 8455c419 |
| PYN0C82  | 48.708    | bd6e5b00 |
| LPE3902  | 17.116    | 176a17c4 |
| KOA4D63  | 11.053    | 1dca5199 |

> Observação: LMF8I79 (R$ 31.935) e PYN0C82 (R$ 48.708) estão **acima** do mínimo carro (30k). Eles caíram no mesmo job de materialização retroativa mas precisam de tratamento separado — neles a autovistoria é opcional/enxuta, não obrigatória.

---

## Plano de correção

### Parte 1 — Higienização auditada dos 4 sub-FIPE legítimos (LLF7F07, KNO3F78, LPE3902, KOA4D63)

Para cada um, em uma única migration auditada:

1. Marcar `vistorias.status = 'aprovada'` (modalidade autovistoria) com `observacoes` prefixado por `[SANEAMENTO 20/05/2026] Vistoria presencial completa do técnico em <data> supre a aprovação retroativa — contrato já estava ativo desde <data_ativacao> por vazamento pré-blindagem sub-FIPE em aprovar-proposta.`
2. Promover o `servico vistoria_entrada` órfão para `status = 'concluida'` (vinculando ao `instalacao_origem_id` da instalação que de fato fechou), preservando histórico no `observacoes`.
3. Registrar evento em `logs_auditoria` apontando que a "aprovação de Monitoramento" foi suprida pela vistoria presencial executada em 20/05.
4. **Não** mexer em SGA — o contrato já está sincronizado.

### Parte 2 — Tratamento dos 2 contratos acima-FIPE (LMF8I79, PYN0C82)

Nesses casos a autovistoria era opcional e a presencial foi feita. Mesmo tratamento: marcar `vistorias.status='aprovada'` com `[SANEAMENTO]` e fechar o `servico vistoria_entrada` se ainda estiver vivo. Estes não pertencem ao fluxo sub-FIPE; o "vazamento" não os afetou diretamente porque acima-FIPE pode ativar com autovistoria opcional.

### Parte 3 — Garantia anti-recorrência

A guarda canônica em `aprovar-proposta` (linha 815) **já está ativa** — sub-FIPE não promove mais via `aprovar-proposta`. Nenhuma alteração de código é necessária.

Adicionar um teste de regressão SQL ligeiro (view materializada ou query agendada de auditoria) que detecta:

```sql
-- "Vazamento sub-FIPE": contrato ativo + vistoria autovistoria pendente
SELECT v.id FROM vistorias v
JOIN contratos c ON c.id = v.contrato_id
WHERE v.modalidade='autovistoria' AND v.status='pendente' AND c.status='ativo';
```

Disparar alerta (`ativacao_limbo_alertas`) quando o resultado for >0 fora dos 6 conhecidos.

### Parte 4 — Validação final

- Reconsultar a query da Parte 3 e confirmar 0 vazamentos pós-saneamento.
- Reconsultar `ativacao_status_log` do LLF7F07 — sem nova promoção.
- Confirmar que a aba "Aprovação de Associados" continua mostrando apenas casos ainda pendentes.

### Fora do escopo

- Reversão de status do contrato para "voltar para fila" — os 6 contratos já estão ativos há semanas, com cobertura efetiva e fotos completas; reverter quebraria SGA e a relação com o associado.
- Mudança em `aprovar-proposta` — guarda atual está correta.
- Backfill de fotos retroativo — todas as fotos já estão materializadas em `vistoria_fotos`.

### Resposta direta à pergunta

A regra canônica não está quebrada **hoje**. O LLF7F07 é um caso pré-blindagem: foi ativado em 04/05 quando `aprovar-proposta` ainda chamava `ativar-associado` direto para sub-FIPE. As fotos de 20/05 não chegaram a entrar na fila porque o contrato já estava `ativo` há 16 dias — não há nada para "aprovar". A higienização proposta apenas regulariza a auditoria dos 6 casos órfãos da época.
