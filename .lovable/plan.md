## Objetivo

Apagar do banco TODO registro de:
- **MARCOS VINICIUS DATIVO MACHADO** (id `53dabfdc-98c4-42c3-ae86-371a93809917`, CPF 14194896742, hinova 25645)
- **MARCUS VINICIUS FAUSTINONI DE FREITAS** (id `1723a600-199d-48fb-993d-e1f3422b5618`, CPF 12493649737)

Inclui os 3 veículos **KOU6D37**, **QOO5C17** e **LTB4J74**, o contrato ativo `979566ad…`, e o desvínculo do rastreador `1985dc09…` (volta ao estoque).

## Execução (migração SQL única em transação)

```text
1. Desvincular rastreador 1985dc09… (LTB4J74)
   → veiculo_id=NULL, associado_id=NULL, status='estoque'
2. Apagar registros filhos pelos veículos (idempotente, IF EXISTS por tabela):
   - servicos, instalacoes, vistorias, vistoria_fotos, agendamentos_base,
     coberturas_veiculo (se houver), substituicoes, ordens_servico
3. Apagar contrato 979566ad-0e20-4d3e-b3ad-cf6cb85075ff
   (cobranças, mensalidades e dependentes via CASCADE existente)
4. Apagar veiculos: af4c89bf… (LTB4J74), d6af73ae… (QOO5C17), f2595b44… (KOU6D37)
5. Apagar registros do associado:
   - cobrancas, documentos, leads, notificacoes, conversas/mensagens whatsapp
     (todos por associado_id, IF EXISTS)
6. Apagar associados 53dabfdc… e 1723a600…
```

A migração usa `DELETE … WHERE … IN (...)` com os UUIDs literais e roda dentro de uma transação. Tabelas já configuradas com `ON DELETE CASCADE` cuidam do restante automaticamente.

## Importante

- **Operação irreversível.** Após executar, não há undo via histórico do app — só restauração de backup.
- O **rastreador volta para estoque** (não é apagado), pois é hardware físico.
- **Não é feita nenhuma chamada ao SGA Hinova** para inativar o associado 25645 — o registro lá permanece. Se quiser que eu inative no SGA também, me avise.
- **Não removo o `auth.users`** vinculado (caso exista profile com login) — só o registro em `public.associados` e seus dados. Posso remover o usuário de auth depois se você confirmar.

## Pós-execução

Confirmação por SELECT mostrando 0 linhas para ambos associados, 0 para placa KOU6D37, e o rastreador 1985dc09… em status 'estoque'.
