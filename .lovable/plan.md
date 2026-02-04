

# Plano: Implementar Novo Template do Termo de Afiliacao (Autentique)

## Resumo Executivo

Substituir o template atual do contrato de adesao por um novo **Termo de Afiliacao ao PSM** completo, seguindo exatamente a estrutura e variaveis especificadas, com todas as 9 secoes obrigatorias, termos LGPD e formatacao padrao A4.

---

## Analise do Estado Atual

### O que existe hoje:

**Edge Functions:**
- `autentique-create` (1031 linhas) - Template hardcoded com 5 secoes basicas
- `autentique-create-by-token` (804 linhas) - Template hardcoded ainda mais simples

**Problemas identificados:**
1. Templates hardcoded duplicados nas duas edge functions
2. Faltam campos importantes: RG, orgao emissor, CNH, estado civil, profissao
3. Faltam campos do veiculo: chassi, renavam, combustivel, categoria, tipo uso
4. Nao tem as 9 declaracoes obrigatorias
5. Nao tem termos LGPD
6. Nao tem numero do termo formatado (AAAA-NNNNNN)
7. Nao tem dados da empresa ABP formatados
8. Formatacao visual diferente do especificado

### Campos ja disponiveis no banco:

**Tabela `contratos` (snapshot):**
- Cliente: nome, cpf, email, telefone, endereco, cep, cidade, uf
- Cliente (novos via migracao anterior): rg, rg_orgao, cnh, cnh_validade, cnh_categoria, data_nascimento, logradouro, numero, bairro, complemento
- Veiculo: placa, marca, modelo, ano, cor, chassi, renavam, valor_fipe, combustivel, ano_fabricacao

**Tabela `cotacoes`:**
- Campos similares + codigo_fipe, tipo_vistoria, dia_vencimento

**Tabela `planos`:**
- coberturas (array), cota_participacao, cota_minima, valor_adesao, nome, tipo_uso, linha

**Tabela `configuracoes`:**
- empresa_nome, empresa_cnpj, empresa_telefone, empresa_email, empresa_endereco

### Campos que ainda precisam ser adicionados:

| Campo | Tabela | Tipo |
|-------|--------|------|
| cliente_estado_civil | cotacoes, contratos | varchar(30) |
| cliente_profissao | cotacoes, contratos | varchar(100) |
| cliente_telefone_secundario | cotacoes, contratos | varchar(20) |
| veiculo_categoria | cotacoes, contratos | varchar(50) |
| veiculo_tipo_uso | cotacoes, contratos | varchar(50) |
| veiculo_alienado | cotacoes, contratos | boolean |
| veiculo_financeira | cotacoes, contratos | varchar(100) |
| veiculo_procedencia | cotacoes, contratos | varchar(50) |

---

## Plano de Implementacao

### Fase 1: Migracao de Banco de Dados

Adicionar campos faltantes para o termo de afiliacao completo.

```sql
-- Cotacoes: campos adicionais do cliente
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_estado_civil VARCHAR(30);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_profissao VARCHAR(100);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_telefone_secundario VARCHAR(20);

-- Cotacoes: campos adicionais do veiculo
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_categoria VARCHAR(50);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_tipo_uso VARCHAR(50);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_alienado BOOLEAN DEFAULT FALSE;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_financeira VARCHAR(100);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_procedencia VARCHAR(50);

-- Contratos: snapshot completo
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_estado_civil VARCHAR(30);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_profissao VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_telefone_secundario VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_categoria VARCHAR(50);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_tipo_uso VARCHAR(50);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_alienado BOOLEAN DEFAULT FALSE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_financeira VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_procedencia VARCHAR(50);

-- Configuracoes: dados da ABP
INSERT INTO configuracoes (chave, valor, categoria, descricao, editavel)
VALUES 
  ('empresa_razao_social', 'Associacao de Beneficios PraticCar', 'empresa', 'Razao social', true),
  ('empresa_logradouro', 'Av. das Americas', 'empresa', 'Logradouro', true),
  ('empresa_numero', '19.005', 'empresa', 'Numero', true),
  ('empresa_bairro', 'Recreio dos Bandeirantes', 'empresa', 'Bairro', true),
  ('empresa_cidade', 'Rio de Janeiro', 'empresa', 'Cidade', true),
  ('empresa_uf', 'RJ', 'empresa', 'Estado', true),
  ('empresa_cep', '22790-703', 'empresa', 'CEP', true)
ON CONFLICT (chave) DO NOTHING;
```

### Fase 2: Criar Template Unificado do Termo de Afiliacao

Criar um novo arquivo modular que sera importado por ambas as edge functions.

**Estrutura do template:**

```
supabase/functions/_shared/
  termo-afiliacao-template.ts     <- Template HTML completo
  termo-afiliacao-data.ts         <- Mapeamento de dados
  termo-afiliacao-utils.ts        <- Funcoes auxiliares
```

**Conteudo principal do template:**

O HTML sera organizado em 9 secoes conforme especificado:

1. **CABECALHO** - Logo ABP, dados da empresa, numero do termo
2. **QUALIFICACAO DO ASSOCIADO** - Todos os 16 campos pessoais
3. **VEICULO PROTEGIDO** - Todos os 14 campos do veiculo
4. **PLANO E COBERTURAS** - Lista dinamica de coberturas com checkboxes
5. **VALORES E PAGAMENTO** - Tabela de resumo financeiro
6. **DECLARACOES DO ASSOCIADO** - 9 declaracoes obrigatorias
7. **PROTECAO DE DADOS (LGPD)** - 4 itens de consentimento
8. **DISPOSICOES FINAIS** - 5 clausulas finais
9. **ASSINATURA** - Campo de assinatura formatado

### Fase 3: Atualizar Edge Functions

**`autentique-create/index.ts`:**
- Importar template do `_shared`
- Usar dados do snapshot do contrato + cotacao + plano
- Buscar configuracoes da empresa dinamicamente

**`autentique-create-by-token/index.ts`:**
- Importar mesmo template do `_shared`
- Eliminar codigo duplicado
- Manter apenas a logica de validacao por token

### Fase 4: Atualizar Formulario da Cotacao Publica

Adicionar campos obrigatorios que nao sao extraidos via OCR:
- Estado Civil (select)
- Profissao (input)
- Telefone Secundario (input opcional)
- Tipo de Uso do Veiculo (select: Particular, APP, Comercial, Taxi)
- Procedencia do Veiculo (select: Novo, Usado de particular, Leilao, etc)
- Alienacao (checkbox + input para financeira)

**Arquivo:** `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

### Fase 5: Atualizar Geracao de Contrato

Garantir que todos os campos sejam copiados da cotacao para o contrato.

**Arquivo:** `supabase/functions/contrato-gerar/index.ts`

---

## Estrutura Detalhada do Template HTML

### CSS Padronizado

```css
/* Especificacoes conforme documento */
body {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.15;
  color: #333;
  margin: 0;
  padding: 20mm;
}

h1.titulo-principal { font-size: 16pt; font-weight: bold; text-align: center; }
h2.titulo-secao { font-size: 12pt; font-weight: bold; margin-top: 12pt; }

.tabela-valores {
  width: 100%;
  border: 1px solid #ccc;
  border-collapse: collapse;
}
.tabela-valores td { padding: 8pt; border: 1px solid #ccc; }

.checkbox { font-family: monospace; }
.assinatura { border-top: 1px solid #333; width: 300px; margin-top: 60px; }
```

### Secao de Coberturas (Dinamica)

```html
<div class="section">
  <h2>4. PLANO CONTRATADO E COBERTURAS</h2>
  <p><strong>Plano:</strong> {NOME_PLANO}</p>
  <p><strong>Tipo:</strong> {TIPO_PLANO}</p>
  
  <h3>COBERTURAS INCLUIDAS:</h3>
  <!-- Loop pelas coberturas do plano -->
  <p class="checkbox">[X] Roubo e Furto</p>
  <p class="checkbox">[X] Colisao</p>
  ...
  
  <p><strong>Rastreador Veicular:</strong> Obrigatorio (instalacao por tecnico credenciado)</p>
</div>
```

### Tabela de Valores

```html
<div class="section">
  <h2>5. VALORES E CONDICOES DE PAGAMENTO</h2>
  <table class="tabela-valores">
    <tr><td>Valor FIPE do Veiculo:</td><td>R$ {VALOR_FIPE}</td></tr>
    <tr><td>Taxa de Filiacao (pagamento unico):</td><td>R$ {TAXA_FILIACAO}</td></tr>
    <tr><td>Quota Mensal Estimada:</td><td>R$ {QUOTA_MENSAL}</td></tr>
    <tr><td>Cota de Participacao (10%):</td><td>R$ {COTA_PARTICIPACAO}</td></tr>
    <tr><td>Cota Minima:</td><td>R$ 3.000,00</td></tr>
    <tr><td>Dia de Vencimento:</td><td>Todo dia {DIA_VENC}</td></tr>
    <tr><td>Forma de Pagamento:</td><td>{FORMA_PAGAMENTO}</td></tr>
    <tr><td>Primeira Mensalidade em:</td><td>{DATA_PRIMEIRA_MENS}</td></tr>
  </table>
  
  <p><small>A quota mensal e pos-paga e calculada por rateio entre os associados, 
  podendo variar mensalmente conforme os custos do periodo.</small></p>
</div>
```

### 9 Declaracoes (Texto Fixo)

Serao incluidas literalmente como especificado, apenas substituindo as variaveis `{NOME_COMPLETO}`, `{CPF}`, `{VALOR_FIPE}` e `{PROCEDENCIA_VEICULO}`.

### Termos LGPD (Texto Fixo)

4 paragrafos completos conforme especificado.

---

## Mapeamento de Variaveis

| Variavel Template | Origem no Sistema |
|-------------------|-------------------|
| {NUMERO_TERMO} | `contrato.numero` (formato: AAAA-NNNNNN) |
| {NOME_COMPLETO} | `contrato.cliente_nome` |
| {CPF} | `contrato.cliente_cpf` (formatado) |
| {RG} | `contrato.cliente_rg` |
| {ORGAO_EMISSOR} | `contrato.cliente_rg_orgao` |
| {DATA_NASCIMENTO} | `contrato.cliente_data_nascimento` (DD/MM/AAAA) |
| {ESTADO_CIVIL} | `contrato.cliente_estado_civil` |
| {PROFISSAO} | `contrato.cliente_profissao` |
| {EMAIL} | `contrato.cliente_email` |
| {TELEFONE} | `contrato.cliente_telefone` (formatado) |
| {TELEFONE_2} | `contrato.cliente_telefone_secundario` |
| {LOGRADOURO} | `contrato.cliente_logradouro` |
| {NUMERO} | `contrato.cliente_numero` |
| {COMPLEMENTO} | `contrato.cliente_complemento` |
| {BAIRRO} | `contrato.cliente_bairro` |
| {CIDADE} | `contrato.cliente_cidade` |
| {UF} | `contrato.cliente_uf` |
| {CEP} | `contrato.cliente_cep` (formatado) |
| {PLACA} | `contrato.veiculo_placa` |
| {CHASSI} | `contrato.veiculo_chassi` |
| {RENAVAM} | `contrato.veiculo_renavam` |
| {MARCA} | `contrato.veiculo_marca` |
| {MODELO} | `contrato.veiculo_modelo` |
| {ANO_FAB} | `contrato.veiculo_ano_fabricacao` |
| {ANO_MOD} | `contrato.veiculo_ano` |
| {COR} | `contrato.veiculo_cor` |
| {COMBUSTIVEL} | `contrato.veiculo_combustivel` |
| {CATEGORIA} | `contrato.veiculo_categoria` |
| {TIPO_USO} | `contrato.veiculo_tipo_uso` |
| {CODIGO_FIPE} | `cotacao.codigo_fipe` |
| {VALOR_FIPE} | `contrato.veiculo_valor_fipe` (formatado) |
| {TEM_ALIENACAO} | `contrato.veiculo_alienado` ? "Sim" : "Nao" |
| {NOME_FINANCEIRA} | `contrato.veiculo_financeira` |
| {NOME_PLANO} | `plano.nome` |
| {TIPO_PLANO} | `plano.linha` |
| {LISTA_COBERTURAS} | Loop em `plano.coberturas[]` |
| {TAXA_FILIACAO} | `contrato.valor_adesao` |
| {QUOTA_MENSAL} | `contrato.valor_mensal` |
| {COTA_PARTICIPACAO} | 10% do valor FIPE |
| {DIA_VENC} | `contrato.dia_vencimento` |
| {FORMA_PAGAMENTO} | "Boleto Bancario" (default) |
| {DATA_PRIMEIRA_MENS} | Calculado com base no dia_vencimento |
| {PROCEDENCIA_VEICULO} | `contrato.veiculo_procedencia` |
| {LOCAL_ASSINATURA} | `contrato.cliente_cidade`/`contrato.cliente_uf` |
| {DATA_ASSINATURA} | Data atual por extenso |

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| **Migracao SQL** | Adicionar campos faltantes |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | CRIAR - Template HTML completo |
| `supabase/functions/_shared/termo-afiliacao-data.ts` | CRIAR - Mapeamento de dados |
| `supabase/functions/autentique-create/index.ts` | Refatorar para usar template compartilhado |
| `supabase/functions/autentique-create-by-token/index.ts` | Refatorar para usar template compartilhado |
| `supabase/functions/contrato-gerar/index.ts` | Copiar novos campos |
| `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` | Adicionar campos no formulario |
| `src/components/cotacao-publica/FormularioDadosPessoais.tsx` | Schema + inputs |
| `src/hooks/useCotacaoPublica.ts` | Persistir novos campos |

---

## Beneficios

1. **Documento Completo** - Todas as 9 secoes obrigatorias + LGPD
2. **Template Unificado** - Uma unica fonte de verdade
3. **Dados Dinamicos** - Coberturas e valores do plano real
4. **Conformidade Legal** - Termos corretos para associacao de socorro mutuo
5. **Manutenibilidade** - Template modular e facil de editar
6. **Rastreabilidade** - Todos os dados vem do snapshot do contrato

---

## Estimativa

- **Fase 1 (Migracao):** Simples
- **Fase 2 (Template):** Mais complexa - criar HTML de 3+ paginas
- **Fase 3 (Edge Functions):** Refatoracao moderada
- **Fase 4 (Formulario):** Adicionar 4-5 campos extras
- **Fase 5 (Contrato):** Ajustes menores

