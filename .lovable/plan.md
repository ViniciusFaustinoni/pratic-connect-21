
# Plano: Configuração de Valor FIPE Mínimo para Exigência de Rastreador

## Objetivo

Adicionar uma configuração na área de Configurações da Diretoria que define o **valor FIPE mínimo** para exigir a instalação de rastreador. Veículos com FIPE abaixo desse valor terão a **instalação do rastreador dispensada** durante a vistoria, mas mantendo a vistoria completa.

## Regra de Negócio

Se o valor FIPE do veículo for **menor** que o valor configurado:
- A vistoria completa continua sendo obrigatória
- O campo para foto do "Local de Instalação do Rastreador" é **ocultado**
- A categoria "Instalação" não aparece na listagem de fotos
- O vistoriador não precisa selecionar/registrar rastreador

## Alterações Necessárias

### 1. Banco de Dados - Nova Configuração

Inserir nova configuração na tabela `configuracoes`:

```sql
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES (
  'operacional_fipe_minimo_rastreador',
  '30000',
  'moeda',
  'operacional',
  'Valor FIPE mínimo para exigir instalação de rastreador. Veículos abaixo deste valor dispensam rastreador.',
  true
);
```

### 2. `src/hooks/useServicos.ts`

**Alteração:** Adicionar `valor_fipe` ao select de veículos no `useServicoDetalhes`

```typescript
// Linha ~750: Alterar o select de veiculos
veiculos:veiculo_id (
  id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe
),
```

### 3. `src/hooks/useConfigRastreador.ts` (NOVO)

Criar hook para buscar a configuração de FIPE mínimo para rastreador:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FIPE_MINIMO_RASTREADOR_PADRAO = 30000;

export function useConfigFipeRastreador() {
  return useQuery({
    queryKey: ['config-fipe-minimo-rastreador'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'operacional_fipe_minimo_rastreador')
        .single();
      
      if (error) {
        console.warn('[useConfigFipeRastreador] Erro ao buscar:', error);
        return FIPE_MINIMO_RASTREADOR_PADRAO;
      }
      
      return Number(data?.valor) || FIPE_MINIMO_RASTREADOR_PADRAO;
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

/**
 * Verifica se o veículo precisa de rastreador
 * @returns true se precisa, false se dispensa
 */
export function precisaRastreador(valorFipe: number | null, fipeMinimo: number): boolean {
  if (!valorFipe) return true; // Se não tem FIPE, exige por segurança
  return valorFipe >= fipeMinimo;
}
```

### 4. `src/data/vistoriaConfigCompleta.ts`

**Alteração:** Exportar função para filtrar categorias baseado na necessidade de rastreador

```typescript
// Adicionar nova função helper
export function getCategoriasFiltradas(
  tipo: TipoVeiculo, 
  incluirInstalacao: boolean
): VistoriaCategoriaConfig[] {
  const categorias = getCategoriasByTipoVeiculo(tipo);
  if (!incluirInstalacao) {
    return categorias.filter(c => c.id !== 'instalacao');
  }
  return categorias;
}

export function getFotosFiltradasPorCategoria(
  tipo: TipoVeiculo,
  incluirInstalacao: boolean
): VistoriaFotoConfig[] {
  const fotos = getFotosByTipoVeiculo(tipo);
  if (!incluirInstalacao) {
    return fotos.filter(f => f.categoria !== 'instalacao');
  }
  return fotos;
}
```

### 5. `src/pages/instalador/InstaladorChecklist.tsx`

**Alterações principais:**

a) **Importar o novo hook:**
```typescript
import { useConfigFipeRastreador, precisaRastreador } from '@/hooks/useConfigRastreador';
```

b) **Buscar configuração e valor FIPE:**
```typescript
const { data: fipeMinRastreador = 30000 } = useConfigFipeRastreador();

// Verificar se veículo precisa de rastreador
const valorFipeVeiculo = useMemo(() => {
  const veiculoData = servico?.veiculos as { valor_fipe?: number } | undefined;
  return veiculoData?.valor_fipe || null;
}, [servico?.veiculos]);

const veiculoPrecisaRastreador = useMemo(() => {
  return precisaRastreador(valorFipeVeiculo, fipeMinRastreador);
}, [valorFipeVeiculo, fipeMinRastreador]);
```

c) **Filtrar categorias de fotos:**
```typescript
// Linha ~135: Alterar categoriasComFotos
const categoriasComFotos = useMemo(() => {
  const categorias = agruparFotosPorCategoriaCompleta(tipoVeiculo);
  if (!veiculoPrecisaRastreador) {
    return categorias.filter(c => c.id !== 'instalacao');
  }
  return categorias;
}, [tipoVeiculo, veiculoPrecisaRastreador]);
```

d) **Ocultar seção de seleção de rastreador (se não precisa):**
```typescript
// Na etapa 5 (Decisão), condicionar a exibição do campo de rastreador
{veiculoPrecisaRastreador && (
  <div className="space-y-3">
    <Label>Rastreador Utilizado</Label>
    {/* ... campos de IMEI e seleção de rastreador */}
  </div>
)}
```

e) **Ajustar validação de aprovação:**
```typescript
// Remover validação de rastreador se não precisa
const podeAprovar = useMemo(() => {
  const checklistOk = checklistCompleto;
  const fotosOk = fotosObrigatoriasCompletas;
  const videoOk = video360Enviado;
  const assinaturaOk = !!assinaturaUrl;
  
  // Rastreador só é obrigatório se veículo precisa
  const rastreadorOk = !veiculoPrecisaRastreador || !!imeiRastreador;
  
  return checklistOk && fotosOk && videoOk && assinaturaOk && rastreadorOk;
}, [/* deps */]);
```

f) **Mostrar alerta informativo quando dispensado:**
```typescript
{!veiculoPrecisaRastreador && (
  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
    <Router className="h-4 w-4 text-blue-600" />
    <AlertDescription className="text-blue-800 dark:text-blue-200">
      <strong>Rastreador dispensado</strong>
      <br />
      Veículo com FIPE abaixo de R$ {fipeMinRastreador.toLocaleString('pt-BR')} 
      não requer instalação de rastreador.
    </AlertDescription>
  </Alert>
)}
```

### 6. `src/pages/instalador/ExecutarVistoriaCompleta.tsx`

**Alterações similares:**
- Importar hook e verificar se precisa de rastreador
- Filtrar categoria "instalacao" das fotos quando dispensado
- Remover exigência de foto do rastreador nas validações

## Fluxo Resumido

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    CONFIGURAÇÕES DIRETORIA                          │
│  Tab: Operacional                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ FIPE Mínimo para Rastreador                                  │   │
│  │ R$ [30.000,00]                                              │   │
│  │ Veículos abaixo dispensam instalação de rastreador          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VISTORIA / INSTALAÇÃO                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Valor FIPE do Veículo: R$ 25.000                                   │
│  Configuração: R$ 30.000                                            │
│                                                                      │
│  ⚠️ FIPE < Mínimo → Rastreador DISPENSADO                           │
│                                                                      │
│  Fotos obrigatórias:                                                │
│  ✅ Identificação e Motor (6 fotos)                                 │
│  ✅ Exterior 360° (9 fotos)                                         │
│  ✅ Pneus (4 fotos)                                                 │
│  ✅ Interior (5 fotos)                                              │
│  ✅ Bancos e Forrações (7 fotos)                                    │
│  ❌ Instalação (OCULTO - não aparece)                               │
│                                                                      │
│  Vídeo 360°: ✅ Obrigatório (mantido)                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `configuracoes` (DB) | INSERT | Adicionar configuração `operacional_fipe_minimo_rastreador` |
| `src/hooks/useServicos.ts` | Modificar | Incluir `valor_fipe` no select de veículos |
| `src/hooks/useConfigRastreador.ts` | Criar | Hook para buscar configuração |
| `src/data/vistoriaConfigCompleta.ts` | Modificar | Adicionar funções de filtragem |
| `src/pages/instalador/InstaladorChecklist.tsx` | Modificar | Condicionar exibição da categoria instalação |
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Modificar | Mesma lógica de filtragem |

## Observações Importantes

1. **Segurança:** Se o valor FIPE não estiver disponível, o sistema exige rastreador por segurança
2. **Configuração padrão:** R$ 30.000,00 (pode ser alterado na área de configurações)
3. **Vistoria mantida:** Apenas o rastreador é dispensado, a vistoria completa permanece obrigatória
4. **Retroatividade:** Vistorias/instalações já concluídas não são afetadas
