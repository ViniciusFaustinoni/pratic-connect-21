

## Reconhecer Nota Fiscal no link público + Extrair número do motor

### Causa raiz

**1) Nota Fiscal não reconhecida**
O prompt do `document-ocr` tem um bloco curto para `nota_fiscal_veiculo` que não dá ao modelo as pistas visuais clássicas de uma DANFE (cabeçalho "DANFE / NF-e", "CHAVE DE ACESSO", "CFOP", "DESCRIÇÃO DOS PRODUTOS / SERVIÇOS", "DADOS ADICIONAIS"). Resultado: quando o associado envia uma DANFE de moto/carro 0 km no slot do CRLV (no fluxo público da cotação), o modelo costuma classificar como `outro` ou tenta forçar como `crlv`, e o frontend rejeita o documento (slot não preenchido).

Além disso, o prompt não orienta a IA a **reconhecer o número do motor dentro do bloco "DESCRIÇÃO DOS PRODUTOS"** — em DANFEs de veículos, o `Nº MOTOR` aparece concatenado na descrição do produto (ex.: `CHASSI:9C6KG991070073366, No MOTOR:G3W6E-104052, RENAVAM:001187...`), algo que o modelo não extrai bem sem instrução específica.

**2) Número do motor não puxado**
- No CRLV: o prompt pede o campo `motor`, mas não menciona `numero_motor` nem indica que o CRLV traz esse dado no campo "Nº DO MOTOR" (ou "MOTOR Nº"). O front (`EtapaDadosPessoaisDocumentos.tsx` linha 243) só lê `dados.motor`.
- Na NF: o prompt define `numero_motor`, mas sem indicar onde encontrá-lo (descrição do produto, padrão `MOTOR:XXXXXX` ou `Nº MOTOR XXXXXX`).
- O upload via link público em `DocumentosPendentesPublico.tsx` (admin solicitando documentos avulsos) **não roda OCR** — apenas armazena. Isso impede qualquer extração ou validação na hora do envio.

### Plano de correção

**1. Reforçar detecção de NF no `supabase/functions/document-ocr/index.ts`**
   - Reescrever o bloco `### Nota Fiscal de Veículo` do `systemPrompt` listando os marcadores típicos da DANFE (cabeçalho "DANFE", "DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA", "CHAVE DE ACESSO" de 44 dígitos, código de barras, "PROTOCOLO DE AUTORIZAÇÃO DE USO", "NATUREZA DA OPERAÇÃO: VENDA DE VEÍCULO 0 KM", colunas "NCM/SH", "CFOP", "V. UNITÁRIO", "V. TOTAL").
   - Detalhar onde encontrar os dados veiculares: bloco "DESCRIÇÃO DOS PRODUTOS / SERVIÇOS", padrões `CHASSI:`, `CHASSI Nº`, `MOTOR:`, `Nº MOTOR`, `RENAVAM:`, `COR:`, `COMBUSTÍVEL:`, `ANO FAB:`, `ANO MOD:`, `MARCA:`, `CATEGORIA:`, `TIPO VEICULO:`, `CILINDRADAS:`, `POTENCIA:`.
   - Instruir explicitamente: extrair `numero_motor` dessa string mesmo quando estiver concatenada com outros campos (regex mental: `MOTOR\s*:?\s*([A-Z0-9-]+)`).
   - Definir `valor_nota_fiscal` como o `VALOR TOTAL DA NOTA` (ou "V. TOTAL" do produto principal quando único).
   - Adicionar `nome_comprador` = "DESTINATÁRIO/REMETENTE → NOME / RAZÃO SOCIAL" e `cpf_cnpj_comprador` = campo "CNPJ / CPF" do destinatário.
   - Adicionar regra: se o documento é uma DANFE/NF-e que contenha qualquer item identificável como veículo (CHASSI 17 chars OU CFOP 5405/5104/6405/etc OU descrição com palavras "VEÍCULO", "MOTOCICLETA", "AUTOMÓVEL", "0 KM", "ZERO KM"), `tipo_detectado` = `"nota_fiscal_veiculo"` — nunca `crlv` nem `outro`.

**2. Adicionar `numero_motor` ao bloco do CRLV**
   - No prompt do CRLV, listar `numero_motor` como campo (alias do `motor`) e indicar que vem do campo "MOTOR Nº" / "Nº DO MOTOR" / "MOTOR" do CRLV.
   - Em `EtapaDadosPessoaisDocumentos.tsx`, no bloco `tipoDocumento === 'crlv'`, popular também `novosDados.numero_motor` a partir de `dados.numero_motor || dados.motor`.

**3. Validação leve do número do motor (servidor)**
   - No `document-ocr`, após o parse, normalizar `numero_motor` (uppercase, remover espaços) e descartar valores claramente inválidos (< 5 caracteres ou só zeros). Não bloqueia o documento, só limpa.

**4. OCR no envio de documentos avulsos pelo link público (`DocumentosPendentesPublico.tsx`)**
   - Após o upload bem-sucedido para o bucket `cotacoes-docs`, **antes** de marcar o `documentos_solicitados` como enviado, invocar `supabase.functions.invoke('document-ocr', { body: { url: publicUrl, tipoEsperado: doc.tipo_documento } })` em background (não bloqueia o usuário).
   - Persistir `tipo_detectado`, `dados_ocr` e `sugestao` em colunas existentes do registro `documentos` (campos `dados_extraidos jsonb`, `tipo_detectado text`, `confianca_ocr numeric`, `sugestao_ocr text`) — usar as colunas que já existem na tabela; se não existirem, persistir em `metadata jsonb`. Verificar schema antes (próximo passo, na execução).
   - Se o admin pediu `crlv` e o OCR detectou `nota_fiscal_veiculo`, **aceitar como equivalente** (não rejeitar) — o slot do CRLV passa a aceitar NF e ATPV-e nesse fluxo público também, igual ao fluxo da cotação pública.
   - Mostrar no card do documento (após upload) um badge: "Reconhecido como Nota Fiscal" / "Reconhecido como CRLV" + ícone de sucesso ou de revisão necessária.

**5. Memória**
   - Atualizar `mem://infrastructure/documents/ocr-resilience-and-cnh-parsing-v4` para incluir as novas regras de detecção de DANFE e extração do `numero_motor` em CRLV/NF.

### Arquivos afetados

- `supabase/functions/document-ocr/index.ts` — prompt da NF reforçado, `numero_motor` no CRLV, normalização do motor.
- `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` — popular `numero_motor` quando vier do CRLV.
- `src/components/cotacao-publica/DocumentosPendentesPublico.tsx` — invocar OCR após upload, aceitar NF/ATPV-e no slot de CRLV, exibir tipo reconhecido.
- (opcional) `src/integrations/supabase/types.ts` — refletir novas colunas se for necessário criar via migration.
- `mem://infrastructure/documents/ocr-resilience-and-cnh-parsing-v4` — regras atualizadas.

### Validação

- Reenviar a DANFE do print (Yamaha YBR150, motor `G3W6E-104052`, chassi `9C6KG991070073366`) pelo fluxo público de cotação → resultado esperado: `tipo_detectado=nota_fiscal_veiculo`, `numero_motor="G3W6E-104052"`, `chassi="9C6KG991070073366"`, `valor_nota_fiscal="18890.00"`, `nome_comprador="WENDEL LUIZ PEDRO SANTIAGO"`, slot do CRLV verde com badge "Nota Fiscal (substitui CRLV)".
- Enviar um CRLV qualquer no mesmo fluxo → `numero_motor` agora preenchido junto com placa/chassi/renavam.
- Enviar a mesma DANFE pelo link público de documentos avulsos (admin solicita CRLV) → upload aceito, badge "Reconhecido como Nota Fiscal" aparece e o documento entra para análise.

