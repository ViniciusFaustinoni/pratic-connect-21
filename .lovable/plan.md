## Diagnóstico (correção do diagnóstico anterior)

Não existe "vazamento de escopo" do `extractedPdfText`. Confirmei lendo o arquivo: a variável é declarada na linha 1200 dentro do handler principal e o bloco de tiebreaker (linhas 1851-1883) está no mesmo escopo de função — a closure enxerga normalmente.

O tiebreaker MRZ não dispara por outro motivo, mais profundo:

- Em CNH-e SENATRAN, o `unpdf` extrai apenas o texto institucional ("Assinador Serpro… Medida Provisória 2200…"), não o conteúdo da carteira. O `scoreExtractedText` (em `_shared/unpdf-extract.ts`) corretamente devolve score ~0.05 nesses casos e o roteador escolhe `raster-vlm`.
- Quando isso acontece, `extractedPdfText` contém apenas as instruções do Serpro — **o MRZ `I<BRA…` simplesmente não está lá**, porque o documento real é uma imagem embutida no PDF.
- Resultado: `mrzFromString(extractedPdfText)` devolve `''`, o tiebreaker cai pra `mrzA`/`mrzB` (que vêm da IA e podem alucinar), e em vários casos nem sequer existe `mrz_registro` no JSON porque o prompt pede o campo mas não enfatiza onde lê-lo nem como validar.

Ou seja: a "verdade absoluta" prevista (texto nativo) não existe nesse cenário. O sinal mecânico real está **na imagem**, e precisa ser arrancado dela com instrução explícita + validação matemática.

## Plano

Três ajustes coordenados em `supabase/functions/document-ocr/index.ts`:

### 1. Prompt da CNH: instruir o VLM a transcrever o MRZ literalmente

No bloco de prompt da CNH (próximo da linha 405, mesma região onde já tratamos a armadilha do "ACC"), acrescentar uma seção dedicada ao MRZ:

- Explicar que no rodapé da CNH-e existe a Zona de Leitura Mecânica (MRZ) com 3 linhas em fonte OCR-B (caracteres `<` como preenchimento).
- Pedir que `mrz_registro` receba **a primeira linha completa**, exatamente como aparece, começando com `I<BRA` e mantendo todos os `<`.
- Avisar que essa linha é a fonte de verdade do número de registro: se o que o modelo "lê" no campo `9 CAT HAB / Nº REGISTRO` divergir da MRZ, vale a MRZ.
- Reforçar que NÃO deve preencher `mrz_registro` se a MRZ não estiver visível/legível (melhor vazio que inventado).

### 2. Tiebreaker MRZ: parar de depender só do texto nativo

Substituir, no bloco de dupla-leitura (linhas 1851-1883), a lógica atual por uma versão que:

- Coleta candidatos de MRZ de **três fontes**, em ordem de confiança:
  1. Texto nativo do PDF (raro, mas quando existe é absoluto).
  2. `mrz_registro` da passada A.
  3. `mrz_registro` da passada B.
- Para cada candidato, **valida o checksum ICAO 9303** sobre os 9 dígitos do número de registro + dígito verificador da MRZ (algoritmo padrão peso 7-3-1). Helper novo `validateMrzCheckDigit(line: string): boolean` em arquivo compartilhado (`_shared/mrz.ts`).
- Só MRZs válidas entram na disputa. Empate (A e B válidos e iguais) confirma; A e B válidos e diferentes → fica sem tiebreaker MRZ e cai pro tiebreaker de CPF.
- Mantém prioridade MRZ > CPF checksum, como hoje.

### 3. Logging para confirmar que o tiebreaker passou a disparar

Acrescentar no log `[OCR][dupla-leitura][mrz]` os campos:
- `mrzNativeFound: boolean`
- `mrzAValid: boolean`, `mrzBValid: boolean`
- `mrzSource: 'native' | 'A' | 'B' | null`

Assim, em produção dá pra confirmar em poucos logs se em CNH-e o MRZ passou a vir do VLM e a vencer o desempate.

## Arquivos afetados

- `supabase/functions/_shared/mrz.ts` (novo): helpers `extractMrzLine`, `validateMrzCheckDigit`, `getRegistroFromMrz`.
- `supabase/functions/document-ocr/index.ts`:
  - Prompt CNH (~linha 405): seção MRZ.
  - Bloco tiebreaker (~linhas 1851-1883): nova lógica baseada em checksum.
  - Imports do novo helper no topo.

## Detalhes técnicos

- O checksum ICAO 9303 sobre dígitos usa pesos cíclicos `[7,3,1]`, soma mod 10. `<` e letras seguem tabela ICAO; para a faixa de registro CNH só dígitos são esperados, simplifica.
- Não mexemos em `routeOcr` nem no `scoreExtractedText`: a decisão de rasterizar CNH-e continua correta — o que muda é a forma como extraímos o sinal mecânico depois.
- Sem mudanças de schema, sem migration, sem novos secrets.

## O que não vamos fazer

- Não vamos forçar o `unpdf` a "ler mais" da CNH-e: o conteúdo real é imagem embutida; insistir nisso é trabalho desperdiçado.
- Não vamos remover o tiebreaker de CPF checksum — ele continua útil quando o MRZ não está legível em nenhuma das passadas.
