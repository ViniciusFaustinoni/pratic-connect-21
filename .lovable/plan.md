## 🎯 Problema confirmado

O link público da cotação não acompanha a fase real do funil porque `cotacoes.status_contratacao` fica **travado em estados intermediários** (`aguardando_aprovacao_cadastro`, `vistoria_ok`, etc.) mesmo após o associado/contrato terem sido ativados. O Cadastro › Propostas Pendentes acerta porque deriva a etapa de várias tabelas (`contratos`, `associados`, `instalacoes`), mas o **link público depende exclusivamente** de `cotacoes.status_contratacao`.

## 📊 Casos detectados (varredura completa)

3 cotações estão hoje no estado inconsistente "tudo concluído mas status_contratacao travado":

| Cotação | Cliente / Placa | status_contratacao | Realidade |
|---|---|---|---|
| `5115004f…b48a` | ANDRE COELHO · LUB5F76 | `aguardando_aprovacao_cadastro` | Associado ativo, contrato ativo, adesão paga, instalação concluída |
| `2310279e…a832` | LEONARDO C. SILVA · LQM4E19 | `aguardando_aprovacao_cadastro` | Contrato assinado, adesão paga, instalação agendada (não concluída) |
| `825a2dad…4269` | RICARDO A. T. SOARES · RKD2A94 | `vistoria_ok` | Associado ativo, contrato assinado, sem instalação registrada |

Total de cotações com associado/contrato já ativos: **76** — só **74** estão corretas em `status_contratacao='ativo'`.

## 🗺️ Mapa de solução (3 frentes)

### Frente 1 — Backend canônico: `recompute_cotacao_status_contratacao` passa a AVANÇAR

Hoje a função preserva os estados pós-autovistoria (memória `recompute-cotacao-preserva-pos-autovistoria`). Vamos manter "não rebobina", **mas habilitar promoção para a frente** com base nos marcos reais:

```text
Se status_contratacao ∈ {aguardando_aprovacao_cadastro,
                         aguardando_aprovacao_monitoramento,
                         vistoria_concluida, vistoria_ok,
                         contrato_assinado, autovistoria_ok}:

  if associado.status='ativo' AND contrato.status ∈ {'assinado','ativo'}
     → status_contratacao = 'ativo'
  elif contrato.adesao_paga=true AND contrato.status ∈ {'assinado','ativo'}
       AND EXISTS instalacao concluida/aprovada
     → status_contratacao = 'pagamento_ok' (ou 'contrato_gerado' se preferir)
  elif contrato.adesao_paga=true AND contrato.status ∈ {'assinado','ativo'}
     → status_contratacao = 'pagamento_ok'
```

- Adicionar triggers que chamem o recompute **após mudança em `contratos.status`/`adesao_paga`, `associados.status`, `instalacoes.status`**. Hoje só dispara em mudanças de `cotacoes`.
- Mantém a regra dura "nunca rebobina"; só promove para o nível canonicamente mais avançado.

### Frente 2 — Frontend defensivo no link público

Mesmo com o backend correto, o link público não deve depender só de `status_contratacao`:

- Adicionar query secundária pública em `useCotacaoContratacao` para puxar `contrato.status`, `adesao_paga`, `associado.status` e `instalacoes` da cotação.
- Criar `src/lib/cotacaoEtapaPublica.ts` (puro, testável) que recebe esse snapshot e devolve o índice de etapa **e** uma flag `concluido` para o stepper.
- Em `CotacaoContratacao.tsx`: novo estado **"concluido"** → todos os 6 steps marcados + badge "✅ Associado Ativo · em monitoramento".
- Adicionar realtime: subscrever `contratos` (por id), `associados` (por id) e `instalacoes` (por cotacao_id) — invalidar a query no cache em cada evento.
- Estados `aguardando_aprovacao_cadastro` / `aguardando_aprovacao_monitoramento` exibem badge "Em análise" no step de Vistoria (não voltam para Plano).

### Frente 3 — Backfill controlado dos 3 casos travados

Migration única e idempotente (não roda no Andre/Leonardo/Ricardo de forma especial — usa a **mesma regra** da Frente 1, aplicada uma vez a TODAS as cotações):

```sql
UPDATE cotacoes c
SET status_contratacao = 'ativo'
FROM contratos ct JOIN associados a ON a.id = ct.associado_id
WHERE ct.id = c.contrato_gerado_id
  AND a.status = 'ativo'
  AND ct.status IN ('assinado','ativo')
  AND c.status_contratacao NOT IN ('ativo','contrato_gerado','cancelado');

UPDATE cotacoes c
SET status_contratacao = 'pagamento_ok'
FROM contratos ct
WHERE ct.id = c.contrato_gerado_id
  AND ct.adesao_paga = true
  AND ct.status IN ('assinado','ativo')
  AND c.status_contratacao NOT IN ('ativo','contrato_gerado','pagamento_ok','cancelado');
```

- Logar no `cotacoes_historico` com `acao='backfill_status_contratacao'` para auditoria.
- Executar **depois** que a Frente 1 estiver no ar (assim o backfill cobre histórico e o trigger cobre o futuro).

## ✅ Validação

1. Reabrir link público dos 3 casos travados → stepper deve mostrar todos os passos verdes + badge "Associado Ativo" (ANDRE/RICARDO) e "Aguardando instalação" (LEONARDO).
2. Rodar nova cotação completa em sandbox → checar que cada marco (assinatura, pagamento, instalação concluída, ativação) propaga `status_contratacao` em tempo real para o link público.
3. Conferir Cadastro › Propostas Pendentes (sem regressão — ANDRE/RICARDO devem sair da fila; LEONARDO permanece em "Aguard. Instalação").
4. Query de auditoria pós-deploy: nenhuma cotação com associado ativo deve ter `status_contratacao ≠ 'ativo'`.

## 📁 Arquivos previstos

- **Migration**: ajuste em `recompute_cotacao_status_contratacao` + novos triggers em `contratos`, `associados`, `instalacoes` + backfill dos 3 casos com log de auditoria.
- `src/hooks/useCotacaoContratacao.ts` — query secundária + realtime de contratos/associados/instalacoes.
- `src/lib/cotacaoEtapaPublica.ts` (novo) — derivação pura de etapa+flag concluído.
- `src/pages/public/CotacaoContratacao.tsx` — usar `derivarEtapaPublica`; renderizar estado terminal "Associado Ativo".
- **Memória**: atualizar `mem://logic/quotation/recompute-cotacao-preserva-pos-autovistoria` para refletir "preserva nível, mas avança quando marcos posteriores confirmam"; criar `mem://logic/quotation/link-publico-deriva-de-marcos-reais`.

## ❓ Confirmações antes de executar

1. **Backfill**: posso aplicar a regra `associado ativo + contrato assinado/ativo → status_contratacao='ativo'` em toda a base (não só nos 3 casos)? Isso é mais seguro que tratar caso a caso e fica auditado.
2. **Estado terminal no stepper público**: o badge deve dizer **"Associado Ativo · em monitoramento"** ou prefere algo mais neutro como **"Contratação concluída"**?

Se aprovar com "sim, backfill geral + badge Associado Ativo", começo pela migration (Frente 1 + Frente 3 juntas) e logo em seguida o frontend (Frente 2).
