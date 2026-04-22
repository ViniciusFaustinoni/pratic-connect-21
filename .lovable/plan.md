

## Reforçar extração do NÚMERO DO MOTOR no OCR

### Diagnóstico

O campo `numero_motor` **já existe** em todo o pipeline:
- `document-ocr/index.ts` cita `numero_motor` na seção CRLV (linha 256-257) e NF-e (linha 296-297)
- A normalização (uppercase/trim) já existe (linha 968-987)
- O frontend (`EtapaDadosPessoaisDocumentos.tsx`) consome o campo em CRLV e NF-e e exibe na revisão
- `ContratoWizard.tsx` também lê `dados.numero_motor`

Então **a infraestrutura está pronta** — o problema é que o modelo de visão **não está retornando o campo de forma consistente**. Razões prováveis:

1. **Instrução muito enxuta no prompt CRLV** — é apenas 1 linha no meio de uma lista de campos; o modelo trata como opcional.
2. **ATPV-e não extrai `numero_motor`** — a seção lista os campos mas omite o motor (linha 308-318), e o frontend ATPV-e (linha 287+) também não consome.
3. **Fallback de regex truncamento** (`tryRepairTruncatedJSON`, linha 410) não inclui `numero_motor` no array `dadosFields` — quando a resposta vem truncada, o motor é perdido.
4. **Nenhuma observação ao usuário** quando o motor falha — ele só descobre depois, no cadastro.

### O que vai mudar

**1. `supabase/functions/document-ocr/index.ts` — reforçar prompt CRLV**

Substituir a linha enxuta atual por um bloco dedicado, no mesmo padrão usado para CPF (que funciona bem):

- Destacar `numero_motor` como **CAMPO OBRIGATÓRIO** do CRLV (não opcional).
- Listar todas as variações de rótulo: `MOTOR Nº`, `Nº DO MOTOR`, `MOTOR N°`, `MOTOR:`, `MOTOR/SÉRIE`, `Nº MOTOR`, e em CRLV-e/Digital o campo aparece logo abaixo de "CHASSI".
- Instruir: ler caractere por caractere; o número do motor tem geralmente 7-17 caracteres alfanuméricos (letras maiúsculas + dígitos, podendo conter hífen).
- Se ilegível, retornar `numero_motor:"ilegivel"` (não `null`) — mesmo padrão do CPF, para diferenciar "não encontrei" de "não consegui ler".
- Sempre preencher `motor` e `numero_motor` com o mesmo valor.

**2. Adicionar `numero_motor` à seção ATPV-e**

O ATPV-e brasileiro contém o número do motor no bloco "Características do Veículo". Adicionar:
- Campo `numero_motor` na lista da seção ATPV-e (linha 310-311).
- No frontend `EtapaDadosPessoaisDocumentos.tsx` linha 288+: adicionar `if (dados.numero_motor) novosDados.numero_motor = dados.numero_motor;` no bloco ATPV-e.

**3. Reparo de JSON truncado**

Adicionar `'numero_motor'` ao array `dadosFields` na linha 410 de `tryRepairTruncatedJSON`, para recuperar o campo mesmo se a resposta da IA for cortada por `max_tokens`.

**4. Validação leve no servidor**

Após normalizar (linha 970-987), se `tipo === 'crlv'` e `numero_motor` estiver vazio/null, marcar `result.sugestao = 'revisar'` e adicionar uma observação no `motivo`: "Número do motor não foi extraído — preencha manualmente". Isso garante que o documento entra em revisão manual em vez de aprovar silenciosamente sem o motor.

**5. Re-tentativa direcionada (opcional, baixo custo)**

Se o tipo for CRLV/NF/ATPV-e e `numero_motor` vier vazio na primeira tentativa com `gemini-2.5-flash`, fazer **uma única** retentativa com `gemini-2.5-pro` apenas para extrair esse campo (prompt focado: "Extraia apenas o NÚMERO DO MOTOR deste documento"). Já existe a constante `OCR_RETRY_MODEL` para isso.

### O que NÃO vai mudar

- A flag de aprovação geral do documento continua igual; apenas o motor influencia a sugestão (revisar em vez de aprovar quando ausente).
- Documentos sem motor visível (ex.: comprovante de residência) seguem inalterados.
- Estrutura JSON de resposta permanece compatível (campo já existe).

### Arquivos editados

- `supabase/functions/document-ocr/index.ts` — reforço de prompt CRLV/ATPV-e, fallback de truncamento, validação pós-parse e retentativa direcionada.
- `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` — extrair `numero_motor` também no bloco ATPV-e.

### Riscos

- A retentativa com `gemini-2.5-pro` adiciona ~2-4s de latência quando disparada (apenas se o flash falhar). Mitigação: limite a 1 retry e somente para o motor.
- Falsos positivos de "ilegivel": o modelo pode preferir essa resposta a tentar ler. Mitigação: o usuário ainda pode digitar manualmente no campo dedicado do cadastro.

