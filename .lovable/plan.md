

## OCR perdendo número do motor, chassi e endereço (CEP/bairro) — corrigir 4 falhas no pipeline

### Diagnóstico (causas reais, em ordem)

**1. Endereço (CEP, bairro, logradouro, cidade) some quando JSON do OCR vem truncado.**
Em `supabase/functions/document-ocr/index.ts` linha 435, o fallback de extração via regex (`dadosFields`) lista campos para CNH/RG/CRLV mas **não inclui** os campos do comprovante de residência: `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `cep`, `nome_titular`, `tipo_comprovante`. Quando o modelo retorna JSON parcialmente quebrado (acontece em PDFs grandes / imagens HEIC convertidas), esses campos ficam em branco — daí o "às vezes não puxa CEP, às vezes não puxa bairro".

**2. Chassi não tem retry direcionado nem extração via texto nativo do PDF para CRLV digital.**
O `numero_motor` já tem retry com `gemini-2.5-pro` (linhas 1015-1112) e fallback para texto nativo do PDF. **O chassi não tem esse retry.** Quando o modelo lê 16 dos 17 caracteres ou marca `ilegivel`, o sistema só registra o erro e sugere "revisar" (linha 1203), mas não tenta nova extração — e o usuário recebe o documento sem chassi, tendo que digitar manualmente.

**3. `numero_motor` é extraído mas nunca persistido na cotação/veículo.**
Em `EtapaDadosPessoaisDocumentos.tsx` linhas 244-246 e 271, o componente popula `dadosExtraidos.numero_motor` corretamente. Porém em `useCotacaoContratacao.ts` linha 451-484 (`salvarDadosPessoais`), o `update` da cotação **não inclui** `veiculo_motor` nem `numero_motor`. O dado é exibido na tela mas perdido ao salvar — daí "OCR não tá puxando o número do motor". Também não vai para `DadosPessoaisForm` (linhas 327-352), que omite `veiculo_motor`/`numero_motor` no payload de submit.

**4. Endereço da instalação cai vazio porque o associado às vezes não tem `cep`/`bairro` salvos.**
Em `AssociadoVistoria.tsx` linha 397-406, o `enderecoInicial` vem de `contrato.associados`. Se durante a contratação o OCR do comprovante falhou (problema #1), o associado fica com `cep`/`bairro` em branco e a etapa de instalação aparece sem pré-preenchimento. Hoje há um fallback no input de CEP via ViaCEP, mas só quando o usuário digita o CEP — não há fallback para puxar do `cliente_*` da cotação ou do `proposta`.

### O que vai mudar

**Edição A — `supabase/functions/document-ocr/index.ts`**

A1. Linha 435 — incluir campos do comprovante e do veículo no fallback regex de JSON truncado:
```ts
const dadosFields = [
  // pessoais (já existem)
  'nome','cpf','rg','data_nascimento','numero_registro','validade','data_expedicao','orgao_expedidor','categoria',
  // veículo (já existem)
  'placa','renavam','chassi','marca','modelo','cor','combustivel','motor','numero_motor','nome_proprietario',
  // ADICIONAR — comprovante de residência:
  'logradouro','numero','complemento','bairro','cidade','uf','cep','nome_titular','tipo_comprovante','data_emissao',
  // ADICIONAR — ATPV-e/NF veículo:
  'ano_fabricacao','ano_modelo','nome_comprador','cpf_comprador','cpf_cnpj_comprador','valor_nota_fiscal',
];
```
(Os campos numéricos `ano_fabricacao`/`ano_modelo` já têm regex separada — manter.)

A2. Após linha 1119 — adicionar **retry direcionado para chassi** (espelho do retry de motor):
- Disparar quando `tipo ∈ {crlv, atpv_e, nota_fiscal_veiculo}` e `!validateChassi(d.chassi)`.
- Usar `OCR_RETRY_MODEL` (`gemini-2.5-pro`) com prompt focado: "extraia APENAS o chassi (17 chars, sem I/O/Q)".
- Tool calling `report_chassi` com schema `{chassi: string}`.
- Antes do retry, já tentar via `extractCandidatesFromText(extractedPdfText, 'chassi')` — se houver candidato válido no texto nativo, usar direto sem chamar API.

A3. Linha 1289 (`extractCandidatesFromText`) — adicionar `case 'numero_motor'` (regex `/MOTOR[^\w]{0,5}([A-Z0-9-]{6,17})/gi`) e `case 'cep'` (regex `/\b(\d{5}-?\d{3})\b/g`) para alimentar o fallback do checksum quando o PDF é nativo.

A4. Validador de chassi — adicionar saneamento de OCR: trocar `0↔O`, `1↔I`, `5↔S` em posições conhecidas do chassi e retentar `validateChassi` (mesmo padrão já feito para placa).

**Edição B — `src/components/cotacao-publica/FormularioDadosPessoais.tsx` + `EtapaDadosPessoaisDocumentos.tsx`**

B1. Em `FormularioDadosPessoais.tsx` (schema `DadosPessoaisForm`) — adicionar `veiculo_numero_motor: z.string().optional()` (já tem `veiculo_chassi`).

B2. Em `EtapaDadosPessoaisDocumentos.tsx` linha 327-352 (`handleSubmit`) — incluir no payload:
```ts
veiculo_numero_motor: dadosExtraidos.numero_motor || dadosExtraidos.veiculo_motor || undefined,
```

**Edição C — `src/hooks/useCotacaoContratacao.ts`**

C1. Linha 451-484 (`salvarDadosPessoais.update`) — persistir `numero_motor` na cotação:
```ts
veiculo_motor: dados.veiculo_numero_motor || null,  // coluna existente em cotacoes (verificar) 
```
Se a coluna não existir, criar migration `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_motor TEXT;` e equivalente em `veiculos.numero_motor` (a propagar quando o associado/veículo é criado).

C2. Garantir que ao gerar/promover o associado e o veículo final, `numero_motor` é copiado da cotação para `veiculos.numero_motor` (verificar a função/edge que faz a promoção — ajustar SELECT/INSERT).

**Edição D — `src/pages/public/AssociadoVistoria.tsx` linhas 397-406**

Acrescentar **fallback em cascata** ao montar `enderecoInicial`. Hoje só lê `contrato.associados`. Passar a tentar nesta ordem:
1. `contrato.associados.cep/logradouro/...` (atual);
2. Se vazio, ler `cotacao.cliente_cep/cliente_logradouro/...` da cotação que originou o contrato (já carregada via `contrato.cotacao_id`);
3. Se ainda vazio, ler `proposta.endereco_*` quando aplicável.
Adicionar `select` complementar em `useContratoLink.ts` linha 24 trazendo os campos `cliente_*` da `cotacoes` join.

### O que NÃO muda

- Modelo OCR (`gemini-2.5-flash` + retry `gemini-2.5-pro`) — só ganha 1 retry novo (chassi).
- UI do uploader unificado, validação de placa, regras de 0KM (`isPlacaPlaceholder`).
- Schema do storage / RLS dos buckets.
- Fluxo de assinatura Autentique e geração de contrato.

### Arquivos editados

- `supabase/functions/document-ocr/index.ts` — A1 (regex campos), A2 (retry chassi), A3 (cep/motor fallback texto nativo), A4 (saneamento OCR chassi).
- `src/components/cotacao-publica/FormularioDadosPessoais.tsx` — schema com `veiculo_numero_motor`.
- `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` — submit incluindo `veiculo_numero_motor`.
- `src/hooks/useCotacaoContratacao.ts` — persistir `veiculo_motor`/`numero_motor` na cotação.
- `src/hooks/useContratoLink.ts` — incluir `cotacoes.cliente_*` no select da query do contrato público.
- `src/pages/public/AssociadoVistoria.tsx` — `enderecoInicial` em cascata (associado → cotação).
- Migration SQL — `ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_motor TEXT;` + `ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS numero_motor TEXT;` (apenas se não existirem).
- `mem://infrastructure/documents/ocr-resilience-and-cnh-parsing-v4` — atualizar com o novo retry de chassi e o fallback de texto nativo para CEP/motor.

### Riscos

- Retry de chassi adiciona ~1.5s a OCR de CRLV quando o chassi falha — aceitável (hoje o usuário precisa digitar manualmente, o que é pior).
- Saneamento OCR de chassi pode aceitar um chassi "quase válido" — mitigado porque sempre passa por `validateChassi` (regex restrita 17 chars sem I/O/Q) antes de aceitar.
- `numero_motor` persistido pode entrar vazio se o documento realmente não tinha o campo — comportamento equivalente ao atual.

