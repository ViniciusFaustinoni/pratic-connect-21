## Diagnóstico

### Estado atual do WALTER OLIVEIRA LOPES
- Cotação `9f29b76e-bbca-4938-9a23-834d9010647f` (#COT-20260511-125136770-460), placa **SRM4J79**, Honda CG 160 Titan 2022 (moto), status `aceita`.
- `vistoria_concluida_em`, `tipo_vistoria`: **null** — não chegou a finalizar.
- `cotacoes_vistoria_fotos`: contém **1 linha órfã** — um `video_360` enviado durante o fluxo antigo. Nenhuma das 9 fotos novas foi gravada (provavelmente travou antes do upsert).

### Bugs reais encontrados na revisão

**1. 🔴 OCR de placa nunca executa (silencioso) — `src/hooks/useCotacaoVistoria.ts:144-150`**
Lê colunas que **não existem**: `cotacoes.placa` e `cotacoes.aguardando_placa_definitiva`. A coluna correta é `veiculo_placa`. O `select` falha silenciosamente, `cot` fica `null`, e todas as 6 fotos com `validaPlaca` caem em `skipped: true` → validação de placa pulada para todos os associados (moto e carro).

**2. 🔴 Card de KM e fallback manual nunca aparecem — `AutovistoriaCotacao.tsx:440, 450, 463`**
Checagens ainda usam `fotoAtual.id === 'odometro'`, mas o ID canônico mudou para `painel_ligado`. Quando o OCR do painel falha (comum em moto, painel pequeno), o input manual de KM nunca aparece e o usuário fica travado no passo, sem feedback. Isso é compatível com o sintoma reportado ("travou").

**3. 🟡 Avanço de índice usando closure stale — `AutovistoriaCotacao.tsx:231, 503`**
`setFotoAtualIndex(fotoAtualIndex + 1)` lê `fotoAtualIndex` capturado no escopo do upload. Se o usuário fotografar duas vezes rapidamente (refazer + retake) ou se o upload concorrer com clique manual nas miniaturas, pode pular passos ou voltar — possível origem dos "bugs de duplicação".

**4. ✅ Chassi OK** — id `chassi` não dispara nenhum OCR (em conformidade com a memória `chassi-sempre-manual`). O crash do WALTER no chassi foi provavelmente OOM do `compressImage` no celular dele somado ao bug nº 2 (sem feedback de erro), não OCR.

## Ações

### Parte A — Reset do WALTER

1. `DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id = '9f29b76e-bbca-4938-9a23-834d9010647f';`
   (apaga o `video_360` órfão; a cotação já está limpa nos demais campos)

Depois disso, ao atualizar a página com o link público (`token_publico = 66f12341cd...`), ele vai entrar no fluxo novo de 9 fotos do zero.

### Parte B — Correções de código

**B1.** `src/hooks/useCotacaoVistoria.ts` (linha 145)
- Trocar `select('placa, aguardando_placa_definitiva')` por `select('veiculo_placa, aguardando_placa_definitiva')` (a 2ª coluna existe em `cotacoes`? — sim na maioria dos schemas, mas confirmar; se não existir, remover do select e tratar `aguardando` como `false`).
- Trocar `(cot as any)?.placa` por `(cot as any)?.veiculo_placa`.

**B2.** `src/components/cotacao-publica/AutovistoriaCotacao.tsx`
- Linha 191: trocar `fotoAtual.id === 'odometro'` por `(fotoAtual.id === 'odometro' || fotoAtual.id === 'painel_ligado')`.
- Linhas 440, 450, 463: idem (substituir pela mesma checagem combinada).

**B3.** `src/components/cotacao-publica/AutovistoriaCotacao.tsx` — avanço seguro
- Linha 231: `setFotoAtualIndex((prev) => Math.min(prev + 1, totalFotos - 1));`
- Linha 503: idem.

**B4.** Aplicar as mesmas correções B1-B3 no equivalente do **link de associado** (`src/components/associado/Autovistoria.tsx` + `src/hooks/useContratoLink.ts`) se as mesmas heurísticas existirem lá — confirmar antes de editar.

## Fora de escopo
- Não alterar `compressImage` nem o pipeline de upload de imagem.
- Não tocar em edge functions (`placa-ocr`, `odometro-ocr`).
- Não mudar a config de fotos da moto (já correta — chassi sem OCR).
