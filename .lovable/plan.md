## Objetivo

No link público de contratação (e em todos os fluxos OCR), o **Comprovante de Residência não deve mais extrair/exibir o campo CPF**. O CPF do titular já é obtido da CNH ou Documento Pessoal e deve ser reaproveitado, evitando confusão e divergências.

## Alterações

### 1. `src/components/ocr/ocr-fields-schema.ts`
Remover a linha `{ key: 'cpf_titular', label: 'CPF', mask: 'cpf' }` de `COMPROVANTE_RESIDENCIA_FIELDS`. Assim o card "Dados extraídos — Comprovante de Residência" deixa de mostrar o campo CPF.

### 2. `supabase/functions/document-ocr/index.ts`
- Remover `cpf_titular` da lista de campos solicitados ao modelo (linha 533).
- Remover a instrução específica de extração de CPF do titular (linha 536).
- Remover `cpf_titular` da lista de campos persistidos (linha 641).
- Manter linha 2062 (`for (const field of ['cpf', 'cpf_titular', ...])`) — é apenas normalização defensiva caso outros docs tragam o campo; não custa nada.

### 3. Validação de titularidade
Continua usando apenas `nome_titular` vs `nomeEsperado` (já é o comportamento atual nos prompts). Nenhuma lógica de matching por CPF do comprovante existe hoje, então nada quebra.

## Fora de escopo

- CNH, RG, Documento Pessoal continuam extraindo CPF normalmente (fonte canônica).
- Nenhuma migração de banco — `cpf_titular` em comprovantes antigos permanece, apenas paramos de capturar novos.

## Validação

Após o deploy, abrir um link público, anexar um comprovante de residência e confirmar que o card de dados extraídos mostra apenas: Nome do titular, CEP, Logradouro, Número, Bairro, Cidade, UF, Data de emissão (sem CPF).
