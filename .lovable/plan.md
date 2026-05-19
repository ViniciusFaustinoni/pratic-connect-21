## Causa raiz — Tarefa duplicada do Alexandre Gutti (KRN9E64)

Cotação `d244312f` (Ford Ka, FIPE R$36.469 → **acima do mínimo**, autovistoria é OPCIONAL e instalação técnica é OBRIGATÓRIA).

Timeline auditado (`logs_auditoria` + `contratos_historico`):

```
17:43  contrato criado, termo enviado/assinado
17:55  finalizar-autovistoria-cotacao roda
       → cria vistoria a3353a69 (modalidade=autovistoria, origem=autovistoria_publica)
       → cria servico 31009ff6 (tipo=vistoria_entrada, vistoria_origem_id=a3353a69)
18:12  status_contratacao=aguardando_aprovacao_cadastro (autovistoria concluída)
18:14  cliente escolhe Vistoria Base no link público
       → cria agendamento_base 5f96e7ca (data=19, horario=13:00, oficina_id)
       → tipo_vistoria=agendada_base, status_contratacao=vistoria_agendada
```

Por isso a fila mostra **dois cards** para o mesmo Alexandre:
- `Vistoria de Entrada (Instalação) — 09:00` ← servico 31009ff6 (origem autovistoria)
- `Vistoria Base — 13:00` ← agendamento_base 5f96e7ca (origem Vistoria Base na oficina)

Dois bugs combinados produzem a duplicação:

1. **Servico de autovistoria não é fechado quando o cliente agenda Vistoria Base depois**
   Não existe gatilho que, ao inserir `agendamentos_base` para uma cotação que JÁ tem `servicos.vistoria_origem_id` apontando para uma vistoria de modalidade `autovistoria`, marque esse servico como terminal. Resultado: ele continua `pendente` e aparece na fila.

2. **`fn_materializar_servico_vistoria_sub_fipe` não se aplica (veículo precisa rastreador)** e a única chance de "esvaziar" o servico de autovistoria seria via `aprovar-proposta` (memória `autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria`). Mas como o Cadastro **ainda não aprovou** (`cadastro_aprovado=false`), o servico permanece visível. E mesmo após a aprovação, o filtro de dedup precisa enxergar a marca de "autovistoria" no servico (no banco a coluna `modalidade` deste registro veio `presencial` — divergência sobre a qual o filtro tropeça).

> ⚠️ Note que **não é** um problema do `dedupe_agendamentos_base_on_insert` (esse só dedup entre agendamentos_base). Também **não é** um problema do `criar-instalacao-pos-pagamento` (esse já tem guards e nem chegou a rodar). É o vácuo entre "autovistoria opcional" e "agendamento de vistoria presencial" feito pelo mesmo cliente.

---

## Plano

### Parte 1 — Sanear o caso do Alexandre (migration)

- `UPDATE servicos SET status='aprovada', modalidade='autovistoria', analisado_em=now(), observacoes=observacoes || ' [Saneado: cliente também agendou Vistoria Base 19/05 13:00 — autovistoria fica como aprovada terminal, fora da fila]' WHERE id='31009ff6-8627-4aae-a237-db5ac07ac336';`
- `UPDATE vistorias SET modalidade='autovistoria' WHERE id='a3353a69-557b-4294-a598-110387d8eab0';` (idempotente)
- Insert em `contratos_historico` documentando a deduplicação manual.

Resultado: apenas o card **Vistoria Base 13:00** continua visível na fila.

### Parte 2 — Fix sistêmico (trigger DB)

Criar `fn_dedup_autovistoria_ao_agendar_base` em `agendamentos_base` (AFTER INSERT):

```sql
-- Quando entra um agendamento_base para uma cotação cuja autovistoria
-- materializada gerou servico vistoria_entrada pendente, fecha esse servico
-- como 'aprovada' terminal (a autovistoria do cliente vira insumo, não tarefa).
UPDATE servicos s
   SET status='aprovada',
       modalidade='autovistoria',
       analisado_em=now(),
       observacoes = COALESCE(observacoes,'') ||
         E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Fechada automaticamente: cliente agendou Vistoria Base (agendamento '||NEW.id::text||').'
  FROM vistorias v
 WHERE s.vistoria_origem_id = v.id
   AND v.cotacao_id = NEW.cotacao_id
   AND v.modalidade = 'autovistoria'
   AND s.status NOT IN ('aprovada','reprovada','aprovada_ressalvas','concluida','cancelada');
```

### Parte 3 — Garantir gravação consistente em `finalizar-autovistoria-cotacao`

Auditar o servico do Alexandre mostrou `modalidade='presencial'` apesar do código gravar `'autovistoria'` (provavelmente um caminho antigo). Adicionar guard no edge: após o `INSERT`/`UPDATE` em `servicos`, fazer `UPDATE servicos SET modalidade='autovistoria', origem='autovistoria_publica' WHERE id=:id AND (modalidade IS DISTINCT FROM 'autovistoria' OR origem IS DISTINCT FROM 'autovistoria_publica')` para fechar a brecha.

### Parte 4 — Memória

Atualizar `mem://logic/operations/autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria` adicionando a regra: **"Quando o cliente faz autovistoria opcional E DEPOIS escolhe Vistoria Base, o servico de autovistoria é fechado automaticamente como 'aprovada' terminal (trigger `trg_dedup_autovistoria_ao_agendar_base`) — não espera aprovação do Cadastro."**

---

## Validação após aplicar

```sql
-- Fila do Alexandre deve mostrar SÓ a Vistoria Base 13:00
SELECT 'servico' src, id, tipo, status, modalidade, data_agendada, hora_agendada
  FROM servicos WHERE vistoria_origem_id='a3353a69-557b-4294-a598-110387d8eab0'
UNION ALL
SELECT 'agendamento_base', id, status, NULL, NULL, data_agendada, horario
  FROM agendamentos_base WHERE cotacao_id='d244312f-a2a1-4423-bb5c-e2064032eb7e';
```

Esperado: servico = `aprovada` (terminal, fora da fila), agendamento_base = `agendado` (único card visível).

Arquivos: 1 migration (Partes 1+2), `supabase/functions/finalizar-autovistoria-cotacao/index.ts` (Parte 3), memória (Parte 4).