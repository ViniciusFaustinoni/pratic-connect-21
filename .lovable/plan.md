# LTV3631 — Fotos não chegaram ao SGA: diagnóstico e correção definitiva

## Diagnóstico (LTV3631 / contrato `f0eb8495…`)

A vistoria presencial gravou **31 fotos**. No SGA Hinova foram aceitas apenas as 12 fotos canônicas (chassi, motor, frente, traseira, lateral esquerda, lateral direita, painel/odômetro). As outras **~19 fotos** (bateria, chave, capô aberto, banco motorista/passageiro/traseiro, forração das portas, pneus, parabrisa, mala aberta, estepe, frente/traseira lateral, vistoriador selfie, chave roda macaco) foram silenciosamente descartadas pela edge `sga-hinova-sync` e depois carimbadas como “já enviadas” por uma migration de backfill — o que **bloqueou todo e qualquer reenvio futuro**.

Duas causas reais:

1. **`buildFotosPayload` (`supabase/functions/_shared/hinova-payloads.ts`)** descarta qualquer foto cujo `tipo` não esteja em `hinova_mapeamentos`. A memória `sga-fotos-codigo-15-adicional` define que tipos sem equivalente oficial Hinova devem ir para **código 15 (FOTO ADICIONAL)**, mas o código atual joga fora.
2. **Migration `20260516133056`** inseriu em `sga_fotos_enviadas` todas as fotos pré-existentes com `codigo_tipo=0, hinova_response={"backfill":true}` — incluindo as que nunca tinham sido enviadas (como as ~19 do LTV3631). A partir daí o dedupe da edge as trata como “já enviadas” e nunca mais tenta.

Para LTV3631 existem hoje **33 linhas** em `sga_fotos_enviadas` com `codigo_tipo=0, hinova_response.backfill=true`, exatamente o conjunto que precisamos reabrir.

## Correção da raiz

### 1) Edge function — fallback automático para código 15
`supabase/functions/_shared/hinova-payloads.ts` → função `buildFotosPayload`:

- Quando `resolverCodigoTipo(tipoNorm)` retornar `null`, **não descartar**. Usar `codigoTipo = 15` (FOTO ADICIONAL) e registrar o tipo original em um novo array `tiposFallback15` apenas para diagnóstico.
- Manter `descartadasSemTipo` somente para casos em que o `tipo` é vazio/nulo (sem nada para classificar).
- `descartadasVideo` e `descartadasSemLink` continuam como hoje.

`supabase/functions/sga-hinova-sync/index.ts`:

- Passar a logar `tipos_fallback_15` em `enviar_fotos_descarte` (renomeado para `enviar_fotos_resumo`) para auditoria.

Efeito: qualquer foto nova com `tipo` não previsto entra automaticamente como FOTO ADICIONAL no SGA, em vez de sumir.

### 2) Cobertura completa do conjunto canônico de vistoria (carros 31 + motos 15)
Migration nova `hinova_mapeamentos` — `INSERT … ON CONFLICT DO NOTHING` para todos os tipos da vistoria presencial completa que hoje não têm linha, todos com `codigo_hinova=15`:

```
bateria, capo_aberto_placa, chave, chave_roda_macaco, estepe,
banco_motorista, banco_passageiro, banco_traseiro,
forracao_porta_dianteira_direita, forracao_porta_dianteira_esquerda,
forracao_porta_traseira_direita, forracao_porta_traseira_esquerda,
frente_lateral_direita, frente_lateral_esquerda,
traseira_lateral_direita, traseira_lateral_esquerda,
mala_aberta, parabrisa,
pneu_dianteiro_direito, pneu_dianteiro_esquerdo,
pneu_traseiro_direito, pneu_traseiro_esquerdo,
odometro_painel, vistoriador_selfie
```

Mesmo com o fallback (1), o mapeamento explícito mantém o histórico limpo e facilita relatório por tipo.

### 3) Reabrir os “fantasmas” da migration de 16/05
Migration nova (`UPDATE/DELETE` em `sga_fotos_enviadas`):

```sql
DELETE FROM public.sga_fotos_enviadas
WHERE codigo_tipo = 0
  AND hinova_response ? 'backfill'
  AND (hinova_response->>'backfill')::boolean = true;
```

Isso destrava o reenvio de todos os veículos afetados — não só LTV3631.

### 4) Reenvio para LTV3631 (e ressync em massa)
Chamar `sga-hinova-sync` com `{ veiculo_id: '8f7a7ce8-d214-46df-8b28-87f2b886cdb3', force_resync_media: true }` (esse veículo específico) e disparar a fila normal — os outros veículos serão re-processados na próxima rodada da fila SGA já com o fallback ativo.

## Garantias para o futuro

- Edge: nenhuma foto com `tipo` preenchido será mais descartada — pior caso vira código 15.
- Catálogo: tipos da vistoria presencial passam a ter mapeamento explícito.
- Banco: removido o carimbo de “já enviado” para tudo que veio do backfill cego.
- Memória `mem://logic/integrations/sga-fotos-codigo-15-adicional` será atualizada para registrar que o fallback de tipo desconhecido → 15 é agora aplicado no código, não só por mapeamento.

## Arquivos / migrations

- `supabase/functions/_shared/hinova-payloads.ts` (fallback 15 + retorno `tiposFallback15`)
- `supabase/functions/sga-hinova-sync/index.ts` (log do fallback)
- Migration: `INSERT` dos ~24 tipos faltantes em `hinova_mapeamentos`
- Migration: `DELETE` das linhas `backfill=true, codigo_tipo=0` em `sga_fotos_enviadas`
- Atualização de `mem://logic/integrations/sga-fotos-codigo-15-adicional`

## Fora de escopo (intencional)

- Não mexer no fluxo de vídeo 360° (continua filtrado — Hinova não aceita).
- Não alterar dedupe normal por `(origem, origem_id)` — ele continua válido para fotos realmente enviadas.
