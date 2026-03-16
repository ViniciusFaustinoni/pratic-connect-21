

## Diagnóstico

O problema está na linha 226 de `usePlanosCotacao.ts`:

```typescript
if (!regra) return 'negado';  // ← whitelist: tudo que não está na lista = negado
```

Com a lógica whitelist, qualquer modelo que não bata **exatamente** com a lista recebe status `'negado'` e aparece com badge vermelho "Restrição de modelo". Como a normalização não cobre todos os casos (ex: "VOYAGE MB5" não é reduzido a "VOYAGE" porque "MB5" não começa com dígito), praticamente todos os veículos aparecem como inelegíveis.

A memória do projeto confirma o design original: *"A lógica funciona como uma lista de exceções: veículos não listados são aceitos por padrão ('aprovado')"*. A tabela `plano_elegibilidade_modelos` é uma **blocklist/exception list**, não uma whitelist.

## Correção

**Arquivo único:** `src/hooks/usePlanosCotacao.ts`

### 1. Reverter linha 226 para blocklist (design original)

```
if (!regra) return 'negado';
```
→
```
if (!regra) return 'aprovado';
```

Modelos não listados = aceitos por padrão. Apenas modelos explicitamente cadastrados com `status='negado'` ou `status='limitado'` receberão sinalização visual.

### 2. Melhorar normalização do modelo (linha 208-209)

O regex atual `\s+\d[\d.,V]*.*$` só remove sufixos que começam com dígito. Falha em casos como "VOYAGE MB5". Trocar para um regex mais abrangente que remove versões alfanuméricas comuns:

```typescript
const normalizarModelo = (m: string) =>
  m.trim().toUpperCase()
    .replace(/\s+\d[\d.,]*\s*[A-Z]*$/, '')   // "1.6", "1.0T"
    .replace(/\s+[A-Z]*\d+[A-Z]*$/, '')      // "MB5", "T6", "V8"
    .trim();
```

Isso permite que "VOYAGE MB5" → "VOYAGE", melhorando o match com o banco.

Nenhum outro arquivo alterado. Os badges visuais no `PlanoCardCotacao.tsx` já estão corretos — só mostrarão para planos com status `'negado'` ou `'limitado'` explícito na tabela.

