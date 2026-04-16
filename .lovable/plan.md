

## Plano: Corrigir Extração de Nome no OCR de RG

### Problema

O prompt do OCR para documentos RG (linha 82 de `document-ocr/index.ts`) tem instruções mínimas: apenas lista os campos sem orientação sobre onde extraí-los. O modelo de IA confunde o nome do titular com:
- A assinatura do presidente do DETRAN no rodapé (ex: "ADOLPHO KONDER HOMEM DE CARVALHO FILHO")
- Nomes de autoridades impressos no documento

### Correção

Expandir a seção `### RG` no `systemPrompt` (linha 81-82) com instruções explícitas:

```
### RG
nome, rg, cpf (se presente), data_nascimento, data_expedicao
- NOME: extrair EXCLUSIVAMENTE do campo "NOME" que fica na parte superior do documento, logo abaixo do cabeçalho institucional. Este é o nome do titular do documento.
- NÃO confundir com nomes de autoridades, presidentes do DETRAN, ou assinaturas oficiais impressas no rodapé do documento (ex: "PRESIDENTE DO DETRAN").
- FILIAÇÃO: campos "FILIAÇÃO" contêm nomes dos pais — NÃO são o nome do titular.
- RG: campo "REGISTRO GERAL" — extrair o número com pontuação.
- CPF: pode estar presente no verso ou na frente. Formato XXX.XXX.XXX-XX.
```

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/document-ocr/index.ts` | Expandir instruções da seção RG no systemPrompt (linha 82) |

### Deploy
A edge function precisa ser redeployada após a alteração.

