
# Plano: Persistência do Progresso da Vistoria ✅ IMPLEMENTADO

## Status: CONCLUÍDO em 2026-02-08

## Problema Resolvido
Quando o vistoriador atualizava a página ou ocorria qualquer interrupção durante a vistoria no `ExecutarVistoriaCompleta.tsx`, todo o progresso era perdido.

Os campos que **não persistem** atualmente:
- Conferência de dados (placa, chassi, modelo, cor) 
- Hodômetro digitado
- Observações do vistoriador
- Etapa/categoria em que estava trabalhando

O que **já persiste** (via banco):
- Fotos enviadas (tabela `vistoria_fotos`)
- Vídeo 360° (coluna `vistorias.video_360_url`)

---

## Solução Proposta

Utilizar a coluna **`vistorias.observacoes`** (text) para persistir observações e criar uma nova coluna JSONB para persistir os dados parciais da vistoria (conferência, hodômetro, categorias abertas).

### Estratégia de Persistência:
1. **Auto-save**: Salvar automaticamente a cada alteração significativa (debounce 2s)
2. **Restaurar ao carregar**: Quando a página abrir, carregar dados salvos do banco
3. **Campos a persistir**:
   - `conferencia` (objeto com placa, chassi, modelo, cor)
   - `hodometro` (string/número)
   - `observacoes` (texto)
   - `openCategories` (array de IDs das categorias abertas)

---

## Alterações Necessárias

### 1. Migração de Banco de Dados
Adicionar nova coluna `dados_parciais` (jsonb) na tabela `vistorias` para armazenar o estado intermediário.

```sql
ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS dados_parciais jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN vistorias.dados_parciais IS 
  'Dados parciais da vistoria em andamento (conferência, hodômetro, etc)';
```

---

### 2. Modificar `src/hooks/useVistorias.ts`

**Adicionar novo hook `useSalvarRascunhoVistoriaCompleta`**:

```typescript
interface DadosParciaisVistoria {
  conferencia?: {
    placa: boolean;
    chassi: boolean;
    modelo: boolean;
    cor: boolean;
  };
  hodometro?: string;
  observacoes?: string;
  openCategories?: string[];
}

export function useSalvarRascunhoVistoriaCompleta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      vistoriaId, 
      dadosParciais,
      hodometro,
      observacoes 
    }: {
      vistoriaId: string;
      dadosParciais: DadosParciaisVistoria;
      hodometro?: number;
      observacoes?: string;
    }) => {
      const { error } = await supabase
        .from('vistorias')
        .update({
          dados_parciais: dadosParciais,
          km_atual: hodometro || null,
          observacoes: observacoes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vistoriaId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['vistoria-completa'] 
      });
    },
  });
}
```

---

### 3. Modificar `src/pages/instalador/ExecutarVistoriaCompleta.tsx`

**A) Importar e usar o novo hook**

**B) Adicionar useEffect para restaurar dados salvos**:

```typescript
// Restaurar dados salvos ao carregar vistoria
useEffect(() => {
  if (vistoria) {
    const dadosParciais = (vistoria as any).dados_parciais;
    
    if (dadosParciais?.conferencia) {
      setConferencia(dadosParciais.conferencia);
    }
    if (dadosParciais?.hodometro) {
      setHodometro(dadosParciais.hodometro);
    }
    if (dadosParciais?.observacoes) {
      setObservacoes(dadosParciais.observacoes);
    }
    if (dadosParciais?.openCategories?.length > 0) {
      setOpenCategories(dadosParciais.openCategories);
    }
    
    // Também verificar km_atual e observacoes direto da vistoria
    if (vistoria.km_atual) {
      setHodometro(String(vistoria.km_atual));
    }
    if (vistoria.observacoes) {
      setObservacoes(vistoria.observacoes);
    }
  }
}, [vistoria]);
```

**C) Adicionar auto-save com debounce**:

```typescript
// Auto-save com debounce
useEffect(() => {
  if (!vistoriaId) return;
  
  const timeoutId = setTimeout(() => {
    salvarRascunho.mutate({
      vistoriaId,
      dadosParciais: {
        conferencia,
        hodometro,
        observacoes,
        openCategories,
      },
      hodometro: hodometro ? parseInt(hodometro) : undefined,
      observacoes: observacoes || undefined,
    });
  }, 2000); // Debounce de 2 segundos

  return () => clearTimeout(timeoutId);
}, [conferencia, hodometro, observacoes, openCategories, vistoriaId]);
```

**D) Adicionar indicador visual de salvamento**:

```typescript
const [salvando, setSalvando] = useState(false);

// No header, mostrar status:
{salvando && (
  <span className="text-xs text-slate-400 flex items-center gap-1">
    <Loader2 className="h-3 w-3 animate-spin" />
    Salvando...
  </span>
)}
```

---

### 4. Atualizar query do `useVistoriaCompleta`

Incluir o campo `dados_parciais` na query do banco:

```typescript
.select(`
  *,
  dados_parciais,  // <-- Adicionar aqui
  veiculo:veiculos(...),
  ...
`)
```

---

## Fluxo Final

```text
VISTORIADOR ABRE VISTORIA
         │
         ▼
┌──────────────────────────────────────────────┐
│ useVistoriaCompleta busca dados             │
│ ↳ Carrega dados_parciais, km_atual, etc     │
└──────────────────┬───────────────────────────┘
                   │
         ▼ useEffect restaura estados
                   │
┌──────────────────┴───────────────────────────┐
│ ESTADOS RESTAURADOS:                         │
│ • conferencia ← dados_parciais.conferencia   │
│ • hodometro ← dados_parciais.hodometro       │
│ • observacoes ← dados_parciais.observacoes   │
│ • openCategories ← dados_parciais.open...    │
└──────────────────┬───────────────────────────┘
                   │
         ▼ Vistoriador continua trabalhando
                   │
┌──────────────────┴───────────────────────────┐
│ A CADA ALTERAÇÃO (debounce 2s):             │
│ useSalvarRascunhoVistoriaCompleta.mutate()  │
│ ↳ Salva dados_parciais no banco             │
└──────────────────┬───────────────────────────┘
                   │
         ▼ PÁGINA ATUALIZADA / INTERRUPÇÃO
                   │
         ▼ Vistoriador reabre a vistoria
                   │
┌──────────────────┴───────────────────────────┐
│ PROGRESSO RESTAURADO AUTOMATICAMENTE        │
│ • Conferência já marcada                     │
│ • Hodômetro já preenchido                    │
│ • Observações já digitadas                   │
│ • Categorias que estava abertas             │
└──────────────────────────────────────────────┘
```

---

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Adicionar coluna `dados_parciais` (jsonb) |
| `src/hooks/useVistorias.ts` | Adicionar hook `useSalvarRascunhoVistoriaCompleta` |
| `src/hooks/useVistorias.ts` | Atualizar query do `useVistoriaCompleta` para incluir `dados_parciais` |
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Restaurar dados ao carregar |
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Auto-save com debounce |
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Indicador visual de salvamento |

---

## Benefícios

1. **Tolerância a falhas**: Se o app travar, o navegador fechar, ou a conexão cair, o progresso está salvo
2. **Experiência contínua**: Vistoriador pode pausar e continuar de onde parou
3. **Multi-dispositivo**: Se precisar trocar de celular, pode continuar a vistoria
4. **Sem ação manual**: O auto-save é transparente para o usuário
5. **Baixo overhead**: Debounce evita requisições excessivas
