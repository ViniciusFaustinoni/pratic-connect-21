# Correção raiz — checagem SGA não detectou veículos INADIMPLENTES

## Diagnóstico

Caso Leonardo Nascimento dos Santos (codigo_hinova=1169, CPF 16007095754): o SGA tem 3 veículos sob esse CPF — FIA7E46 **ATIVO**, HHI7F74 **INADIMPLENTE** (Sandero), KXW9725 **INADIMPLENTE** (Ka+). Mesmo assim, os 2 últimos checks gravados em `sga_situacao_check` para o novo contrato (FIA7E46) retornaram `tem_debito=false, qtd_boletos_abertos=0, saldo_devedor=0` — `origem_resultado='sga'` (não foi erro transitório). A guarda do `aprovar-proposta` recebeu um "liberador" e deixou passar.

**Por quê:** a edge `sga-listar-boletos-associado` calcula débito SOMENTE somando boletos individuais retornados por `POST /listar/boleto-associado-veiculo` com status em `{pendente, vencido, aguardando_pagamento}` e valor > 0. No SGA Hinova, quando um veículo entra em situação **INADIMPLENTE**, é comum os boletos terem sido baixados/cancelados manualmente — a flag canônica fica em `situacao_financeira` do **veículo** (não do boleto).

Já existe a helper `buscarSituacaoFinanceiraVeiculo(s, codigo)` em `supabase/functions/_shared/hinova-client.ts` (`GET /buscar/situacao-financeira-veiculo/{codigo}` → retorna `'ADIMPLENTE'` / `'INADIMPLENTE'`). Ela **não é chamada em lugar nenhum** — `rg` no projeto não acha consumidor. Esse é o gap exato.

## O que muda

UI de inadimplência (gate, bypass, mensagens), `aprovar-proposta` (guarda 409) e `sga_situacao_check` (auditoria) permanecem **intocados**. Mexe apenas em:

1. `sga-listar-boletos-associado` — passa a consultar `situacao_financeira` por veículo.
2. `verificar-situacao-financeira-cadastro` — agrega `INADIMPLENTE` de veículo no `tem_debito`.
3. `SituacaoFinanceiraGate.tsx` — quando bloqueio vem por situação do veículo (sem boletos detalhados), lista placa/modelo/situação.
4. Reverificação retroativa para Leonardo + varredura preventiva.

## Plano

### 1. `sga-listar-boletos-associado` — consultar situação por veículo

Após enumerar veículos via `buscarAssociadoComVeiculosPorCpf`, fazer (sequencial, dentro de `withHinovaAuthRetry` como já se faz para boletos) chamada extra `buscarSituacaoFinanceiraVeiculo(session, codigo_veiculo)` para cada um. Adicionar ao tipo `VeiculoSGA`:

```text
situacao_financeira: 'ADIMPLENTE' | 'INADIMPLENTE' | null
```

`tem_debito` final do response = `saldo_devedor_total > 0 OR veiculos.some(v => v.situacao_financeira === 'INADIMPLENTE')`.

Falha 404/parse na situação por veículo → `null` (tolera; cai no comportamento atual). Falha transitória mantém o caminho `erro_transitorio` que já existe.

### 2. `verificar-situacao-financeira-cadastro` — agregar veículo inadimplente

No bloco "5. Determinar inadimplência", além de somar boletos vencidos, contar `veiculos_inadimplentes`:

```text
const inadimplentes = (sgaResp.veiculos || []).filter(v => v.situacao_financeira === 'INADIMPLENTE')
const temDebito = qtd > 0 || inadimplentes.length > 0
```

Persistir em `sga_situacao_check.motivo` algo legível quando o bloqueio vier por situação ('veiculo_inadimplente_sga: HHI7F74, KXW9725') — campo já existe na tabela, sem migration.

### 3. `SituacaoFinanceiraGate.tsx` — exibir veículos inadimplentes

Quando `check.tem_debito=true` e a lista de boletos vencidos vier vazia (caso do Leonardo), renderizar tabela compacta com `payload.veiculos.filter(situacao_financeira==='INADIMPLENTE')` mostrando placa, marca/modelo, situação. Quando houver boletos, manter o atual + adicionar a coluna "Linha digitável" copiável (campo `linha_digitavel` já existe no payload). Não muda o fluxo de bypass nem o `aprovar-proposta`.

### 4. Reverificação retroativa

- **Leonardo** (contrato vinculado à cotação `c2951183`): forçar `verificar-situacao-financeira-cadastro` com `force=true` após o deploy. Como o contrato já está `ativo` (cotação `status_contratacao='ativo'`), **NÃO** reverter — apenas registrar o check correto em `sga_situacao_check` para auditoria e abrir aviso `cotacao_avisos_sga` notificando o Cadastro. Conforme pedido do usuário: "não modifique nada na cotação do anexo".
- **Varredura preventiva** (read-only): `SELECT` listando últimos 90 dias de checks com `tem_debito=false, origem_resultado='sga'` cujo associado, ao recheckar, tenha `situacao_financeira='INADIMPLENTE'` em algum veículo. Relatar no chat para decisão caso a caso (não rebobinar automaticamente cotações ativas — risco de dano).

### 5. Memória

Atualizar `mem://logic/operations/sga-inadimplencia-veiculo-canonica` documentando:
> Inadimplência no SGA tem DUAS dimensões: boletos vencidos (`POST /listar/boleto-associado-veiculo`) E situação do veículo (`GET /buscar/situacao-financeira-veiculo/{codigo}`). Ambas DEVEM ser consultadas no gate de Cadastro — boletos podem ter sido baixados manualmente mantendo o veículo em INADIMPLENTE.

## Fora de escopo

- Cotação `c2951183` (Leonardo, FIA7E46) — **não tocar**. Já está `ativo`. Só registrar check correto para auditoria.
- `aprovar-proposta` (guarda 409 já correta — passou a falhar porque o insumo `sga_situacao_check` veio errado).
- `aprovar-troca-cadastro` (mesma guarda já existe; será beneficiada automaticamente).
- UI de bypass/Diretor.
- Migrações de schema (`sga_situacao_check.motivo` já existe).

## Detalhe técnico

- `supabase/functions/sga-listar-boletos-associado/index.ts`: importar `buscarSituacaoFinanceiraVeiculo`, chamar dentro do loop sequencial atual (logo após `listarBoletosVeiculo` por veículo), preencher `VeiculoSGA.situacao_financeira`, recalcular `tem_debito`.
- `supabase/functions/verificar-situacao-financeira-cadastro/index.ts`: novo agregador `inadimplentes`, ajustar `temDebito`, popular `motivo` quando vier por situação.
- `src/components/cadastro/SituacaoFinanceiraGate.tsx`: novo bloco "Veículos inadimplentes no SGA" + coluna "Linha digitável" copiável na tabela de boletos.
- Para o passo 4 (Leonardo): chamada one-shot via `supabase.functions.invoke('verificar-situacao-financeira-cadastro', {contrato_id, force:true})` após deploy + insert manual em `cotacao_avisos_sga`.

Aprova para executar?
