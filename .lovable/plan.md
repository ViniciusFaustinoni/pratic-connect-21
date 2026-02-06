
## Plano: Corrigir Dropdown de Vendedores na Tab Detalhes

### Problema Identificado
O seletor "Selecione um vendedor" na aba **Detalhes** da página de comissões (`/vendas/comissoes`) está vazio.

**Causa:** O componente `ComissoesDetalhesTab` usa a lista `resumoVendedores` que vem do hook `useComissoesExtended`. Este hook só retorna vendedores que **já possuem comissões registradas** no período selecionado. Como ainda não há comissões calculadas, o dropdown fica vazio.

**Evidência:** O banco já possui 130+ consultores cadastrados com roles comerciais (`vendedor_clt`, `vendedor_externo`, etc.) via a tabela `user_roles` + `profiles`, mas eles não aparecem porque a lógica atual depende da tabela `comissoes`.

### Solução Proposta
Alterar o `ComissoesDetalhesTab` para usar o hook `useConsultores()` existente, que já busca todos os consultores do sistema independente de terem comissões.

### Arquivos a Modificar

**1. `src/components/comissoes/ComissoesDetalhesTab.tsx`**

Mudanças:
- Importar o hook `useConsultores` do arquivo existente
- Usar os consultores do hook para popular o dropdown
- Manter a lógica de exibir detalhes quando o vendedor é selecionado
- Se o vendedor selecionado tiver dados em `resumoVendedores`, exibir; senão, mostrar valores zerados

```text
ANTES (linha 143-154):
- O Select usa resumoVendedores.map()
- Se resumoVendedores está vazio, dropdown fica vazio

DEPOIS:
- O Select usa consultores do hook useConsultores()
- Dropdown sempre mostra todos os consultores cadastrados
- Ao selecionar, busca os dados do vendedor em resumoVendedores (se existir) ou exibe "sem comissões no período"
```

### Detalhes Técnicos

1. **Importação adicional:**
```typescript
import { useConsultores } from '@/hooks/useConsultores';
```

2. **Usar o hook no componente:**
```typescript
const { data: consultores, isLoading: isLoadingConsultores } = useConsultores();
```

3. **Atualizar o Select para mapear `consultores`:**
```typescript
{consultores?.filter(c => c.ativo).map((c) => (
  <SelectItem key={c.id} value={c.id}>
    <div className="flex items-center gap-2">
      <UserAvatar src={c.avatar_url || undefined} name={c.nome} size="sm" />
      {c.nome}
    </div>
  </SelectItem>
))}
```

4. **Atualizar a lógica de `selectedVendedor`:**
```typescript
// Se existe em resumoVendedores, usa os dados detalhados
// Senão, cria um objeto básico com valores zerados
const selectedVendedor = useMemo(() => {
  const fromResumo = resumoVendedores.find(v => v.vendedor_id === selectedVendedorId);
  if (fromResumo) return fromResumo;
  
  const consultor = consultores?.find(c => c.id === selectedVendedorId);
  if (!consultor) return null;
  
  // Retorna estrutura compatível com valores zerados
  return {
    vendedor_id: consultor.id,
    vendedor_nome: consultor.nome,
    vendedor_avatar: consultor.avatar_url,
    tipo_consultor: consultor.roles.includes('vendedor_externo') ? 'externo' : 'interno',
    total_adesao: 0,
    total_recorrente: 0,
    total_producao: 0,
    total_classificacao: 0,
    total_crescimento: 0,
    total_recorde: 0,
    total_geral: 0,
    vendas_confirmadas: 0,
  };
}, [resumoVendedores, consultores, selectedVendedorId]);
```

### Comportamento Esperado Após Correção

1. Ao acessar a aba "Detalhes", o dropdown mostrará **todos os consultores cadastrados** no sistema
2. Os consultores inativos serão filtrados (somente `ativo: true`)
3. Ao selecionar um consultor:
   - Se ele tiver comissões no período: exibe os valores calculados
   - Se não tiver comissões: exibe os cards com valores zerados e mensagem indicando "sem dados no período"
4. A lógica de comissões e deduções continua funcionando normalmente

### Impacto
- **Sem alteração em banco de dados**
- **Sem alteração na lógica de cálculo de comissões**
- Apenas correção visual/UX no dropdown
