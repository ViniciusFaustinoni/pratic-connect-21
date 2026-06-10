---
name: Sub-FIPE isenta — link público desvia Pagamento → Vistoria
description: CotacaoContratacao detecta sub-FIPE isenta sem via e força etapa Vistoria antes que confirmar-adesao-zerada bata 409
type: feature
---

# Sub-FIPE isenta no link público: ordem Vistoria-antes-de-Pagamento

## Contexto

O stepper padrão do link público (`src/pages/public/CotacaoContratacao.tsx`) segue
`Plano → Documentos → Contrato → Pagamento (3) → Vistoria (4)`. Para a maioria
dos cenários funciona — a etapa Pagamento confirma a adesão (paga ou isenta) e
depois o cliente escolhe a vistoria.

**Sub-FIPE isenta quebra essa ordem**: o edge `confirmar-adesao-zerada` exige
`cotacoes.dados_extras.via_vistoria_sub_fipe` (`completa_celular` / `rf_celular`
/ `sem_fotos`) ANTES de aceitar a confirmação isenta. A via só é gravada na
etapa Vistoria (`EtapaVistoria.tsx`). Resultado pré-fix: cliente clicava em
"Confirmar adesão isenta" → 409 `via_sub_fipe_nao_escolhida` → "Erro ao
processar / Tentar Novamente" em loop.

Caso testemunha: COT-20260609-140053334-121 — Everaldo Barbosa Cardoso,
Voyage 2010 FIPE R$ 29.019, `cenario_adesao='isenta_rota'`.

## Fix canônico (10/06/2026)

Em `CotacaoContratacao.tsx`:

1. **Detecção** `subFipeIsenta`: combinação de
   - `cenario_adesao` começando com `'isenta'` OU `valor_adesao=0`
   - `exigeRastreador()` retornando `exige=false` (FIPE < mínimo do tipo)
   - exclui troca de titularidade e substituição

2. **Detecção** `viaSubFipeSelecionada`: `dados_extras.via_vistoria_sub_fipe` em
   `('completa_celular' | 'rf_celular' | 'sem_fotos')`.

3. **Sync effect**: quando `etapaDoStatus = 3` (Pagamento) e a cotação está
   em sub-FIPE isenta sem via escolhida E sem agendamento presencial
   materializado, força `etapa = 4` (Vistoria).

4. **Useeffect dedicado**: se o cliente cair na etapa 3 por qualquer motivo
   (navegação manual, status legado) sob a mesma condição, `setEtapaAtual(4)`.

5. **Defesa**: se já houver `instalacoes`/`agendamentos_base` materializados
   (Via 3 sem_fotos com chooser presencial já concluído), NÃO desviar — a via
   está caracterizada mesmo sem flag em `dados_extras`.

## O que NÃO foi alterado

- Ordem padrão do stepper para fluxos **com pagamento** ou **acima da FIPE**:
  continua `Pagamento → Vistoria` (não regrediu para ninguém).
- Edge `confirmar-adesao-zerada`: gates intactos como última linha de defesa
  para clientes antigos / chamadas diretas.
- `aprovar-proposta` / outros gates sub-FIPE permanecem como `mem://logic/operations/sub-fipe-gates-canonicos` documenta.

## Histórico

- 10/06/2026: fix inicial após caso Everaldo (sub-FIPE isenta loop "Erro ao
  processar"). Memo + sync effect adicionados em `CotacaoContratacao.tsx`.
