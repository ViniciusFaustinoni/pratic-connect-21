

# Plano: Corrigir Mapeamento de Dados do OCR e Adicionar Termo Aditivo de Carro Zero

## Resumo do Problema

Analisando o fluxo completo de dados, identifiquei **3 gaps** que fazem campos como RG, Chassi e Renavam ficarem em branco no Termo de Afiliacao:

### Gap 1: Hook `salvarDadosPessoais` nao persiste todos os campos do OCR

**Arquivo:** `src/hooks/useCotacaoContratacao.ts` (linha 342-390)

O hook **SALVA** chassi e renavam, mas **NAO SALVA**:
- `cliente_rg`
- `cliente_rg_orgao`
- `cliente_cnh`
- `cliente_cnh_validade`
- `cliente_cnh_categoria`
- `veiculo_cor`
- `veiculo_combustivel`
- `veiculo_ano_fabricacao`

### Gap 2: Edge Function `contrato-gerar` nao copia campos do veiculo

**Arquivo:** `supabase/functions/contrato-gerar/index.ts` (linhas 380-388)

A funcao copia `veiculo_marca`, `veiculo_modelo`, `veiculo_placa`, `veiculo_valor_fipe`, `veiculo_cor`, mas **NAO COPIA**:
- `veiculo_chassi`
- `veiculo_renavam`

**Prova:** Query no banco mostra cotacao com `veiculo_chassi: 9BRBD48E6E2617010`, mas contrato com `veiculo_chassi: null`.

### Gap 3: Template nao tem Termo Aditivo de Carro Zero

**Arquivo:** `supabase/functions/_shared/termo-afiliacao-template.ts`

O documento original (PDF) possui uma clausula condicional que deve aparecer **apenas quando o veiculo e 0km ou nao tem placa**. Esta secao esta ausente no template atual.

---

## Correcoes a Implementar

### Fase 1: Corrigir Hook `salvarDadosPessoais`

Adicionar persistencia de todos os campos extraidos do OCR:

```typescript
// src/hooks/useCotacaoContratacao.ts (linhas 347-366)
.update({
  // Dados existentes...
  nome_solicitante: dados.nome,
  email_solicitante: dados.email,
  telefone1_solicitante: dados.telefone,
  cliente_cpf: dados.cpf,
  cliente_data_nascimento: dados.data_nascimento,
  cliente_cep: dados.cep,
  cliente_logradouro: dados.logradouro,
  cliente_numero: dados.numero,
  cliente_complemento: dados.complemento,
  cliente_bairro: dados.bairro,
  cliente_cidade: dados.cidade,
  cliente_uf: dados.uf,
  status_contratacao: 'dados_preenchidos',
  
  // NOVOS CAMPOS - Dados de documentos pessoais (RG/CNH)
  cliente_rg: dados.rg || null,
  cliente_rg_orgao: dados.rg_orgao || null,
  cliente_cnh: dados.cnh || null,
  cliente_cnh_validade: dados.cnh_validade || null,
  cliente_cnh_categoria: dados.cnh_categoria || null,
  
  // Dados do veiculo extraidos do CRLV via OCR
  veiculo_chassi: dados.veiculo_chassi || null,
  veiculo_renavam: dados.veiculo_renavam || null,
  veiculo_cor: dados.veiculo_cor || null,
  veiculo_combustivel: dados.veiculo_combustivel || null,
  veiculo_ano_fabricacao: dados.veiculo_ano_fabricacao || null,
})
```

### Fase 2: Corrigir Edge Function `contrato-gerar`

Adicionar copia dos campos faltantes para o snapshot do contrato:

```typescript
// supabase/functions/contrato-gerar/index.ts (linhas 380-388)
// Dados do veiculo (snapshot completo)
veiculo_marca: cotacao.veiculo_marca,
veiculo_modelo: cotacao.veiculo_modelo,
veiculo_ano: cotacao.veiculo_ano,
veiculo_placa: cotacao.veiculo_placa,
veiculo_valor_fipe: cotacao.valor_fipe,
veiculo_cor: cotacao.veiculo_cor,
veiculo_combustivel: cotacao.veiculo_combustivel || null,
veiculo_ano_fabricacao: cotacao.veiculo_ano_fabricacao || cotacao.veiculo_ano || null,

// ADICIONAR - Campos obrigatorios para SGA/Hinova
veiculo_chassi: cotacao.veiculo_chassi || null,
veiculo_renavam: cotacao.veiculo_renavam || null,
```

### Fase 3: Adicionar Termo Aditivo de Veiculo 0km ao Template

Criar secao condicional no template que aparece quando:
- Procedencia do veiculo = "Novo (zero km)" OU
- Placa esta vazia ou e temporaria (comeca com "000")

```typescript
// supabase/functions/_shared/termo-afiliacao-template.ts

const generateSecaoCarroZero = (data: TermoAfiliacaoData): string => {
  // Verifica se e carro zero (sem placa ou procedencia zero km)
  const isCarroZero = 
    !data.veiculo.placa || 
    data.veiculo.placa === '' || 
    data.veiculo.placa.startsWith('000') ||
    data.veiculo.procedencia === 'Novo (zero km)';
  
  if (!isCarroZero) return '';
  
  return `
<div class="section page-break" style="margin-top: 30pt;">
  <h2 class="section-title" style="color: #dc2626;">
    TERMO ADITIVO DE VEICULO 0KM
  </h2>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Clausula Primeira</p>
    <p class="declaracao-texto">
      O presente Termo Aditivo tem por objeto regulamentar a protecao de 
      veiculo zero quilometro (0 km) que ainda nao possua placa no momento 
      da adesao a Associacao.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Clausula Segunda</p>
    <p class="declaracao-texto">
      O associado compromete-se a providenciar o devido emplacamento do veiculo 
      junto aos orgaos de transito competentes, dentro do prazo legal estabelecido 
      pelo CONTRAN e demais legislacoes aplicaveis.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Clausula Terceira</p>
    <p class="declaracao-texto">
      O associado declara, neste ato, estar ciente e de pleno acordo que, caso 
      nao realize o emplacamento no prazo legal, a protecao de roubo e furto sera 
      imediatamente suspensa, nao sendo devida qualquer indenizacao em eventos 
      ocorridos durante o periodo de irregularidade.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Clausula Quarta</p>
    <p class="declaracao-texto">
      A cobertura sera restabelecida automaticamente a partir da apresentacao, 
      pelo associado, da documentacao comprobatoria de emplacamento do veiculo 
      junto a Associacao.
    </p>
  </div>
  
  <div class="declaracao">
    <p class="declaracao-titulo">Clausula Quinta</p>
    <p class="declaracao-texto">
      A responsabilidade pelo emplacamento do veiculo zero quilometro e exclusiva 
      do associado, nao cabendo a Associacao qualquer obrigacao ou interferencia 
      junto aos orgaos de transito.
    </p>
  </div>
</div>
`;
};
```

Modificar funcao principal para incluir a secao:

```typescript
export function generateTermoAfiliacao(data: TermoAfiliacaoData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>...</head>
<body>
  <div class="page">
    ${generateHeader(data)}
    ${generateSecao1(data)}
    ${generateSecao2(data)}
    ${generateSecaoCarroZero(data)}  // <- NOVO: Condicional
    ${generateSecao3(data)}
    ...
  </div>
</body>
</html>
  `;
}
```

---

## Arquivos a Modificar

| Arquivo | Acao | Impacto |
|---------|------|---------|
| `src/hooks/useCotacaoContratacao.ts` | Adicionar campos RG/CNH/veiculo na persistencia | Dados do OCR serao salvos na cotacao |
| `supabase/functions/contrato-gerar/index.ts` | Adicionar veiculo_chassi e veiculo_renavam | Snapshot do contrato tera todos os dados |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | Adicionar secao condicional Carro Zero | Documento completo para veiculos 0km |

---

## Fluxo de Dados Corrigido

```text
CNH/CRLV  →  OCR Edge Function  →  handleOcrDataExtracted()
                                         ↓
                               DadosExtraidos (estado local)
                                         ↓
                               handleSubmit() → onSubmit(dados)
                                         ↓
                               salvarDadosPessoais() [CORRIGIR]
                                         ↓
                               Tabela COTACOES
                               (todos os campos preenchidos)
                                         ↓
                               contrato-gerar [CORRIGIR]
                                         ↓
                               Tabela CONTRATOS
                               (snapshot completo)
                                         ↓
                               autentique-create
                                         ↓
                               Termo de Afiliacao PDF
                               (todos os campos exibidos)
```

---

## Beneficios

1. **RG completo** - Exibido no termo com orgao emissor
2. **Chassi e Renavam** - Campos criticos para SGA Hinova e documentacao legal
3. **Dados do veiculo** - Combustivel, cor, ano fabricacao preenchidos
4. **Termo Aditivo 0km** - Protecao juridica para veiculos novos

