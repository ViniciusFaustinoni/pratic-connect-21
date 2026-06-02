
## Contexto confirmado (banco lido agora)

Cotação `4fac234b-43cb-44bf-89c7-df6e48bcfc55` (COT-20260602-102929997-543):

- `tipo_vistoria = NULL` (autovistoria nunca materializou — bate com 0 fotos)
- `vistoria_concluida_em = NULL`
- `tipo_veiculo = 'carro'`, `valor_fipe = 27315`, `veiculo_placa = LLD9569`, Fiat Siena
- `status = 'aceita'`, `status_contratacao = 'pagamento_ok'`
- `dados_extras.tipo_entrada = 'adesao'`
- Sub-FIPE legítima → `dispensa_rastreador = true` é o estado canônico (não viola `trg_guard_dispensa_rastreador_coerente`: carro abaixo de R$ 30k)

Schema relevante confirmado:

- `agendamentos_base` tem trigger `trg_agendamento_base_materializa_servico` que cria o `servicos` (tipo `vistoria_entrada`, modalidade herdada da `vistorias`) automaticamente. Esse é o caminho canônico — nada de INSERT em `servicos` direto.
- `logs_auditoria`: colunas reais são `tabela`, `registro_id`, `acao`, `descricao`, `modulo`, `dados_novos` (confirmado).
- Guards ativos sobre `cotacoes`: `trg_guard_cotacao_ativo_exige_caminho_canonico`, `trg_guard_cotacao_exige_tipo_veiculo`, `trg_guard_cotacao_troca_*`. Mudar `tipo_vistoria='agendada'` não dispara nenhum deles (são UPDATE de status/tipo_veiculo/tipo_entrada).

## Passo 1 — Migration Elisabete (caminho canônico)

Tudo em uma migration, transação única, idempotente:

```text
1. SELECT resolve: associado_id, veiculo_id, contrato_id ativos da cotação
   (via contratos.cotacao_id = cotacao.id AND status IN ('ativo','aguardando_instalacao','assinado'))
2. UPDATE cotacoes SET tipo_vistoria='agendada', vistoria_concluida_em=NULL
   WHERE id = ... AND tipo_vistoria IS DISTINCT FROM 'agendada'
3. INSERT INTO vistorias (
     associado_id, veiculo_id, contrato_id, cotacao_id,
     modalidade='presencial',
     status='agendada',  -- ou o valor canônico que sub-FIPE usa
     dispensa_rastreador=true,
     observacoes='[autovistoria_perdida_convertida_presencial] storage zerado, upload falhou silenciosamente'
   ) RETURNING id  → v_vistoria_id
4. INSERT INTO agendamentos_base (
     data_agendada=CURRENT_DATE,
     horario='09:00',
     vistoria_id=v_vistoria_id,
     cliente_nome, cliente_telefone, veiculo_placa, veiculo_descricao,
     status='agendado',
     observacoes='Conversão presencial — autovistoria perdida (upload zerado)'
   )
   → trigger trg_agendamento_base_materializa_servico CRIA o servicos vistoria_entrada
     com modalidade='presencial' (passa pelo guard de dispensa coerente; Siena 27k < 30k ok)
5. INSERT INTO logs_auditoria (
     tabela='cotacoes', registro_id=cotacao.id,
     acao='criar', modulo='vistoria',
     descricao='[autovistoria_perdida_convertida_presencial] motivo=storage_zerado upload_silenciosamente_falhou veiculo=LLD9569 fipe=27315 dispensa_legitima=true',
     dados_novos=jsonb_build_object('vistoria_id', v_vistoria_id, 'tipo_vistoria_novo','agendada')
   )
```

Antes da migration ir, vou validar 2 coisas que ficaram truncadas na leitura:
- Colunas `dispensa_rastreador` / `status` em `vistorias` (nome exato + enum/valores aceitos)
- Quais valores de `vistorias.status` o guard `validar_status_vistoria` aceita para inicial-presencial

Se houver função RPC `criar_vistoria_presencial_*` específica, ela substitui o INSERT direto em `vistorias`. Se não houver, o INSERT vai com triggers ATIVOS (auditoria, dedup, validar_status) — sem `SET session_replication_role`.

## Passo 2 — Varredura (logo após confirmar a Elisabete)

```sql
SELECT c.id, c.numero, c.created_at, c.tipo_vistoria,
       c.veiculo_placa, c.valor_fipe, c.status_contratacao
  FROM public.cotacoes c
 WHERE c.tipo_vistoria IN ('autovistoria','agendada')
   AND c.status_contratacao NOT IN ('cancelada','expirada')
   AND NOT EXISTS (
     SELECT 1 FROM public.cotacoes_vistoria_fotos f
      WHERE f.cotacao_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'cotacoes-vistoria'
        AND o.name LIKE c.id::text || '/%'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.logs_auditoria la
      WHERE la.tabela = 'cotacoes'
        AND la.registro_id = c.id
        AND la.descricao LIKE '[autovistoria_perdida_convertida_presencial]%'
   )
   AND c.created_at >= now() - interval '45 days'
 ORDER BY c.created_at DESC;
```

Filtro `[autovistoria_perdida_convertida_presencial]` já exclui a Elisabete após o Passo 1. Lista resultante define se aplico o mesmo Passo 1 em lote (mesma migration parametrizada) ou caso a caso.

## Fora deste plano (vai para o próximo, conforme combinado)

- `onError` do `useUploadFotoCotacaoVistoria` com colunas corretas + `registrarLog`
- `previewLocal` indexado por `fotoAtual.id` em `AutovistoriaCotacao.tsx`
- Investigação da causa raiz do upload (depende do log do item acima já gravando)

## Sequência executável

```text
1. Validar schema fino de `vistorias` (dispensa_rastreador, status inicial aceito)
2. Migration Passo 1 (Elisabete) — transação única, guards/triggers ativos
3. Conferir: servicos materializado com tipo=vistoria_entrada, modalidade=presencial,
   dispensa_rastreador=true, status=agendada; agendamento e vistoria criados; log gravado
4. Rodar SELECT do Passo 2 → reportar resultado e decidir lote
```
