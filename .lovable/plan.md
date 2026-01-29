
# Plano de Implementacao - Importacao de Oficinas em Massa

## Resumo

Criar uma funcionalidade completa de importacao de oficinas em massa atraves de arquivos Excel (XLSX), CSV ou XLS, seguindo o padrao ja existente na importacao de usuarios do sistema.

---

## Estrutura do Arquivo Excel Recebido

| Coluna Excel | Campo Oficina | Tratamento |
|--------------|---------------|------------|
| Tipo | (filtro) | Aceitar apenas "Oficina" ou importar todos |
| Nome | razao_social | Direto, obrigatorio |
| Nome | nome_fantasia | Igual ao razao_social |
| CNPJ | cnpj | Limpar formatacao, validar |
| CEP | cep | Limpar formatacao (apenas numeros) |
| Endereco | logradouro + numero + bairro | Parsear "RUA X, 123, BAIRRO" |
| Telefone | telefone | Limpar formatacao |
| Cidade | cidade | Remover " CIDADE" do final |
| Estado | estado | Remover " ESTADO" do final, converter para UF |

---

## Componentes a Criar

### 1. ImportarOficinasDialog.tsx

Modal completo com:
- **Step 1 - Upload:** Drag-and-drop de arquivo ou selecao manual
- **Step 2 - Preview:** Tabela de preview com validacao visual
- **Step 3 - Importando:** Progress bar
- **Step 4 - Resultado:** Resumo de sucesso/erros

**Recursos:**
- Download de template Excel
- Validacao de CNPJ duplicado (no arquivo e no banco)
- Validacao de campos obrigatorios (razao_social, cnpj, cidade, estado)
- Parser inteligente de endereco
- Limpeza automatica de dados (CEP, telefone, cidade, estado)
- Edicao inline de linhas com erro antes de importar

### 2. Hook useImportOficinas.ts

```typescript
export function useImportOficinas() {
  // Mutation para importar oficinas em lote
  // Valida CNPJs duplicados no banco
  // Insere em batch
  // Retorna resultados detalhados
}
```

---

## Fluxo de Importacao

```text
1. Usuario clica em "Importar Oficinas"
   |
2. Abre modal com drag-and-drop
   |
3. Usuario faz upload do arquivo XLSX/CSV
   |
4. Sistema processa arquivo:
   - Le dados com biblioteca xlsx
   - Mapeia colunas para campos
   - Parsea enderecos
   - Limpa dados (CNPJ, CEP, telefone, cidade, estado)
   - Valida campos obrigatorios
   - Verifica CNPJs duplicados (no arquivo)
   |
5. Exibe preview com status por linha:
   - Verde: Valido
   - Vermelho: Erro (mostra motivo)
   |
6. Usuario pode editar linhas com erro
   |
7. Usuario clica "Importar X oficinas"
   |
8. Sistema:
   - Verifica CNPJs ja existentes no banco
   - Insere oficinas validas
   - Retorna resultado detalhado
   |
9. Exibe resumo: X importadas, Y erros
```

---

## Logica de Parsing

### Parser de Endereco

Entrada: `"RUA CAMPOS, 541, PARQUE LAFAIETE"`

```typescript
function parseEndereco(endereco: string) {
  // Remove duplicatas tipo "ENDEREÇO: ..."
  const limpo = endereco.split('ENDEREÇO:')[0].trim();
  
  // Split por virgula
  const partes = limpo.split(',').map(p => p.trim());
  
  return {
    logradouro: partes[0] || '',
    numero: partes[1] || '',
    bairro: partes[2] || ''
  };
}
```

### Limpeza de Dados

```typescript
// CNPJ: remove pontos, barras, hifen
const cnpjLimpo = cnpj.replace(/\D/g, '');

// CEP: remove hifen
const cepLimpo = cep.replace(/\D/g, '');

// Telefone: remove formatacao
const telLimpo = telefone.replace(/\D/g, '');

// Cidade: remove " CIDADE" do final
const cidadeLimpa = cidade.replace(/\s*CIDADE$/i, '').trim();

// Estado: converte "RIO DE JANEIRO ESTADO" para "RJ"
const estadoLimpo = parseEstado(estado);
```

### Mapa de Estados

```typescript
const ESTADOS_PARA_UF = {
  'RIO DE JANEIRO': 'RJ',
  'SAO PAULO': 'SP',
  'MINAS GERAIS': 'MG',
  // ... demais estados
};

function parseEstado(estado: string): string {
  const limpo = estado.replace(/\s*ESTADO$/i, '').trim().toUpperCase();
  return ESTADOS_PARA_UF[limpo] || limpo.substring(0, 2);
}
```

---

## Validacoes

| Campo | Validacao |
|-------|-----------|
| razao_social | Obrigatorio, min 3 caracteres |
| cnpj | Obrigatorio, 14 digitos, nao duplicado |
| cidade | Obrigatorio |
| estado | Obrigatorio, 2 caracteres |
| cep | Opcional, 8 digitos se preenchido |
| telefone | Opcional |

---

## Arquivos a Criar/Modificar

### Novos Arquivos

```text
src/components/oficinas/ImportarOficinasDialog.tsx
src/hooks/useImportOficinas.ts
src/lib/parseOficina.ts (utilitarios de parsing)
```

### Arquivos a Modificar

```text
src/pages/oficinas/Oficinas.tsx
- Adicionar botao "Importar"
- Adicionar estado para controlar modal
- Adicionar ImportarOficinasDialog
```

---

## Interface do Modal

### Step 1 - Upload

```text
+------------------------------------------+
|  Importar Oficinas                    [X]|
+------------------------------------------+
|                                          |
|     +----------------------------+       |
|     |                            |       |
|     |   Arraste o arquivo aqui   |       |
|     |   ou clique para selecionar|       |
|     |                            |       |
|     |   .xlsx, .xls, .csv        |       |
|     +----------------------------+       |
|                                          |
|  [Baixar template Excel]                 |
|                                          |
|  Colunas esperadas:                      |
|  Tipo, Nome, CNPJ, CEP, Endereco,       |
|  Telefone, Cidade, Estado                |
+------------------------------------------+
```

### Step 2 - Preview

```text
+------------------------------------------+
|  Importar Oficinas                    [X]|
+------------------------------------------+
| 15 validas | 2 com erro | Total: 17      |
+------------------------------------------+
| Filtrar: [Todas v] [Validas] [Com erro]  |
+------------------------------------------+
| # | Status | Razao Social | CNPJ | Cidade|
|---|--------|--------------|------|-------|
| 1 | [OK]   | ABDALA NAJA  | 05233| RIO...|
| 2 | [OK]   | AUTOMANIA    | 15330| RIO...|
| 3 | [ERR]  | HM SERVICOS  | 2122 | CNPJ..|
+------------------------------------------+
|            [Voltar] [Importar 15 oficinas]|
+------------------------------------------+
```

### Step 3 - Importando

```text
+------------------------------------------+
|  Importando...                           |
+------------------------------------------+
|                                          |
|  [=========>                    ] 45%    |
|                                          |
|  Processando: 7 de 15                    |
|                                          |
+------------------------------------------+
```

### Step 4 - Resultado

```text
+------------------------------------------+
|  Importacao Concluida                    |
+------------------------------------------+
|                                          |
|  [OK] 13 oficinas importadas             |
|  [X]  2 oficinas com erro                |
|                                          |
+------------------------------------------+
| Erros:                                   |
| - Linha 5: CNPJ ja cadastrado            |
| - Linha 8: CNPJ invalido                 |
+------------------------------------------+
|                              [Fechar]    |
+------------------------------------------+
```

---

## Codigo Principal

### ImportarOficinasDialog.tsx (Estrutura)

```tsx
export function ImportarOficinasDialog({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');
  const [oficinas, setOficinas] = useState<OficinaImport[]>([]);
  const [progress, setProgress] = useState(0);
  const [resultados, setResultados] = useState<ImportResult[]>([]);
  
  const { mutateAsync: importOficinas } = useImportOficinas();
  
  const processFile = (file: File) => {
    // Le arquivo com xlsx
    // Mapeia colunas
    // Parsea enderecos
    // Limpa dados
    // Valida
    // setOficinas(validadas)
    // setStep('preview')
  };
  
  const handleImport = async () => {
    setStep('importing');
    // Para cada oficina valida:
    // - Verifica CNPJ no banco
    // - Insere
    // - Atualiza progress
    setStep('result');
  };
  
  return (
    <Dialog>
      {step === 'upload' && <UploadStep />}
      {step === 'preview' && <PreviewStep />}
      {step === 'importing' && <ImportingStep />}
      {step === 'result' && <ResultStep />}
    </Dialog>
  );
}
```

---

## Template Excel para Download

| Tipo | Nome | CNPJ | CEP | Endereco | Telefone | Cidade | Estado |
|------|------|------|-----|----------|----------|--------|--------|
| Oficina | EXEMPLO AUTO LTDA | 00.000.000/0001-00 | 00000-000 | RUA EXEMPLO, 123, CENTRO | (21) 99999-9999 | RIO DE JANEIRO | RJ |

---

## Resumo Tecnico

**Bibliotecas utilizadas:**
- `xlsx` - Leitura de arquivos Excel/CSV (ja instalada)
- `zod` - Validacao de schema (ja instalada)

**Padrao seguido:**
- Baseado em `ImportarUsuariosDialog.tsx` existente
- Mesma estrutura de steps
- Mesma UX de drag-and-drop
- Mesma logica de validacao e preview

**Fluxo de dados:**
1. Arquivo -> xlsx.read()
2. JSON -> mapeamento de colunas
3. Dados brutos -> parseEndereco() + limpeza
4. Dados limpos -> validacao
5. Dados validados -> preview
6. Confirmacao -> insert batch no Supabase

---

## Consideracoes Finais

1. **CNPJs duplicados:** O sistema verificara duplicatas tanto no arquivo quanto no banco
2. **Tipo "Prestador":** Podemos incluir opcao para filtrar apenas "Oficina" ou importar todos
3. **Especialidades:** Nao presentes no Excel, serao array vazio por padrao
4. **Status:** Todas as oficinas importadas terao status "ativo" por padrao
5. **Dados bancarios:** Nao presentes no Excel, serao nulos por padrao
