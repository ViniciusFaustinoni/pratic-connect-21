
## PLANO: ESTENDER TYPES, CRIAR HOOKS E REFORMAR COMISSOESCONFIG

### 1. ANÁLISE DA SITUAÇÃO ATUAL

✅ **Estrutura Existente:**
- `src/types/comissoes.ts`: Contém 8 interfaces (ComissaoConfig, Comissao, ComissaoPagamento, ComissaoResumo, TipoComissao)
- `src/hooks/useComissoesConfig.ts`: Hook CRUD para `comissoes_config` (tabela legada)
- `src/hooks/useComissoes.ts`: Hook para dashboard de comissões (gerencial)
- `src/hooks/useMinhasComissoes.ts`: Hook para visão vendedor
- `src/pages/vendas/ComissoesConfig.tsx`: Página atual com CRUD simples (apenas comissoes_config)
- `src/pages/vendas/Comissoes.tsx`: Dashboard gerencial funcionando
- `src/pages/vendas/MinhasComissoes.tsx`: Página vendedor funcionando
- Rota `/vendas/comissoes/config` JÁ EXISTE

⚠️ **Incompatibilidade Detectada:**
O arquivo `src/types/comissoes.ts` JÁ tem `TipoComissao` definido (linha 24), e o usuário pede para adicionar novamente. Isso causará conflito de definição.

### 2. IMPLEMENTAÇÃO ESTRUTURADA

#### **PASSO 1: Estender src/types/comissoes.ts**

**Ação**: Adicionar os novos tipos ao FINAL do arquivo, EVITANDO duplicação.

O `TipoComissao` já existe na linha 24 com exatamente as mesmas opções que o usuário pediu. Então:
- ✅ NÃO duplicar `TipoComissao`
- ✅ ADICIONAR os 10 novos interfaces (FaixaAdesao, FaixaRecorrente, FaixaProducao, etc.)
- ✅ ADICIONAR os labels (TIPO_COMISSAO_LABELS, TIPO_DEDUCAO_LABELS)

**Padrão de tipo a seguir:**
```typescript
export interface FaixaAdesao {
  id: string;
  tipo_consultor: 'interno' | 'externo';
  // ... campos específicos com tipos validados
  created_at: string;
  updated_at: string;
}
```

#### **PASSO 2: Criar src/hooks/useComissoesFaixas.ts**

**Estrutura do hook:**
- **Queries** (5): useQuery para cada tabela de faixas (adesao, recorrente, producao, crescimento, classificacao)
- **Parametros**: useQuery para comissoes_parametros
- **Mutations genéricas**:
  - `addFaixa(tabela, dados)`: INSERT em qualquer tabela
  - `updateFaixa(tabela, id, dados)`: UPDATE em qualquer tabela
  - `deleteFaixa(tabela, id)`: DELETE em qualquer tabela
  - `updateParametro(chave, valor)`: UPDATE em comissoes_parametros
- **Estados derivados**: `isLoading` (qualquer query em loading)

**Padrão a seguir:**
- Usar mesmo padrão que `useComissoesConfig.ts`
- Toast de sucesso/erro para cada ação
- QueryClient invalidation correto

#### **PASSO 3: Criar src/hooks/useComissoesCampanhas.ts**

**Estrutura:**
- Query para `comissoes_campanhas` (ordenadas por ano DESC, mês DESC)
- Derivada: `campanhaAtual` (status='aberta' mais recente)
- Mutation: `criarCampanha(dados)`
- Mutation: `fecharCampanha(id)`

**Padrão:**
- Simplificar: apenas operações mais comuns (criar, fechar)
- Toast de sucesso/erro

#### **PASSO 4: Reformar src/pages/vendas/ComissoesConfig.tsx**

**Mudanças estruturais:**

1. **Layout com Tabs (7 abas):**
   - Aba 1: "Bonificação Adesão" (FaixaAdesao)
   - Aba 2: "Recorrente" (FaixaRecorrente com subtabs interno/externo)
   - Aba 3: "Produção" (FaixaProducao)
   - Aba 4: "Crescimento" (FaixaCrescimento com subtabs)
   - Aba 5: "Classificação" (FaixaClassificacao com filtros)
   - Aba 6: "Parâmetros" (comissoes_parametros)
   - Aba 7: "Campanhas" (comissoes_campanhas)

2. **Componentes usados:**
   - Tabs, TabsList, TabsTrigger, TabsContent (já importados em MinhasComissoes.tsx)
   - Table, TableHeader, TableBody, TableRow, TableHead, TableCell
   - Dialog para edição (padrão já usado em ComissoesConfig atual)
   - Badge para status
   - Button, Input, Select
   - Card para seções informativas

3. **Padrão de CRUD por aba:**
   - Tabela com dados do hook
   - Botão "Nova [Recurso]" que abre Dialog
   - Colunas: campo1 | campo2 | ... | Status/Ativo | Ações
   - Ações: Editar (abre Dialog) e Excluir (confirmação)
   - Validações no Dialog

4. **Comportamento esperado:**
   - Usar `useComissoesFaixas()` para buscar dados
   - Usar mutations do hook para salvar
   - Loading state por aba
   - Toast de sucesso/erro
   - Permissões: PermissionGate para roles diretor/gerente_comercial

**Estrutura de arquivo:**
```typescript
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useComissoesFaixas } from '@/hooks/useComissoesFaixas';
import { useComissoesCampanhas } from '@/hooks/useComissoesCampanhas';
import { PermissionGate } from '@/components/PermissionGate';

export default function ComissoesConfig() {
  const { faixasAdesao, faixasRecorrente, parametros, addFaixa, updateFaixa, deleteFaixa, updateParametro, isLoading } = useComissoesFaixas();
  const { campanhas, criarCampanha, fecharCampanha } = useComissoesCampanhas();
  
  // Estados de dialog por aba
  const [dialogAberta, setDialogAberta] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('adesao');
  const [editando, setEditando] = useState(null);
  
  return (
    <div className="container mx-auto py-6">
      <h1>Configuração de Comissionamento</h1>
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList>
          <TabsTrigger value="adesao">Bonificação Adesão</TabsTrigger>
          <TabsTrigger value="recorrente">Recorrente</TabsTrigger>
          {/* ... outras abas ... */}
        </TabsList>
        
        <TabsContent value="adesao">
          {/* Tabela + CRUD para FaixaAdesao */}
        </TabsContent>
        
        {/* ... outras abas ... */}
      </Tabs>
    </div>
  );
}
```

### 3. PONTOS DE ATENÇÃO CRÍTICOS

⚠️ **Impacto em páginas existentes:**
- Comissoes.tsx usa `useComissoes()` (continua igual) ✅
- MinhasComissoes.tsx usa `useMinhasComissoes()` (continua igual) ✅
- useComissoesConfig.ts (continua igual) ✅

✅ **Permissões:**
- Rota `/vendas/comissoes/config` já existe
- Usar `<PermissionGate roles={['diretor', 'gerente_comercial']}>` na página

✅ **Padrões a manter:**
- Sonner toast para feedback
- React Query para estado
- Shadcn UI components
- TypeScript typing completo
- Validações no Dialog

⚠️ **Subtabs em "Recorrente" e "Crescimento":**
- Usar `useState` para track qual subtab está ativa
- Filtrar dados por `tipo_consultor` antes de renderizar

### 4. SEQUENCE DE DESENVOLVIMENTO

```
1. Estender src/types/comissoes.ts
   ↓ Validação: verificar se compila
2. Criar src/hooks/useComissoesFaixas.ts
   ↓ Validação: sem erros de type
3. Criar src/hooks/useComissoesCampanhas.ts
   ↓ Validação: sem erros de type
4. Reformar src/pages/vendas/ComissoesConfig.tsx
   ↓ Validação: página renderiza, abas funcionam, CRUD funciona
5. Testar:
   - Navegar para /vendas/comissoes/config
   - Verificar se todas as abas renderizam
   - CRUD: criar, editar, deletar em cada aba
   - Verificar se Comissoes.tsx e MinhasComissoes.tsx continuam funcionando
```

### 5. VALIDAÇÃO ESPERADA

✅ Todos os types compilam sem conflito
✅ Hooks retornam dados corretos (sem erros de acesso)
✅ ComissoesConfig carrega com as 7 abas
✅ Aba Adesão: CRUD funciona (criar/editar/deletar faixa)
✅ Aba Recorrente: subtabs interno/externo funcionam
✅ Aba Parâmetros: edição de valores funciona
✅ Aba Campanhas: criar/fechar campanha funciona
✅ Páginas legadas NÃO quebram
✅ PermissionGate restringe acesso corretamente
