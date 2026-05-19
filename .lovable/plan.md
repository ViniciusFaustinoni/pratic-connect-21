# Correção raiz — moto Honda CG 150 Titan classificada como carro

## Diagnóstico

Caso Marllon (cotação `b50180dc-e4f0-420f-8f08-a07175ef0212`, Honda CG 150 Titan EX, FIPE R$ 12.474) está com `tipo_vistoria='autovistoria'` (completa, 31 fotos) porque foi tratado como **carro abaixo de R$ 30k**, em vez de **moto acima de R$ 9k**.

A correção anterior (`MOTO_BRANDS`, `MOTO_KEYWORDS`, `detectarTipoVeiculo`) está correta no frontend e nos fallbacks — mas o **edge function** `finalizar-autovistoria-cotacao` honra como fonte canônica o campo `marcas_modelos.tipo_veiculo`, e **o catálogo está corrompido**:

```text
HONDA tipo_veiculo='carro' total=309
  → 131 entradas são motos (cg, cb, cbr, pcx, biz, titan, xre, hornet, lead, elite, adv …)
BMW  tipo_veiculo='carro' contém 83 motos (s 1000, f 750/850/900, r 1200/1250/1300, g 310, c 400 …)
KAWASAKI / SUZUKI ok
```

A entrada `HONDA / CG 150 TITAN-EX MIX/FLEX` está com `tipo_veiculo='carro'`. O edge confia no catálogo, não cai no fallback de keywords, e classifica como carro <30k → autovistoria completa.

## O que muda

Carros permanecem **intocados**. Mudanças apenas em:
1. Dados do catálogo `marcas_modelos` (Honda + BMW)
2. Defesa adicional no edge `finalizar-autovistoria-cotacao` (mesmo lendo `'carro'` do catálogo, sobrescreve para moto quando marca ambígua + keyword forte casa)
3. Reclassificação cirúrgica da cotação do Marllon

## Plano

### 1. Saneamento de `marcas_modelos` (migration)

`UPDATE marcas_modelos SET tipo_veiculo='moto'` para entradas onde `tipo_veiculo='carro'` E:

- `marca='HONDA'` E `modelo ~* '\m(cg|cb|cbr|pcx|biz|pop|titan|fan|nxr|bros|xre|lander|tenere|crosser|crf|sahara|twister|hornet|elite|adv|sh|lead|xadv|x-adv|transalp|cargo|nx|nighthawk|shadow|magna|africa twin)\M'`
- `marca='BMW'` E `modelo ~* '\m(s 1000|f 650|f 700|f 750|f 800|f 850|f 900|r 1100|r 1150|r 1200|r 1250|r 1300|g 310|g 450|g 650|k 1200|k 1300|k 1600|c 400|c 600|c 650|c evolution|hp2|hp4|nine t)\M'`

Idempotente. Auditoria: `INSERT INTO logs_auditoria` registrando IDs alterados antes do UPDATE.

### 2. Defesa no edge `finalizar-autovistoria-cotacao`

Atualmente:
```text
if (mm?.tipo_veiculo === 'moto')  isMoto = true
else if (mm?.tipo_veiculo === 'carro') isMoto = false      ← engole o erro
else { ... fallback keywords ... }
```

Passa a:
```text
if (mm?.tipo_veiculo === 'moto') isMoto = true
else {
  // Fallback de keywords roda SEMPRE que catálogo não disser 'moto'
  // (ambíguo ou diz 'carro'). Se keyword bater, override para moto.
  const matchedByKeyword = (MOTO_BRANDS.includes(marca) || MOTO_REGEX.test(modelo))
  isMoto = matchedByKeyword
  if (mm?.tipo_veiculo === 'carro' && matchedByKeyword) {
    console.warn('[finalizar-autovistoria] catalogo-divergente', { marca, modelo, catalogo: 'carro', resolvido: 'moto' })
  }
}
```

Isso protege o fluxo mesmo se aparecerem novas linhas ruins no catálogo no futuro.

### 3. Reclassificação da cotação do Marllon

Honda CG 150 Titan, FIPE R$ 12.474 → moto acima de R$ 9k → caminho canônico:
- `tipo_vistoria = NULL` (autovistoria deixa de ser exigida; vira opcional enxuta)
- `tipo_instalacao` mantém (instalação obrigatória pelo técnico)
- Limpar `vistoria_completa_*` se preenchidos
- Manter `status_contratacao='pagamento_ok'` e `cliente_*` intactos
- Se houver fotos parciais já materializadas em `cotacoes_vistoria_fotos`/`vistorias`, manter como histórico (não apagar) — Cadastro/Monitoramento decide.

UPDATE direcionado apenas por `id='b50180dc-e4f0-420f-8f08-a07175ef0212'`.

### 4. Varredura preventiva (read-only, sem ação automática)

`SELECT` listando cotações ativas (`status_contratacao` não-terminal) com `marca` Honda/BMW + modelo que case keyword de moto + `valor_fipe BETWEEN 9000 AND 30000` + `tipo_vistoria='autovistoria'`. Relatório no chat; reclassificação manual caso a caso (mesma natureza do UPDATE do passo 3) — sem script em massa para evitar interferir em casos já em andamento.

### 5. Memória

Adicionar `mem://logic/operations/catalogo-marcas-modelos-divergente` documentando: catálogo é fonte canônica mas pode divergir → edge function aplica override por keyword quando marca é ambígua.

## Fora de escopo

- Fluxo de carros (qualquer faixa FIPE) — intocado
- `detectarTipoVeiculo` / `MOTO_BRANDS` / `MOTO_KEYWORDS` — já corretos
- Reimportação FIPE completa
- Backfill de `cotacoes.veiculo_categoria` (continua pendente como antes)

## Detalhe técnico

- Passo 1: migration SQL (mudança de dados via WHERE seguro com regex de keywords; idempotente).
- Passo 2: edit pontual em `supabase/functions/finalizar-autovistoria-cotacao/index.ts`.
- Passo 3: `UPDATE cotacoes SET tipo_vistoria=NULL, vistoria_completa_*=NULL WHERE id='b50180dc-…'`.
- Passo 4: query exploratória no chat (sem efeito colateral).

Aprova para executar 1→4?
