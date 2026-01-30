

# Plano: Implementar Funcionalidades Completas na Pagina Produto Detalhe

## Problema Identificado

A pagina de detalhes do produto (`/diretoria/produtos/{id}`) possui varios botoes sem funcionalidade:

| Botao | Localizacao | Status |
|-------|-------------|--------|
| "Adicionar Cobertura" | Tab Coberturas | Sem onClick - NAO FUNCIONA |
| "Editar" cobertura | Tab Coberturas | Sem onClick - NAO FUNCIONA |
| "Excluir" cobertura | Tab Coberturas | Sem onClick - NAO FUNCIONA |
| "Nova Faixa" | Tab Precos | Sem onClick - NAO FUNCIONA |
| "Editar" preco | Tab Precos | Sem onClick - NAO FUNCIONA |
| "Excluir" preco | Tab Precos | Sem onClick - NAO FUNCIONA |
| "Editar" (header) | Header | Sem onClick - NAO FUNCIONA |

**Os modais ja existem e estao funcionais:**
- `VincularCoberturaModal` - Pronto para vincular coberturas
- `FaixaPrecoModal` - Pronto para criar/editar faixas de preco
- `ProdutoFormModal` - Pronto para editar produto

## Solucao Proposta

### Fase 1: Importar Componentes Existentes

**Arquivo:** `src/pages/diretoria/ProdutoDetalhe.tsx`

Adicionar imports dos modais que ja existem:
- `VincularCoberturaModal` - para vincular novas coberturas
- `FaixaPrecoModal` - para criar/editar faixas de preco
- `ProdutoFormModal` - para editar dados do produto

### Fase 2: Criar Estados para Controlar Modais

Adicionar estados para controlar abertura/fechamento dos modais:

```typescript
const [modalCoberturaOpen, setModalCoberturaOpen] = useState(false);
const [modalFaixaOpen, setModalFaixaOpen] = useState(false);
const [modalProdutoOpen, setModalProdutoOpen] = useState(false);
const [faixaEdit, setFaixaEdit] = useState<TabelaPreco | null>(null);
const [coberturaEdit, setCoberturaEdit] = useState<PlanoCoberturas | null>(null);
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [itemToDelete, setItemToDelete] = useState<{tipo: 'cobertura' | 'preco', id: string} | null>(null);
```

### Fase 3: Criar Modal de Edicao de Cobertura Vinculada

**Novo arquivo:** `src/components/diretoria/EditarCoberturaVinculadaModal.tsx`

O modal `VincularCoberturaModal` cria novas vinculacoes. Precisamos de um modal para EDITAR vinculacoes existentes com os campos:
- Percentual de cobertura
- Valor limite
- Franquia percentual
- Franquia valor
- Carencia dias
- Obrigatoria

### Fase 4: Adicionar Mutations para Exclusao

Criar mutations para:
- Excluir cobertura vinculada (`planos_coberturas`)
- Excluir faixa de preco (`tabelas_preco`)

```typescript
const removerCobertura = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('planos_coberturas')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success('Cobertura removida!');
    queryClient.invalidateQueries({ queryKey: ['plano-coberturas', id] });
  }
});

const removerPreco = useMutation({
  mutationFn: async (precoId: string) => {
    const { error } = await supabase
      .from('tabelas_preco')
      .delete()
      .eq('id', precoId);
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success('Faixa de preco removida!');
    queryClient.invalidateQueries({ queryKey: ['plano-precos', id] });
  }
});
```

### Fase 5: Conectar Botoes aos Handlers

**Tab Coberturas:**
- Botao "Adicionar Cobertura" -> abre `VincularCoberturaModal`
- Botao "Editar" -> abre `EditarCoberturaVinculadaModal` com dados
- Botao "Excluir" -> abre dialog de confirmacao -> chama `removerCobertura`

**Tab Precos:**
- Botao "Nova Faixa" -> abre `FaixaPrecoModal` sem faixa
- Botao "Editar" -> abre `FaixaPrecoModal` com faixa para edicao
- Botao "Excluir" -> abre dialog de confirmacao -> chama `removerPreco`

**Header:**
- Botao "Editar" -> abre `ProdutoFormModal` com dados do plano

### Fase 6: Adicionar Dialog de Confirmacao de Exclusao

Implementar `AlertDialog` para confirmacao antes de excluir itens.

### Fase 7: Invalidar Queries Corretas

Garantir que apos cada operacao as queries sejam invalidadas:
- `['plano-coberturas', id]` - apos adicionar/editar/remover cobertura
- `['plano-precos', id]` - apos adicionar/editar/remover preco
- `['plano', id]` - apos editar produto

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/diretoria/EditarCoberturaVinculadaModal.tsx` | Modal para editar cobertura ja vinculada |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/diretoria/ProdutoDetalhe.tsx` | Adicionar imports, estados, handlers e conectar botoes |
| `src/components/diretoria/index.ts` | Exportar novo modal |

---

## Interconexoes com Outras Areas

A implementacao utiliza:

1. **Tabela `planos`** - Dados basicos do produto
2. **Tabela `coberturas`** - Catalogo de coberturas disponiveis
3. **Tabela `planos_coberturas`** - Vinculacao N:N entre planos e coberturas
4. **Tabela `tabelas_preco`** - Faixas de preco por plano
5. **Modais existentes:**
   - `VincularCoberturaModal` - ja funcional
   - `FaixaPrecoModal` - ja funcional
   - `ProdutoFormModal` - ja funcional

---

## Resultado Final

Apos implementacao:

| Botao | Funcionalidade |
|-------|----------------|
| "Adicionar Cobertura" | Abre modal para vincular cobertura do catalogo |
| "Editar" cobertura | Abre modal para editar % cobertura, franquia, carencia |
| "Excluir" cobertura | Confirma e remove vinculacao |
| "Nova Faixa" | Abre modal para criar faixa de preco |
| "Editar" preco | Abre modal para editar faixa existente |
| "Excluir" preco | Confirma e remove faixa |
| "Editar" (header) | Abre modal para editar dados do produto |

---

## Estimativa de Tempo

| Tarefa | Tempo |
|--------|-------|
| Criar EditarCoberturaVinculadaModal | 30 min |
| Modificar ProdutoDetalhe.tsx | 45 min |
| Testar funcionalidades | 15 min |
| **Total** | **~1.5 horas** |

