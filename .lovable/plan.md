## Diagnóstico — LENIZIA / KXV3F40 (FIPE R$ 21.262 — sub-FIPE)

### Estado atual
- **Associado / Contrato / Veículo**: todos `ativo`, `cadastro_aprovado=true` desde **24/04** (sincronizado SGA, sem rastreador — sub-FIPE não exige).
- **Sem `instalacoes`, sem rastreador** (correto).

### O que apareceu hoje na fila
Em **18/05 15:55** (mesmo timestamp do reprocesso/saneamento de hoje), foram materializados dois registros artificiais:

| Tabela | ID | Status | Observação |
|---|---|---|---|
| `vistorias` | `4726f120` | `pendente` (autovistoria) | sem fotos próprias, sem `analisado_em` |
| `servicos` | `e5aa546d` | `agendada`, `tipo='vistoria_entrada'`, `modalidade='presencial'`, sem `profissional_id` | aponta `vistoria_origem_id=4726f120` |

O serviço espelha uma vistoria que **nasceu pendente** depois que o veículo já estava ativo há 24 dias. Como `profissional_id IS NULL`, o card aparece na fila **Monitoramento › Atribuição de Serviços**. É um fantasma do reprocesso de hoje (mesmo lote que atingiu LIDIA, DOUGLAS e outros).

### Correção (Parte 1 — só este caso)

```sql
-- Cancela o serviço fantasma
UPDATE servicos
SET status='cancelada', updated_at=now(),
    observacoes = coalesce(observacoes,'') || E'\n[2026-05-18] Cancelado: ativação já concluída em 24/04, serviço materializado artificialmente pelo reprocesso de hoje.'
WHERE id='e5aa546d-9f62-4586-a622-d85679da2f1b';

-- Marca a vistoria pendente como cancelada
UPDATE vistorias
SET status='cancelada', updated_at=now(),
    observacoes = coalesce(observacoes,'') || E'\n[2026-05-18] Cancelada: ativação concluída em 24/04 sem necessidade desta vistoria (sub-FIPE).'
WHERE id='4726f120-d6a3-4942-a753-58df1b738fbd';
```

Sem mudanças em código nem trigger neste momento — só limpa o fantasma. Veículo permanece `ativo`, contrato `ativo`, SGA inalterado.

### Pergunta (precisa antes de aplicar)
Suspeita: o reprocesso de hoje 15:55 deve ter criado fantasmas em **vários** veículos sub-FIPE já ativos. Quer que eu rode primeiro uma varredura listando todos os casos análogos (vistoria/servico criados em 18/05 15:55 com `contratos.status='ativo'` há > 7 dias) para você decidir limpar em lote, ou prefere corrigir só o KXV3F40 agora?

Aguardo "só KXV3F40" ou "lista geral primeiro" para prosseguir.