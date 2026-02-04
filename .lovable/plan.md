
# Plano: Expandir Extracao de Dados por IA (OCR) para Campos de Cliente e Veiculo

## Contexto do Problema

O sistema atual ja possui uma estrutura robusta de OCR via IA (`document-ocr`) que extrai dados de documentos (CNH, CRLV, Comprovante de Residencia). Porem, diversos campos que a IA **JA EXTRAI** nao estao sendo mapeados e persistidos corretamente nas tabelas do banco de dados.

### Analise Atual

**Edge Function `document-ocr`** ja extrai:

| Documento | Campo Extraido | Status no Sistema |
|-----------|----------------|-------------------|
| **CNH** | nome | ✅ Mapeado |
| **CNH** | cpf | ✅ Mapeado |
| **CNH** | rg | ⚠️ Extraido mas NAO persistido em cotacoes/contratos |
| **CNH** | data_nascimento | ✅ Mapeado |
| **CNH** | validade (CNH) | ❌ NAO mapeado |
| **CNH** | categoria | ❌ NAO mapeado |
| **CRLV** | placa | ✅ Mapeado |
| **CRLV** | renavam | ✅ Mapeado |
| **CRLV** | chassi | ✅ Mapeado |
| **CRLV** | marca | ❌ NAO mapeado (ja vem da FIPE) |
| **CRLV** | modelo | ❌ NAO mapeado (ja vem da FIPE) |
| **CRLV** | ano_fabricacao | ❌ NAO mapeado |
| **CRLV** | ano_modelo | ❌ NAO mapeado |
| **CRLV** | cor | ❌ NAO mapeado para cotacoes |
| **CRLV** | combustivel | ❌ NAO mapeado para cotacoes |
| **Comprovante** | logradouro | ✅ Mapeado |
| **Comprovante** | numero | ✅ Mapeado |
| **Comprovante** | bairro | ✅ Mapeado |
| **Comprovante** | cidade | ✅ Mapeado |
| **Comprovante** | uf | ✅ Mapeado |
| **Comprovante** | cep | ✅ Mapeado |
| **Comprovante** | nome_titular | ⚠️ Usado para validacao mas nao persistido |

### Campos Faltantes nas Tabelas

**Tabela `cotacoes`** - Campos que precisam ser adicionados:
- `cliente_rg` (varchar) - Numero do RG
- `cliente_rg_orgao` (varchar) - Orgao emissor do RG
- `cliente_cnh` (varchar) - Numero da CNH
- `cliente_cnh_validade` (date) - Validade da CNH
- `cliente_cnh_categoria` (varchar) - Categoria da CNH
- `veiculo_ano_fabricacao` (integer) - Ano de fabricacao
- `veiculo_ano_modelo` (integer) - Ano do modelo (renomear o campo existente `veiculo_ano`)

**Tabela `contratos`** - Campos que precisam ser adicionados:
- `cliente_rg` (varchar)
- `cliente_rg_orgao` (varchar)
- `cliente_cnh` (varchar)
- `cliente_cnh_validade` (date)
- `cliente_cnh_categoria` (varchar)
- `cliente_data_nascimento` (date)
- `cliente_logradouro` (text) - Atualmente tudo vai em `cliente_endereco`
- `cliente_numero` (varchar)
- `cliente_bairro` (varchar)
- `cliente_complemento` (varchar)
- `veiculo_combustivel` (varchar)
- `veiculo_ano_fabricacao` (integer)

---

## Plano de Implementacao

### Fase 1: Migracao de Banco de Dados

Adicionar os campos faltantes nas tabelas `cotacoes` e `contratos`.

```sql
-- Tabela cotacoes: Campos de documentos pessoais
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_rg VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_rg_orgao VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cnh VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cnh_validade DATE;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cnh_categoria VARCHAR(10);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_ano_fabricacao INTEGER;

-- Tabela contratos: Snapshot completo do cliente
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_rg VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_rg_orgao VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_cnh VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_cnh_validade DATE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_cnh_categoria VARCHAR(10);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_data_nascimento DATE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_logradouro TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_numero VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_bairro VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_complemento VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_combustivel VARCHAR(50);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_ano_fabricacao INTEGER;
```

### Fase 2: Atualizar Edge Function `document-ocr`

A edge function ja extrai todos esses campos! O prompt atual ja pede:

**Para CNH:**
```
- nome, cpf, rg, data_nascimento, validade, categoria
```

**Para CRLV:**
```
- placa, renavam, chassi, marca, modelo, ano_fabricacao, ano_modelo, cor, combustivel
```

Nenhuma alteracao necessaria no OCR - apenas garantir que os dados retornados sejam mapeados.

### Fase 3: Atualizar Interface `DadosExtraidos`

**Arquivo:** `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

```typescript
interface DadosExtraidos {
  // Dados pessoais (de CNH/RG)
  nome?: string;
  cpf?: string;
  rg?: string;
  data_nascimento?: string;
  // NOVOS CAMPOS
  cnh?: string;           // Numero da CNH
  cnh_validade?: string;  // Validade da CNH
  cnh_categoria?: string; // Categoria (A, B, AB, etc)
  
  // Endereco (de Comprovante)
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  
  // Veiculo (de CRLV)
  veiculo_placa?: string;
  veiculo_chassi?: string;
  veiculo_renavam?: string;
  // NOVOS CAMPOS
  veiculo_cor?: string;
  veiculo_combustivel?: string;
  veiculo_ano_fabricacao?: number;
  veiculo_ano_modelo?: number;
}
```

### Fase 4: Atualizar Mapeamento OCR → Estado

**Arquivo:** `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

Atualizar a funcao `handleOcrDataExtracted`:

```typescript
const handleOcrDataExtracted = useCallback((dados: Record<string, string>, tipoDocumento?: string) => {
  setDadosExtraidos(prev => {
    const novosDados = { ...prev };
    
    // De CNH ou RG: dados pessoais + documentos
    if (tipoDocumento === 'cnh' || tipoDocumento === 'rg') {
      if (dados.nome) novosDados.nome = dados.nome;
      if (dados.cpf) novosDados.cpf = dados.cpf;
      if (dados.rg) novosDados.rg = dados.rg;
      if (dados.data_nascimento) novosDados.data_nascimento = dados.data_nascimento;
      // NOVOS MAPEAMENTOS
      if (dados.numero_registro) novosDados.cnh = dados.numero_registro;
      if (dados.validade) novosDados.cnh_validade = dados.validade;
      if (dados.categoria) novosDados.cnh_categoria = dados.categoria;
    }
    
    // De CRLV: dados do veiculo
    if (tipoDocumento === 'crlv') {
      if (dados.placa) novosDados.veiculo_placa = dados.placa;
      if (dados.chassi) novosDados.veiculo_chassi = dados.chassi;
      if (dados.renavam) novosDados.veiculo_renavam = dados.renavam;
      // NOVOS MAPEAMENTOS
      if (dados.cor) novosDados.veiculo_cor = dados.cor;
      if (dados.combustivel) novosDados.veiculo_combustivel = dados.combustivel;
      if (dados.ano_fabricacao) novosDados.veiculo_ano_fabricacao = parseInt(dados.ano_fabricacao);
      if (dados.ano_modelo) novosDados.veiculo_ano_modelo = parseInt(dados.ano_modelo);
    }
    
    // Comprovante de Residencia: sem alteracoes
    if (tipoDocumento === 'comprovante_residencia') {
      // ... manter codigo existente
    }
    
    return novosDados;
  });
}, []);
```

### Fase 5: Atualizar Persistencia na Cotacao

**Arquivo:** `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

Atualizar `DadosPessoaisForm` para incluir novos campos e passar para o submit:

```typescript
const handleSubmit = () => {
  const dados: DadosPessoaisForm = {
    // Dados existentes...
    nome: dadosExtraidos.nome || '',
    cpf: dadosExtraidos.cpf || '',
    email,
    telefone,
    data_nascimento: dadosExtraidos.data_nascimento || '',
    // NOVOS CAMPOS PESSOAIS
    rg: dadosExtraidos.rg || undefined,
    cnh: dadosExtraidos.cnh || undefined,
    cnh_validade: dadosExtraidos.cnh_validade || undefined,
    cnh_categoria: dadosExtraidos.cnh_categoria || undefined,
    // Endereco
    cep: dadosExtraidos.cep || '',
    logradouro: dadosExtraidos.logradouro || '',
    numero: dadosExtraidos.numero || '',
    complemento: dadosExtraidos.complemento || '',
    bairro: dadosExtraidos.bairro || '',
    cidade: dadosExtraidos.cidade || '',
    uf: dadosExtraidos.uf || '',
    // NOVOS CAMPOS VEICULO
    veiculo_chassi: dadosExtraidos.veiculo_chassi || undefined,
    veiculo_renavam: dadosExtraidos.veiculo_renavam || undefined,
    veiculo_cor: dadosExtraidos.veiculo_cor || undefined,
    veiculo_combustivel: dadosExtraidos.veiculo_combustivel || undefined,
    veiculo_ano_fabricacao: dadosExtraidos.veiculo_ano_fabricacao || undefined,
  };
  onSubmit(dados);
};
```

### Fase 6: Atualizar Hook de Cotacao Publica

**Arquivo:** `src/hooks/useCotacaoPublica.ts` (ou similar)

Garantir que os novos campos sejam salvos na tabela `cotacoes`:

```typescript
await supabase
  .from('cotacoes')
  .update({
    cliente_cpf: dados.cpf,
    cliente_data_nascimento: dados.data_nascimento,
    // NOVOS CAMPOS
    cliente_rg: dados.rg,
    cliente_cnh: dados.cnh,
    cliente_cnh_validade: dados.cnh_validade,
    cliente_cnh_categoria: dados.cnh_categoria,
    // Endereco
    cliente_cep: dados.cep,
    cliente_logradouro: dados.logradouro,
    cliente_numero: dados.numero,
    cliente_complemento: dados.complemento,
    cliente_bairro: dados.bairro,
    cliente_cidade: dados.cidade,
    cliente_uf: dados.uf,
    // Veiculo
    veiculo_chassi: dados.veiculo_chassi,
    veiculo_renavam: dados.veiculo_renavam,
    veiculo_cor: dados.veiculo_cor,
    veiculo_combustivel: dados.veiculo_combustivel,
    veiculo_ano_fabricacao: dados.veiculo_ano_fabricacao,
  })
  .eq('id', cotacaoId);
```

### Fase 7: Atualizar Geracao de Contrato

**Arquivo:** `src/hooks/useContratos.ts` ou `ContratoWizard.tsx`

Ao criar o contrato, copiar todos os dados da cotacao para o snapshot:

```typescript
const contratoData = {
  // ... campos existentes
  cliente_nome: dados.nome,
  cliente_cpf: dados.cpf,
  cliente_email: dados.email,
  cliente_telefone: dados.telefone,
  // NOVOS CAMPOS
  cliente_rg: cotacao.cliente_rg,
  cliente_cnh: cotacao.cliente_cnh,
  cliente_cnh_validade: cotacao.cliente_cnh_validade,
  cliente_cnh_categoria: cotacao.cliente_cnh_categoria,
  cliente_data_nascimento: cotacao.cliente_data_nascimento,
  cliente_logradouro: cotacao.cliente_logradouro,
  cliente_numero: cotacao.cliente_numero,
  cliente_bairro: cotacao.cliente_bairro,
  cliente_complemento: cotacao.cliente_complemento,
  cliente_cep: cotacao.cliente_cep,
  cliente_cidade: cotacao.cliente_cidade,
  cliente_uf: cotacao.cliente_uf,
  // Veiculo
  veiculo_placa: cotacao.veiculo_placa,
  veiculo_marca: cotacao.veiculo_marca,
  veiculo_modelo: cotacao.veiculo_modelo,
  veiculo_ano: cotacao.veiculo_ano,
  veiculo_cor: cotacao.veiculo_cor,
  veiculo_chassi: cotacao.veiculo_chassi,
  veiculo_renavam: cotacao.veiculo_renavam,
  veiculo_combustivel: cotacao.veiculo_combustivel,
  veiculo_ano_fabricacao: cotacao.veiculo_ano_fabricacao,
};
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| **Banco de Dados** | Migracao SQL para adicionar colunas |
| `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` | Expandir interface e mapeamento |
| `src/components/cotacao-publica/FormularioDadosPessoais.tsx` | Atualizar tipo `DadosPessoaisForm` |
| `src/hooks/useCotacaoPublica.ts` | Persistir novos campos |
| `src/components/contratos/ContratoWizard.tsx` | Mapear novos campos ao criar contrato |
| `src/hooks/useContratos.ts` | Incluir novos campos na criacao |

---

## Diagrama do Fluxo de Dados

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  FLUXO DE EXTRACAO E PERSISTENCIA DE DADOS                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐
│  DOCUMENTO  │───>│  Edge Function   │───>│  Dados Extraidos (JSON)     │
│  (CNH/CRLV) │    │  document-ocr    │    │  {nome, cpf, rg, validade,  │
└─────────────┘    │  (JA EXTRAI!)    │    │   chassi, renavam, cor...}  │
                   └──────────────────┘    └──────────────┬──────────────┘
                                                          │
                                                          ▼
                    ┌─────────────────────────────────────────────────────┐
                    │  handleOcrDataExtracted()                           │
                    │  Mapeia dados para estado local                     │
                    │  [ATUALIZAR MAPEAMENTO AQUI]                        │
                    └──────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────────────────┐
                    │  handleSubmit() -> onSubmit(dados)                  │
                    │  Envia dados para persistencia                      │
                    └──────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  TABELA: cotacoes                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐                     │
│  │ CLIENTE              │  │ VEICULO              │                     │
│  │ cliente_cpf       ✓  │  │ veiculo_placa     ✓  │                     │
│  │ cliente_rg        +  │  │ veiculo_chassi    ✓  │                     │
│  │ cliente_cnh       +  │  │ veiculo_renavam   ✓  │                     │
│  │ cliente_cnh_val   +  │  │ veiculo_cor       +  │                     │
│  │ cliente_cnh_cat   +  │  │ veiculo_combust   +  │                     │
│  │ cliente_nasc      ✓  │  │ veiculo_ano_fab   +  │                     │
│  └──────────────────────┘  └──────────────────────┘                     │
│                                                                          │
│  ✓ = Ja existe    + = Adicionar                                         │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Ao gerar contrato
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  TABELA: contratos (snapshot completo)                                   │
│  Copiar TODOS os campos de cotacoes para o contrato                     │
│  Isso garante que o documento gerado tenha todos os dados necessarios   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Beneficios

1. **Zero alteracao no OCR** - A IA ja extrai todos os campos necessarios
2. **Dados completos para contratos** - Documentos legais terao todos os campos
3. **Integracao com SGA/Hinova** - Dados de veiculo completos para sincronizacao
4. **Auditoria** - Snapshot completo permite rastrear dados no momento da assinatura
