
# Plano: Extrair Dados Adicionais de CRLV e CNH no OCR

## Objetivo
Adicionar extração automática de:
- **CRLV:** Cor, Combustível e **Número do Motor** (novo campo)
- **CNH:** Validade, Número de Registro (CNH) e RG

---

## Análise do Estado Atual

### Edge Function `document-ocr/index.ts`

**CRLV - Campos atuais (linha 67-78):**
| Campo | Extraindo? |
|-------|------------|
| cor | ✅ Sim |
| combustivel | ✅ Sim |
| motor | ❌ **NÃO** |

**CNH - Campos atuais (linha 16-23):**
| Campo | Extraindo? |
|-------|------------|
| validade | ✅ Sim |
| rg | ✅ Sim |
| numero_registro / registro | ❌ **NÃO** |

### Frontend `handleOcrDataExtracted`

**ContratoWizard.tsx (linhas 321-341):**
- ✅ Já processa `numero_registro` ou `registro` para campo `cnh`
- ✅ Já processa `validade` para campo `cnh_validade`
- ✅ Já processa `cor` do CRLV (linha 463)
- ✅ Já processa `combustivel` do CRLV (linha 478)
- ❌ **Não processa** campo `motor` do CRLV

**EtapaDadosPessoaisDocumentos.tsx (linhas 162-220):**
- ✅ Já processa `numero_registro`/`registro` para `cnh`
- ✅ Já processa `validade` para `cnh_validade`
- ✅ Já processa `cor` do CRLV
- ✅ Já processa `combustivel` do CRLV
- ❌ **Não processa** campo `motor` do CRLV

---

## Alterações Necessárias

### 1. Edge Function - `supabase/functions/document-ocr/index.ts`

#### 1.1 Adicionar campo `motor` no CRLV (linha 67-78)

**Antes:**
```
### CRLV (Certificado de Registro e Licenciamento de Veículo)
Extrair OBRIGATORIAMENTE:
- placa (formato ABC1234 ou ABC1D23)
- renavam (11 dígitos)
- chassi (17 caracteres alfanuméricos)
- marca (ex: TOYOTA, VOLKSWAGEN, HONDA)
- modelo (ex: COROLLA XEI, GOL 1.0, CIVIC)
- ano_fabricacao (APENAS o número do ano de fabricação, ex: 2013)
- ano_modelo (APENAS o número do ano do modelo, ex: 2014)
- cor (ex: PRATA, PRETO, BRANCO)
- combustivel (ex: FLEX, GASOLINA, DIESEL)
- nome_proprietario (nome completo do proprietário)
```

**Depois:**
```
### CRLV (Certificado de Registro e Licenciamento de Veículo)
Extrair OBRIGATORIAMENTE:
- placa (formato ABC1234 ou ABC1D23)
- renavam (11 dígitos)
- chassi (17 caracteres alfanuméricos)
- marca (ex: TOYOTA, VOLKSWAGEN, HONDA)
- modelo (ex: COROLLA XEI, GOL 1.0, CIVIC)
- ano_fabricacao (APENAS o número do ano de fabricação, ex: 2013)
- ano_modelo (APENAS o número do ano do modelo, ex: 2014)
- cor (ex: PRATA, PRETO, BRANCO)
- combustivel (ex: FLEX, GASOLINA, DIESEL)
- motor (número do motor, ex: M155966, 1234ABC5678)
- nome_proprietario (nome completo do proprietário)
```

#### 1.2 Adicionar campo `numero_registro` no CNH (linha 16-23)

**Antes:**
```
### CNH (Carteira Nacional de Habilitação)
Extrair OBRIGATORIAMENTE:
- nome (nome completo do condutor)
- cpf (formato 000.000.000-00) - **PRIORIDADE MÁXIMA**
- rg (número do RG)
- data_nascimento (formato YYYY-MM-DD)
- validade (formato YYYY-MM-DD)
- categoria (A, B, AB, etc.)
```

**Depois:**
```
### CNH (Carteira Nacional de Habilitação)
Extrair OBRIGATORIAMENTE:
- nome (nome completo do condutor)
- cpf (formato 000.000.000-00) - **PRIORIDADE MÁXIMA**
- rg (número do RG)
- numero_registro (número de registro da CNH, campo "N° Registro" ou "Registro" - geralmente 11 dígitos)
- data_nascimento (formato YYYY-MM-DD)
- validade (formato YYYY-MM-DD)
- categoria (A, B, AB, etc.)
```

---

### 2. Frontend - Processar campo `motor`

#### 2.1 `src/components/contratos/ContratoWizard.tsx`

Adicionar no bloco de processamento do CRLV (após linha 476):

```typescript
// Número do motor
const motor = dados.motor || dados.numero_motor || dados.n_motor;
if (motor && !form.getValues('motor')) {
  form.setValue('motor', motor);
  setDadosExtraidos(prev => ({ ...prev, motor: { value: motor, fonte: 'CRLV' } }));
}
```

#### 2.2 `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

Adicionar no bloco de processamento do CRLV (após linha 196):

```typescript
// Número do motor
if (dados.motor) novosDados.veiculo_motor = dados.motor;
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/document-ocr/index.ts` | Adicionar `motor` no prompt do CRLV e `numero_registro` no prompt da CNH |
| `src/components/contratos/ContratoWizard.tsx` | Processar campo `motor` extraído do CRLV |
| `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` | Processar campo `motor` extraído do CRLV |

---

## Fluxo Completo Após Implementação

**CRLV:**
1. Upload do documento
2. OCR extrai: cor, combustível, motor, renavam, chassi, placa, etc.
3. Frontend mapeia automaticamente para os campos do formulário

**CNH:**
1. Upload do documento  
2. OCR extrai: validade, numero_registro (CNH), rg, cpf, nome, etc.
3. Frontend mapeia automaticamente para os campos do formulário

---

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar prompt do OCR (CRLV + CNH) | 3 min |
| Deploy da Edge Function | 1 min |
| Atualizar ContratoWizard.tsx | 2 min |
| Atualizar EtapaDadosPessoaisDocumentos.tsx | 2 min |
| Testar com documento real | 5 min |
| **Total** | **~13 min** |
