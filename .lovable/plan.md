
# Hard delete: MARCOS VINICIUS DATIVO MACHADO

> ⚠️ **Operação irreversível**. Os registros abaixo serão fisicamente removidos. Auditoria e histórico do associado serão perdidos para sempre.

## Pessoas no escopo

| Nome | Status no sistema |
|---|---|
| **MARCOS VINICIUS DATIVO MACHADO** (CPF 141.948.967-42, marcosdativo@gmail.com) | ✅ Encontrado — será apagado |
| **VINICIUS FAUSTINONI** | ❌ **Não localizado** — pendente CPF/email/grafia correta. Não será tocado nesta rodada. |

## Footprint do MARCOS hoje no banco

| Entidade | Qtd | Detalhe |
|---|---|---|
| `associados` | 1 | id `a96c1136…eedc67`, status `ativo` |
| `contratos` | 2 | — |
| `veiculos` | 3 | KOU6D37 (ativo, com rastreador), QOO5C17 e LTB4J74 (em_analise) |
| `cotacoes` | 2 | ambas em status avançado (ativo / contrato_assinado) |
| `rastreadores` vinculados | 1 | IMEI 863829079148639 — **NÃO será deletado**, apenas desvinculado |
| `servicos` / `vistorias` | 1 / 1 | atrelados ao fluxo do KOU6D37 |
| `associados_historico` | 10 | apagados junto |
| `contratos_documentos`, `instalacoes`, `sga_sync_queue`, `analises_relacionamento` | 0 | nada a fazer |

## Plano de execução (migração única, transacional)

A ordem respeita FKs e os triggers existentes (`trg_cascata_cancelamento_associado`, guards `trg_guard_*`). Todas as ações em um único `BEGIN…COMMIT`.

```text
1. Desvincular rastreador físico (preservar asset)
   UPDATE rastreadores
     SET veiculo_id = NULL, status = 'em_estoque', desvinculado_em = now(),
         motivo_desvinculo = 'hard_delete_marcos_dativo'
     WHERE veiculo_id IN (veículos do MARCOS);

2. Limpar dependências de cotações
   DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id IN (...);
   DELETE FROM cotacoes_documentos     WHERE cotacao_id IN (...);
   DELETE FROM contratos_documentos    WHERE contrato_id IN (...);
   DELETE FROM vistoria_fotos          WHERE vistoria_id IN (...);
   DELETE FROM vistorias               WHERE associado_id = :id;
   DELETE FROM servicos                WHERE associado_id = :id;
   DELETE FROM agendamentos_base       WHERE servico_id IN (...) OR vistoria_origem IN (...);
   DELETE FROM instalacoes             WHERE contrato_id IN (...);     -- safety
   DELETE FROM sga_sync_queue          WHERE associado_id = :id;       -- safety
   DELETE FROM analises_relacionamento WHERE associado_id = :id;       -- safety

3. Apagar contratos, veículos, cotações
   DELETE FROM contratos WHERE associado_id = :id;
   DELETE FROM veiculos  WHERE associado_id = :id;
   DELETE FROM cotacoes  WHERE cliente_cpf = '141.948.967-42'
                            OR email_solicitante = 'marcosdativo@gmail.com';

4. Apagar histórico e associado
   DELETE FROM associados_historico WHERE associado_id = :id;
   DELETE FROM associados           WHERE id = :id;

5. Auditoria mínima fora da entidade
   INSERT INTO logs_auditoria(acao, entidade, descricao, ...)
     VALUES ('excluir', 'associado',
             'Hard delete MARCOS VINICIUS DATIVO MACHADO (CPF 141.948.967-42) por solicitação direta');
```

> O script descobre tabelas dependentes adicionais via `pg_depend` antes do COMMIT — se aparecer FK não listada (ex.: `solicitacoes_troca_titularidade`, `cobrancas`, `mensalidades`), o script aborta e me devolve a lista para eu decidir.

## Pendências antes de executar

1. **Confirmar deleção do MARCOS** entendendo que histórico, contratos, cotações, vistorias e cobranças associadas somem do banco para sempre (SGA/Autentique não são tocados — limpeza lá é manual).
2. **Fornecer dado do VINICIUS FAUSTINONI** (CPF, e-mail, telefone ou grafia alternativa) para eu localizar antes de qualquer ação.

Sem o item 2 eu executo só o MARCOS e devolvo o VINICIUS para uma segunda rodada.
