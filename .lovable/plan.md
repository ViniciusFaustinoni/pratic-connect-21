## Correção canônica: `status_contratacao='ativo'` só via caminho canônico do veículo

### Contexto
`COT-20260525-141428960-119` (substituição KOU6D37→LTB4J74) pulou Cadastro/Monitoramento e foi direto pra "Criar senha" porque `recompute_cotacao_status_contratacao` promove `status_contratacao='ativo'` quando `associado.status='ativo'` + `contrato.status IN ('assinado','ativo')`. Em substituição/inclusão o associado já está ativo de outro veículo, então o atalho dispara assim que o termo é assinado.

### Passo 1 — Patch `recompute_cotacao_status_contratacao`
Remover o atalho baseado em `associado.status`. Promoção a `'ativo'` exige TODAS as condições do contrato/veículo desta cotação:
- `contratos.cadastro_aprovado = true`
- `contratos.aprovado_em IS NOT NULL`
- `contratos.status = 'ativo'` (escrito por `ativar-associado`, não basta `'assinado'`)
- `veiculos.status = 'ativo'`

Sem isso, cai nas branches existentes (`pagamento_ok`, `contrato_assinado`, `aguardando_aprovacao_cadastro`, etc.).

### Passo 2 — Guard `trg_guard_cotacao_ativo_exige_caminho_canonico`
`BEFORE UPDATE` em `cotacoes`. Bloqueia transição para `status_contratacao='ativo'` quando o contrato vinculado não tem `cadastro_aprovado=true` + `aprovado_em IS NOT NULL` + `status='ativo'`. Última linha de defesa caso outra função/edge tente o atalho.

### Passo 3 — Backfill da cotação afetada
```sql
UPDATE cotacoes
SET status_contratacao = 'contrato_assinado'
WHERE id = 'f020bc1a-adb8-4dfb-a690-160ceaea49c4';
```
Retorna à fila do Cadastro. Loga em `logs_auditoria` (`acao='atualizar'`, descrição `[BACKFILL] COT-20260525-141428960-119 revertida de ativo para contrato_assinado — atalho recompute_cotacao corrigido`).

### Passo 4 — Auditoria (somente leitura, REPORTA antes de qualquer correção em massa)
```sql
SELECT c.id, c.numero_cotacao, c.tipo, c.status_contratacao,
       ct.id contrato_id, ct.status contrato_status,
       ct.cadastro_aprovado, ct.aprovado_em,
       v.placa, v.status veiculo_status
FROM cotacoes c
LEFT JOIN contratos ct ON ct.cotacao_id = c.id
LEFT JOIN veiculos v ON v.id = ct.veiculo_id
WHERE c.status_contratacao = 'ativo'
  AND (ct.cadastro_aprovado IS DISTINCT FROM true
       OR ct.aprovado_em IS NULL
       OR ct.status <> 'ativo'
       OR v.status <> 'ativo')
ORDER BY c.created_at DESC;
```
**Pausa para revisão humana antes de corrigir em massa** (decisão por linha: voltar a `contrato_assinado`, `aguardando_aprovacao_cadastro` ou manter se for caso legítimo legado).

### Passo 5 — Memória
Criar `mem://logic/operations/recompute-cotacao-respeita-caminho-canonico-do-veiculo` documentando: `associados.status='ativo'` é ruído em substituição/inclusão; única promoção legítima de `status_contratacao='ativo'` é via `ativar-associado` após Monitoramento aprovar instalação/vistoria do veículo desta cotação. Adicionar entrada no `mem://index.md`.

### Smoke tests pós-patch
1. **Substituição com associado ativo**: assinar termo → conferir que `status_contratacao` vai para `contrato_assinado` (não `ativo`) e link público mostra "Aguardando análise".
2. **Cadastro aprova + Monitoramento aprova + `ativar-associado`**: conferir que `status_contratacao` chega a `ativo` e link público libera "Criar senha".
3. **UPDATE direto** `cotacoes SET status_contratacao='ativo'` sem caminho canônico → guard bloqueia (erro esperado).
4. **Inclusão de veículo novo** (associado já ativo) → confere que segue Cadastro→Monitoramento sem atalho.

### Escopo
- **Inclui**: função `recompute_cotacao_status_contratacao`, novo trigger guard, backfill 1 linha, query de auditoria, memória.
- **Não inclui**: `ativar-associado`, `efetivar-substituicao`, guards já existentes, correção em massa (depende do resultado da auditoria).
