## Diagnóstico — onde DIOGO travou

Cotação `COT-20260602-090235466-549` — Ford Fiesta KPH1G98, FIPE R$ 29.782 → **sub-FIPE** (dispensa rastreador, autovistoria completa obrigatória).

Estado atual:
- `contratos.cadastro_aprovado=true`, `aprovado_em=2026-06-03 18:26`, `documentos_aprovados_em=16:24`
- `contratos.status='assinado'` / `veiculos.status='instalacao_pendente'` / `associados.status='aguardando_aprovacao_monitoramento'`
- `vistorias` existe (`pendente`, modalidade `autovistoria`, vídeo OK)
- **`servicos` existe** (`73dff5c7`, `tipo=vistoria_entrada`, `modalidade=autovistoria`, `status=em_analise`, vinculado à vistoria)
- Sem `instalacoes` (correto p/ sub-FIPE)

**Por que sumiu da fila do Monitoramento?**
A regra canônica sub-FIPE (memória `vistoria-sem-rastreador-flow`) diz: ao aprovar o Cadastro, o serviço `em_analise` deve ser **promovido para `concluida`** e a R/F liberada. Isso é o que a fila "Aprovação de Associados" usa para listar o caso. No DIOGO o `aprovar-proposta` rodou (cadastro_aprovado=true) mas **o serviço continuou em `em_analise`** — então:

- Fila do Cadastro não mostra mais (cadastro_aprovado=true)
- Fila do Monitoramento não mostra (serviço ainda `em_analise`, não `concluida`)
- Resultado: **limbo silencioso**

Causa-raiz provável: o backfill manual do `vistorias.video_360_url` que aplicamos mais cedo destravou o guard `caminho_publico_incompleto` no `aprovar-proposta`, mas a edge tem um caminho de promoção do serviço (`em_analise` → `concluida`) que só roda quando ela mesma materializa a vistoria — para vistoria pré-existente o passo é pulado. Já existia esse buraco antes; só ficou visível agora.

## Plano

### 1. Saneamento DIOGO (imediato)
Migration única:
- `UPDATE servicos SET status='concluida', concluido_em=now() WHERE id='73dff5c7-72f0-4456-93cc-2e322de560a8'`
- `UPDATE vistorias SET status='aprovada' WHERE id='4ecc4e63-...'` (parear com o serviço)
- `UPDATE veiculos SET cobertura_roubo_furto=true WHERE id='0c63d99f-...'` (sub-FIPE: Cadastro libera R/F)
- Log em `logs_auditoria` com motivo "saneamento limbo COT-…-549"

Após isso ele aparece na **Aprovação de Associados** do Monitoramento normalmente.

### 2. Hardening do `aprovar-proposta` (sub-FIPE)
No fim do fluxo de aprovação, quando o caso é sub-FIPE (dispensa rastreador), garantir promoção idempotente:

```ts
// pseudo
UPDATE servicos
   SET status='concluida', concluido_em=now()
 WHERE contrato_id = :contrato
   AND tipo IN ('vistoria_entrada','instalacao')
   AND modalidade = 'autovistoria'
   AND status = 'em_analise';
UPDATE veiculos SET cobertura_roubo_furto=true WHERE id=:veiculo;
```

Roda sempre, não só quando materializa a vistoria — fecha o buraco que travou o DIOGO.

### 3. Varredura histórica
Listar (não corrigir em massa) outros casos com mesmo padrão para revisão manual:

```sql
contratos.cadastro_aprovado=true
AND associados.status='aguardando_aprovacao_monitoramento'
AND EXISTS servico em_analise modalidade=autovistoria do contrato
```

Resultado vira lista para o operador decidir caso a caso (sem update cego — pode haver casos legítimos pendentes).

### 4. Memória
Atualizar `mem://logic/operations/vistoria-sem-rastreador-flow` registrando que a promoção `em_analise → concluida` agora é incondicional no `aprovar-proposta` para sub-FIPE, não só quando a edge materializa a vistoria.

## Detalhes técnicos

- Arquivos: `supabase/functions/aprovar-proposta/index.ts` (passo 2) + nova migration (passo 1) + script SELECT no chat para passo 3
- Sem mudança de UI
- Sem alterar `fn_materializar_autovistoria_cotacao` (já está OK; o problema é no consumidor)
- Idempotente em todas as etapas
