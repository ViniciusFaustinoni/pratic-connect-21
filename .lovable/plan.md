

## Plano: Carregar Dados da Cotação ao Editar

### Problema Identificado

O componente `CotacaoFormDialog` recebe a prop `cotacaoParaEditar` quando o usuário quer editar uma cotação existente, mas **não existe um `useEffect` para carregar esses dados no formulário**.

Existe apenas:
- `useEffect` para resetar formulário quando abre sem leadId (linhas 293-325)
- `useEffect` para preencher dados do lead (linhas 526-563)
- `useEffect` para preencher dados de duplicação `cotacaoBase` (linhas 565-632)

O `cotacaoParaEditar` é definido mas **nunca utilizado para popular o formulário**.

---

### Análise do Fluxo Atual

| Cenário | Prop | Dados Carregados |
|---------|------|------------------|
| Nova cotação | `leadId` | Dados do lead |
| Duplicar cotação | `cotacaoBase` | Dados da cotação original |
| **Editar cotação** | `cotacaoParaEditar` | **Nada - problema!** |

---

### Conflito Adicional

O `useEffect` de reset (linhas 293-325) é executado quando `open && !leadId`, o que **limpa o formulário mesmo em modo de edição** se não houver leadId:

```typescript
useEffect(() => {
  if (open && !leadId) {
    // Resetar todos os estados para começar limpo
    form.reset({...});
    // ... limpa todos os states
  }
}, [open, leadId, form]);
```

Isso significa que mesmo que adicionássemos um `useEffect` para `cotacaoParaEditar`, ele seria sobrescrito pelo reset se a cotação não tiver `lead_id`.

---

### Solução Proposta

#### 1. Modificar o useEffect de reset para excluir modo edição

**Arquivo:** `src/components/cotacoes/CotacaoFormDialog.tsx`

Alterar a condição do reset para não executar quando houver `cotacaoParaEditar` ou `cotacaoBase`:

```typescript
// De:
useEffect(() => {
  if (open && !leadId) {
    // Resetar...
  }
}, [open, leadId, form]);

// Para:
useEffect(() => {
  if (open && !leadId && !cotacaoParaEditar && !cotacaoBase) {
    // Resetar...
  }
}, [open, leadId, cotacaoParaEditar, cotacaoBase, form]);
```

#### 2. Criar useEffect para carregar dados de edição

Adicionar novo `useEffect` similar ao de `cotacaoBase`, mas para `cotacaoParaEditar`:

```typescript
// Efeito para preencher o formulário com dados da cotação para edição
useEffect(() => {
  if (cotacaoParaEditar && open) {
    // Preencher dados do formulário
    if (cotacaoParaEditar.valor_fipe) {
      form.setValue('valor_fipe', cotacaoParaEditar.valor_fipe);
    }
    if (cotacaoParaEditar.valor_adicional) {
      form.setValue('valor_adicional', cotacaoParaEditar.valor_adicional);
    }
    if (cotacaoParaEditar.valor_adesao) {
      form.setValue('valor_adesao', cotacaoParaEditar.valor_adesao);
    }
    if (cotacaoParaEditar.validade_dias) {
      form.setValue('validade_dias', cotacaoParaEditar.validade_dias);
    }
    if (cotacaoParaEditar.lead_id) {
      form.setValue('lead_id', cotacaoParaEditar.lead_id);
    }
    if (cotacaoParaEditar.plano_id) {
      form.setValue('plano_id', cotacaoParaEditar.plano_id);
    }
    
    // Preencher dados do solicitante
    setNomeAssociado(cotacaoParaEditar.nome_solicitante || '');
    setTelefoneAssociado(cotacaoParaEditar.telefone1_solicitante || '');
    setEmailAssociado(cotacaoParaEditar.email_solicitante || '');
    
    // Preencher placa
    if (cotacaoParaEditar.veiculo_placa) {
      setPlaca(cotacaoParaEditar.veiculo_placa);
    }
    
    // Preencher categoria
    if (cotacaoParaEditar.categoria) {
      setCategoria(cotacaoParaEditar.categoria);
    }
    
    // Preencher região
    if (cotacaoParaEditar.regiao) {
      setRegiaoSelecionada(cotacaoParaEditar.regiao);
    }
    
    // Preencher dados do veículo encontrado
    if (cotacaoParaEditar.veiculo_marca && cotacaoParaEditar.veiculo_modelo) {
      setVeiculoEncontrado({
        success: true,
        vehicleData: {
          marca: cotacaoParaEditar.veiculo_marca,
          modelo: cotacaoParaEditar.veiculo_modelo,
          marca_modelo: `${cotacaoParaEditar.veiculo_marca} ${cotacaoParaEditar.veiculo_modelo}`,
          ano: cotacaoParaEditar.veiculo_ano ? String(cotacaoParaEditar.veiculo_ano) : '',
          placa: cotacaoParaEditar.veiculo_placa || '',
          cor: '',
          chassi: '',
          municipio: '',
          uf: '',
          combustivel: ''
        },
        fipeData: cotacaoParaEditar.valor_fipe ? {
          valor: cotacaoParaEditar.valor_fipe,
          codigo: cotacaoParaEditar.codigo_fipe,
          mesReferencia: null
        } : null
      });
    }
    
    // Preencher planos selecionados se existirem
    if (cotacaoParaEditar.dados_extras?.planos_comparacao?.length) {
      // Os planos serão selecionados após o hook usePlanosCotacao calcular
    }
  }
}, [cotacaoParaEditar, open, form]);
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Modificar useEffect de reset e adicionar useEffect para `cotacaoParaEditar` |

---

### Resumo das Alterações

1. **Linha ~294**: Alterar condição do `useEffect` de reset para incluir `!cotacaoParaEditar && !cotacaoBase`

2. **Após linha 632**: Adicionar novo `useEffect` para carregar dados de `cotacaoParaEditar` (similar ao existente para `cotacaoBase`)

---

### Fluxo Corrigido

```text
Usuário clica em "Editar Cotação"
         │
         ▼
CotacaoFormDialog abre com cotacaoParaEditar
         │
         ▼
useEffect de reset NÃO executa (cotacaoParaEditar existe)
         │
         ▼
useEffect de cotacaoParaEditar executa
         │
         ▼
Formulário preenchido com:
  • Nome, telefone, email do solicitante
  • Dados do veículo (marca, modelo, ano, placa)
  • Valor FIPE
  • Região e categoria
  • Plano selecionado
  • Valor de adesão e adicional
```

---

### Resultado Esperado

Após a implementação:
- Ao abrir o modal de edição, todos os campos serão preenchidos automaticamente com os dados da cotação existente
- O usuário poderá modificar apenas os campos desejados
- Ao salvar, a cotação será atualizada (não criada nova)

