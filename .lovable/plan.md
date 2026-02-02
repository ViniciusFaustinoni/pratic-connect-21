

# Plano: Verificação Crítica do Nome no Comprovante de Residência

## Resumo

Atualizar a Edge Function `document-ocr` para que a IA realize uma **verificação crítica obrigatória**: comparar o nome do titular no comprovante de residência com o nome do associado (fornecido via `nomeEsperado`), permitindo abreviações.

## Análise do Estado Atual

### O que já existe

| Componente | Status |
|------------|--------|
| Parâmetro `nomeEsperado` enviado para IA | ✅ Existe (linha 79) |
| Campo `nome_titular` extraído do comprovante | ✅ Existe no prompt |
| Instrução básica para verificar nome | ⚠️ Fraca (linha 261) |
| Regra de aprovação automática por endereço legível | ❌ Conflita (linha 140) |

### Problema Atual

A linha 140 do `systemPrompt` diz:
```
Se o endereço estiver completo e legível, SEMPRE sugerir "aprovar"
```

Isso faz com que a IA aprove comprovantes mesmo quando o nome do titular **não confere** com o nome do associado.

## Solução

Adicionar uma **verificação crítica de nome** no `systemPrompt` com as seguintes regras:

### 1. Regra Principal (CRÍTICA)

```
Se o nome_titular do comprovante NÃO corresponder ao nomeEsperado do associado:
→ sugestao: "reprovar"
→ motivo: "Nome do titular ({nome_titular}) não corresponde ao associado ({nomeEsperado})"
```

### 2. Tolerância para Abreviações

A IA deve aceitar como correspondência válida:

| Nome no Comprovante | Nome do Associado | Resultado |
|---------------------|-------------------|-----------|
| MARIO DA SILVA | Mario da Silva | ✅ Aceitar |
| M. DA SILVA | Mario da Silva | ✅ Aceitar |
| MARIO D. SILVA | Mario da Silva | ✅ Aceitar |
| M. D. SILVA | Mario da Silva | ✅ Aceitar |
| MARIA DA SILVA | Mario da Silva | ❌ Reprovar |
| JOSE SILVA | Mario da Silva | ❌ Reprovar |
| (vazio/ilegível) | Mario da Silva | ⚠️ Revisar |

### 3. Casos Especiais

- **Cônjuge**: Se o comprovante estiver em nome de cônjuge, sugerir "revisar" (não reprovar automaticamente)
- **Nome ilegível**: Sugerir "revisar" com motivo explicativo
- **Mesmo sobrenome**: Se pelo menos o sobrenome coincidir, sugerir "revisar" ao invés de reprovar

## Alterações no Arquivo

**Arquivo:** `supabase/functions/document-ocr/index.ts`

### Atualização do systemPrompt (seção Comprovante de Residência)

Adicionar após a linha 143 (REGRAS ESPECIAIS para Comprovante de Residência):

```typescript
// Novas regras a adicionar no systemPrompt:

**⚠️ VERIFICAÇÃO CRÍTICA DE TITULARIDADE ⚠️**

Esta é a verificação MAIS IMPORTANTE para comprovantes de residência:

1. COMPARE o nome_titular extraído do comprovante com o nomeEsperado fornecido no contexto

2. REGRAS DE COMPARAÇÃO DE NOMES (permitir abreviações):
   - Ignore diferenças de maiúsculas/minúsculas
   - Ignore acentos e caracteres especiais
   - Aceite abreviações válidas:
     * "M." ou "M " como abreviação de "Mario", "Maria", "Marcos", etc.
     * "D." ou "Da" ou "De" como conectivos abreviados
     * Iniciais seguidas de ponto são válidas para qualquer nome
   - O SOBRENOME deve corresponder (é obrigatório)
   - Pelo menos a primeira letra do primeiro nome deve corresponder

3. EXEMPLOS DE CORRESPONDÊNCIA:
   - "M. SILVA" corresponde a "Mario Silva" ✓
   - "MARIO D. SILVA" corresponde a "Mario da Silva" ✓
   - "M. D. S." corresponde a "Mario da Silva" ✓
   - "MARIO SILVA" corresponde a "Mario da Silva" ✓
   - "MARIA SILVA" NÃO corresponde a "Mario Silva" ✗
   - "JOSE SANTOS" NÃO corresponde a "Mario Silva" ✗

4. DECISÕES:
   - Se nome_titular CORRESPONDE ao nomeEsperado (incluindo abreviações): pode aprovar
   - Se nome_titular NÃO CORRESPONDE ao nomeEsperado: 
     * sugestao: "reprovar"
     * motivo: "Titular do comprovante ({nome_titular}) diverge do associado ({nomeEsperado})"
   - Se nome_titular está ILEGÍVEL ou VAZIO:
     * sugestao: "revisar"
     * motivo: "Nome do titular não pôde ser lido no documento"
   - Se MESMO SOBRENOME mas primeiro nome diferente (possível cônjuge):
     * sugestao: "revisar"
     * motivo: "Titular pode ser cônjuge/familiar - verificar manualmente"

5. PRIORIDADE: Esta verificação tem prioridade sobre a regra de "endereço legível = aprovar"
```

### Atualização do userPrompt

Modificar a construção do prompt quando `nomeEsperado` está presente para enfatizar a criticidade:

```typescript
// Linha ~260-262, modificar para:
if (nomeEsperado) {
  userPrompt += ` 

⚠️ VERIFICAÇÃO CRÍTICA DE TITULARIDADE ⚠️
Nome do associado no cadastro: "${nomeEsperado}"
Se for COMPROVANTE DE RESIDÊNCIA: compare o nome do titular com este nome.
REPROVE se os nomes não corresponderem (permitindo abreviações válidas).`;
}
```

### Atualização da Resposta da IA

Adicionar campos específicos para a validação de titularidade:

```typescript
// Na estrutura de resposta esperada, adicionar para comprovante_residencia:
{
  "tipo_detectado": "comprovante_residencia",
  "dados": {
    "nome_titular": "...",
    "nome_titular_validado": true | false,  // NOVO: indica se nome confere
    // ... outros campos
  },
  "validacao_titularidade": {  // NOVO: detalhes da comparação
    "nome_titular_extraido": "M. DA SILVA",
    "nome_esperado": "Mario da Silva",
    "correspondencia": true | false,
    "tipo_correspondencia": "exata" | "abreviacao" | "nenhuma" | "possivel_conjuge",
    "observacao": "Abreviação válida detectada"
  }
}
```

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│  ANÁLISE DE COMPROVANTE DE RESIDÊNCIA                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Extrair nome_titular do documento                           │
│     └─> "M. DA SILVA"                                           │
│                                                                 │
│  2. Receber nomeEsperado do associado                           │
│     └─> "Mario da Silva"                                        │
│                                                                 │
│  3. Comparar nomes (com tolerância a abreviações)               │
│     ├─> Normalizar: remover acentos, lowercase                  │
│     ├─> Verificar sobrenome: "SILVA" = "Silva" ✓                │
│     └─> Verificar primeiro nome: "M." ~ "Mario" ✓               │
│                                                                 │
│  4. Decisão                                                     │
│     ├─> Correspondência: SIM                                    │
│     ├─> sugestao: "aprovar"                                     │
│     └─> motivo: "Documento válido, titular corresponde"         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tabela de Decisões

| Cenário | nome_titular | nomeEsperado | Decisão | Motivo |
|---------|--------------|--------------|---------|--------|
| Match exato | Mario Silva | Mario Silva | ✅ Aprovar | Nomes conferem |
| Abreviação 1ª letra | M. Silva | Mario Silva | ✅ Aprovar | Abreviação válida |
| Abreviação completa | M. D. S. | Mario da Silva | ✅ Aprovar | Abreviação válida |
| Caixa diferente | MARIO SILVA | mario silva | ✅ Aprovar | Ignora caixa |
| Nome diferente | Maria Silva | Mario Silva | ⚠️ Revisar | Possível cônjuge |
| Sobrenome diferente | Mario Santos | Mario Silva | ❌ Reprovar | Nomes divergentes |
| Nome ilegível | (null) | Mario Silva | ⚠️ Revisar | Não foi possível ler |
| Completamente diferente | Jose Santos | Mario Silva | ❌ Reprovar | Titular diverge |

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/document-ocr/index.ts` | Atualizar systemPrompt e userPrompt |

## Benefícios

1. **Segurança**: Impede aprovação de comprovantes em nome de terceiros
2. **Flexibilidade**: Aceita abreviações comuns em documentos
3. **Clareza**: Motivo de reprovação é explícito para o analista
4. **Auditoria**: Registra a comparação feita pela IA

