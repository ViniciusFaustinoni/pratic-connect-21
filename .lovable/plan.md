
# Correção: Persistência de CHASSI e RENAVAM do CRLV

## Diagnóstico Confirmado

O OCR do CRLV extrai corretamente CHASSI e RENAVAM, mas esses dados **não estão sendo persistidos** porque:

1. A tabela `cotacoes` não tem os campos `veiculo_chassi` e `veiculo_renavam`
2. A edge function `contrato-gerar` cria o veículo sem esses campos
3. O `UnifiedDocumentUploader` só atualiza veículo se tiver `veiculoId` (que não existe nesse momento do fluxo)

## Arquitetura da Solução

```
FLUXO ATUAL (quebrado):
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Upload     │    │  OCR        │    │  Estado     │    │  contrato-  │
│  CRLV       │───▶│  Extrai     │───▶│  Local      │    │  gerar      │
│             │    │  Dados      │    │  (perdido)  │    │  (sem dados)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

FLUXO CORRIGIDO:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Upload     │    │  OCR        │    │  Salvar na  │    │  contrato-  │
│  CRLV       │───▶│  Extrai     │───▶│  Cotação    │───▶│  gerar      │
│             │    │  Dados      │    │  (banco)    │    │  (com dados)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │  Veículo    │
                                     │  criado com │
                                     │  chassi e   │
                                     │  renavam    │
                                     └─────────────┘
```

---

## Etapa 1: Adicionar Campos na Tabela `cotacoes`

Criar migration para adicionar os campos necessários.

**SQL:**
```sql
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS veiculo_chassi VARCHAR(17),
ADD COLUMN IF NOT EXISTS veiculo_renavam VARCHAR(11);

COMMENT ON COLUMN cotacoes.veiculo_chassi IS 'Chassi extraído do CRLV via OCR';
COMMENT ON COLUMN cotacoes.veiculo_renavam IS 'Renavam extraído do CRLV via OCR';
```

---

## Etapa 2: Persistir Dados do OCR na Cotação

**Arquivo:** `src/hooks/useCotacaoContratacao.ts`

Modificar a mutation `salvarDadosPessoais` para incluir os dados do veículo:

```typescript
const salvarDadosPessoais = useMutation({
  mutationFn: async (dados: DadosPessoaisForm) => {
    // ... código existente ...
    
    const { error } = await publicSupabase
      .from('cotacoes')
      .update({
        // ... campos existentes ...
        
        // NOVO: Dados do veículo extraídos do CRLV
        veiculo_chassi: dados.veiculo_chassi || null,
        veiculo_renavam: dados.veiculo_renavam || null,
      })
      .eq('id', cotacao.id);
```

**Arquivo:** `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

Modificar o `handleSubmit` para incluir os dados do veículo:

```typescript
const handleSubmit = () => {
  const dados: DadosPessoaisForm = {
    // ... campos existentes ...
    
    // NOVO: Incluir dados do veículo
    veiculo_chassi: dadosExtraidos.veiculo_chassi,
    veiculo_renavam: dadosExtraidos.veiculo_renavam,
  };
  onSubmit(dados);
};
```

---

## Etapa 3: Usar Dados na Criação do Veículo

**Arquivo:** `supabase/functions/contrato-gerar/index.ts`

Modificar a criação do veículo para incluir chassi e renavam:

```typescript
// Linha ~318 - Criar VEÍCULO vinculado ao novo associado
const { data: novoVeiculo, error: veiculoError } = await supabase
  .from('veiculos')
  .insert({
    associado_id: associadoId,
    placa: cotacao.veiculo_placa,
    marca: cotacao.veiculo_marca,
    modelo: cotacao.veiculo_modelo,
    ano_fabricacao: cotacao.veiculo_ano,
    ano_modelo: cotacao.veiculo_ano,
    cor: cotacao.veiculo_cor || null,
    valor_fipe: cotacao.valor_fipe || null,
    codigo_fipe: cotacao.codigo_fipe || null,
    // NOVO: Dados obrigatórios para SGA Hinova
    chassi: cotacao.veiculo_chassi || null,
    renavam: cotacao.veiculo_renavam || null,
    status: 'em_analise',
    cobertura_roubo_furto: false,
    cobertura_total: false,
  })
```

Aplicar a mesma correção nas outras 3 inserções de veículo na função (linhas ~200, ~253, ~318).

---

## Etapa 4: Atualizar Tipo do Formulário

**Arquivo:** `src/types/cotacaoPublica.ts` ou tipo inline

Adicionar os campos ao tipo `DadosPessoaisForm`:

```typescript
interface DadosPessoaisForm {
  // ... campos existentes ...
  
  // Dados do veículo (CRLV)
  veiculo_chassi?: string;
  veiculo_renavam?: string;
}
```

---

## Resumo das Alterações

| Arquivo | Modificação |
|---------|-------------|
| `supabase/migrations/xxx.sql` | Adicionar colunas `veiculo_chassi` e `veiculo_renavam` na tabela `cotacoes` |
| `src/hooks/useCotacaoContratacao.ts` | Persistir dados do veículo ao salvar dados pessoais |
| `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` | Incluir dados do veículo no submit |
| `supabase/functions/contrato-gerar/index.ts` | Usar `chassi` e `renavam` da cotação ao criar veículo |
| `src/types/cotacaoPublica.ts` | Adicionar campos ao tipo (se aplicável) |

---

## Fluxo de Dados Corrigido

```
1. Upload CRLV
      │
      ▼
2. OCR extrai: chassi, renavam, placa
      │
      ▼
3. Frontend armazena em dadosExtraidos
      │
      ▼
4. Usuário clica "Avançar"
      │
      ▼
5. salvarDadosPessoais persiste na cotação:
   - veiculo_chassi
   - veiculo_renavam
      │
      ▼
6. contrato-gerar lê da cotação
      │
      ▼
7. Veículo criado com chassi e renavam
      │
      ▼
8. SGA Sync funciona corretamente ✓
```

---

## Caso Imediato do Associado MARCUS VINICIUS

Após implementar as correções, será necessário atualizar manualmente o veículo existente:

```sql
UPDATE veiculos 
SET 
  chassi = 'EXTRAIR_DO_CRLV',
  renavam = 'EXTRAIR_DO_CRLV',
  status_sga = 'pendente'
WHERE id = 'f6c176c6-15ef-4868-9178-573d0d4961a5';
```

Depois, clicar em "Enviar para SGA" novamente para reprocessar.
