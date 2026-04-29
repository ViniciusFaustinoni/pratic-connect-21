## Diagnóstico (com base em logs reais + retorno do GET /listar/situacao/todos)

### Códigos oficiais do Hinova (acabamos de confirmar)
- `1` = ATIVO
- `3` = **PENDENTE** ← era o que faltava
- `11` = EXCLUIDO, `12` = CANCELAMENTO, etc.

### Problema 1 — Veículo entra no SGA como ATIVO em vez de PENDENTE

O payload real gravado em `sga_sync_logs.request_payload` para `POST /veiculo/cadastrar` (placa RJQ6I98, codigo_veiculo Hinova 35888) **não contém o campo `codigo_situacao`**:

```json
{ "codigo_associado":30160, "placa":"RJQ6I98", ..., "codigo_voluntario":100 }
```

Causa raiz (`sga-hinova-sync/index.ts` linha 643 + `_shared/hinova-payloads.ts` linha 185):
- `const codSituacao = statusDestino === 'ativo' ? codigoSituacaoAtivo : codigoSituacaoPendente;`
- `if (ctx.codigo_situacao) payload.codigo_situacao = ctx.codigo_situacao;`

`codigoSituacaoPendente` vem da env `HINOVA_CODIGO_SITUACAO_PENDENTE` ou de `integracoes_credenciais.cred.codigo_situacao_pendente`. **Nenhum dos dois está configurado** → fica `NaN` → campo é omitido → Hinova aplica seu default (ATIVO).

Os chamadores (`useSGASync`, `BotaoAtivarSGA`, `aprovar-proposta`, `cron-sga-retry`, etc.) já enviam `status_sga_destino: 'pendente'` corretamente — o problema é só a omissão do código numérico no payload final.

### Problema 2 — Fotos da vistoria/instalação não vão para o SGA

A função busca fotos apenas em `documentos`, `contratos_documentos` e `associados.avatar_url` (linhas 748-781). Logs `enviar_fotos` mostram apenas 3-4 fotos por veículo (CNH, comprovante, avatar).

As ~30 fotos da vistoria do veículo (chassi, motor, frente, traseira, lateral, painel/odômetro, etc.) ficam em `vistoria_fotos` (vinculada via `vistorias.veiculo_id`) e **nunca são lidas**. Os mapeamentos `hinova_mapeamentos` tipo `tipo_foto` já cobrem `chassi`, `frente`, `traseira`, `lateral_direita/esquerda`, `motor`, `painel`, `odometro`.

---

## Correções (cirúrgicas, sem afetar o que já funciona)

### Correção 1 — Fallback hardcoded com códigos confirmados do Hinova

Em `supabase/functions/sga-hinova-sync/index.ts`, logo após o bloco que carrega credenciais (~linha 215):

```ts
if (!Number.isFinite(codigoSituacaoPendente) || codigoSituacaoPendente <= 0) {
  console.warn('[sga-hinova-sync] HINOVA_CODIGO_SITUACAO_PENDENTE não configurado — usando default 3 (PENDENTE).');
  codigoSituacaoPendente = 3;
}
if (!Number.isFinite(codigoSituacaoAtivo) || codigoSituacaoAtivo <= 0) {
  console.warn('[sga-hinova-sync] HINOVA_CODIGO_SITUACAO_ATIVO não configurado — usando default 1 (ATIVO).');
  codigoSituacaoAtivo = 1;
}
```

ENV/credencial continuam tendo prioridade — só caem nos defaults `3`/`1` quando ausentes.

A lógica de promoção `pendente → ativo` (linhas 697-735) NÃO muda — ela já usa `codigoSituacaoAtivo`, que agora cai no `1` quando não configurado.

### Correção 2 — Incluir fotos da vistoria no envio ao SGA

Em `sga-hinova-sync/index.ts`, dentro da seção "7. FOTOS" (~linha 745), adicionar uma nova fonte de fotos:

```text
Buscar vistorias.id WHERE veiculo_id = _vid AND status IN ('concluida','aprovada','aprovado')
  └─ vistoria_fotos (tipo, arquivo_url) por vistoria_id
       └─ Acrescentar à lista documentosEntrada antes de buildFotosPayload()
```

Detalhes:
- Apenas vistorias **concluídas/aprovadas** entram (não rascunho).
- O `aliasTipo()` interno de `buildFotosPayload` (em `_shared/hinova-payloads.ts`) será estendido para mapear nomes "puros" da vistoria → mapeamentos existentes:
  - `chassi` → `foto_chassi`
  - `motor` → `foto_motor`
  - `frente` → `foto_frente`
  - `traseira` → `foto_traseira`
  - `lateral_direita` / `lateral_esquerda` → `foto_lateral_direita/esquerda`
  - `odometro` / `painel_completo` / `painel_km` → `foto_painel` / `foto_hodometro`
- Tipos sem mapeamento (`bateria`, `mala_aberta`, `forracao_*`, `pneu_*`, `vistoriador_selfie`, `chave`, `estepe`, etc.) caem em `descartadasSemTipo` (já é logado, comportamento existente — não quebra).
- Limite de 50 por lote já existe (`chunk(fotos, 50)`).
- Selfie do vistoriador pode opcionalmente entrar como "foto_associado" (codigo 1=CNH) — preciso confirmar se você quer.

### Correção 3 — Atualizar memória do SGA

Atualizar `mem://features/integrations/sga-hinova-sync-and-pre-check-v3` documentando:
- Códigos oficiais Hinova (1=ATIVO, 3=PENDENTE, 11=EXCLUIDO, 12=CANCELAMENTO).
- Defaults hardcoded (3/1) usados quando credencial/ENV ausentes.
- Fontes de fotos enviadas: `documentos` + `contratos_documentos` + `avatar_url` + **`vistoria_fotos`** (vistorias concluídas/aprovadas).

### Correção 4 (opcional, recomendada) — Tabela de mapeamento exposta

Manter `hinova_mapeamentos` como fonte de verdade dos tipos de foto, sem mudanças. Apenas o aliasTipo é estendido no código.

---

## O que NÃO será alterado (preserva o que já funciona)

- Fluxo de cadastro de associado, busca por placa/chassi, retry/queue/logs — sem mudança.
- Caminho de promoção pendente → ativo (linhas 697-735) — sem mudança lógica.
- Chamadores (`useSGASync`, `BotaoAtivarSGA`, `aprovar-proposta`, `cron-sga-retry`, `concluir-instalacao-prestador`, `useAtivacoes`, `useAprovacaoMonitoramento`) — NÃO precisam de mudança.
- `buildVeiculoPayload` mantém assinatura; apenas `ctx.codigo_situacao` agora estará sempre populado.
- Documentos sem mapeamento continuam sendo descartados silenciosamente (comportamento atual).
- `sga-listar-situacoes` (criada para diagnóstico) fica disponível como utilitário read-only — não interfere em fluxos.

## Arquivos a editar

1. `supabase/functions/sga-hinova-sync/index.ts` — fallback de códigos + leitura de `vistoria_fotos`.
2. `supabase/functions/_shared/hinova-payloads.ts` — estender `aliasTipo` em `buildFotosPayload` para tipos extras da vistoria.
3. `mem://features/integrations/sga-hinova-sync-and-pre-check-v3.md` — atualizar documentação.

## Validação pós-deploy

- Próximo `cadastrar_veiculo` → `request_payload` deve conter `codigo_situacao: 3`.
- `enviar_fotos` → `qtd` por veículo deve subir de 3-4 para 15-25+ (com vistoria completa).
- Veículo aparece no SGA Hinova como **PENDENTE** (cor branca, descricao_situacao="PENDENTE") até aprovação no monitoramento; nesse momento promove para ATIVO.
- Logs novos: `enviar_fotos_descarte` listará tipos da vistoria sem mapeamento (esperado: `bateria`, `forracao_*`, `pneu_*`, `chave`, `estepe`, `mala_aberta`, `banco_*`, `parabrisa`, `vistoriador_selfie` etc.).
