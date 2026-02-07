
# Plano: Usar Rastreadores do Porte do Vistoriador na Substituição

## Problema Identificado

Na tela de conclusão de manutenção do vistoriador (`ExecutarManutencao.tsx`), quando ele seleciona "Substituição de Rastreador", o sistema busca **todos os rastreadores em estoque da base** usando `useRastreadoresParaSubstituicao()`.

Porém, a lógica correta é que o vistoriador só pode substituir por rastreadores que **ele carrega consigo** — o chamado "porte do vistoriador".

### Hook Atual (Incorreto)
```typescript
// useRastreadoresParaSubstituicao - busca TODOS em estoque
.from('rastreadores')
.select('id, codigo, numero_serie, imei, plataforma')
.eq('status', 'estoque')  // Qualquer um em estoque
```

### Hook Correto (Já Existe)
```typescript
// useRastreadoresDoPortador - busca apenas do vistoriador logado
.from('rastreadores')
.select('id, codigo, imei, numero_serie, plataforma')
.eq('portador_id', profile!.id)  // Apenas do MEU porte
.eq('status', 'estoque')
```

---

## Solução

Substituir o hook `useRastreadoresParaSubstituicao` por `useRastreadoresDoPortador` na tela do vistoriador.

---

## Alterações

### Arquivo: `src/pages/instalador/ExecutarManutencao.tsx`

#### 1. Atualizar import

```diff
- import { 
-   useRegistrarResultadoManutencao, 
-   useRastreadoresParaSubstituicao,
-   useMarcarNaoCompareceu 
- } from '@/hooks/useVistoriaManutencao';

+ import { 
+   useRegistrarResultadoManutencao, 
+   useMarcarNaoCompareceu 
+ } from '@/hooks/useVistoriaManutencao';
+ import { useRastreadoresDoPortador } from '@/hooks/useRastreadoresPortador';
```

#### 2. Substituir o hook usado

```diff
- const { data: rastreadoresDisponiveis, isLoading: loadingRastreadores } = useRastreadoresParaSubstituicao();
+ const { data: rastreadoresDisponiveis, isLoading: loadingRastreadores } = useRastreadoresDoPortador();
```

#### 3. Exibir número de série e IMEI no item

Atualizar a lista para mostrar melhor as informações de cada rastreador em porte:

```tsx
{rastreadorFiltrados.slice(0, 10).map((r) => (
  <div
    key={r.id}
    onClick={() => setRastreadorNovoId(r.id)}
    className={cn(
      "p-3 cursor-pointer transition-colors",
      rastreadorNovoId === r.id 
        ? "bg-primary/10 border-l-2 border-l-primary" 
        : "hover:bg-muted/50"
    )}
  >
    <p className="font-medium text-sm">{r.codigo}</p>
    <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
      {r.numero_serie && (
        <span>S/N: <span className="font-mono">{r.numero_serie}</span></span>
      )}
      {r.imei && (
        <span>IMEI: <span className="font-mono">{r.imei}</span></span>
      )}
    </div>
  </div>
))}
```

#### 4. Melhorar mensagem de alerta quando vazio

Quando o vistoriador não tem rastreadores em seu porte:

```tsx
{rastreadorFiltrados.length === 0 ? (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      Você não tem rastreadores em seu porte. Solicite ao coordenador que transfira equipamentos para você.
    </AlertDescription>
  </Alert>
) : (
  // lista de rastreadores...
)}
```

---

## Fluxo Visual Final

Quando o vistoriador seleciona "Substituição de Rastreador":

```
┌─────────────────────────────────────────────┐
│  O que fazer com o rastreador antigo?       │
│                                             │
│  ○ Enviar para Triagem (Base)               │
│  ○ Baixar Definitivamente                   │
├─────────────────────────────────────────────┤
│  Rastreador Substituto *                    │
│                                             │
│  🔍 [Buscar por código, IMEI...]            │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ RT-001                          ✓   │    │
│  │ S/N: ABC123  IMEI: 86712345678901  │    │
│  ├─────────────────────────────────────┤    │
│  │ RT-002                              │    │
│  │ S/N: DEF456  IMEI: 86712345678902  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ID na Plataforma (opcional)                │
│  [___________________________________]      │
└─────────────────────────────────────────────┘
```

Os rastreadores listados são **apenas os que estão no porte do vistoriador logado**, com código, número de série e IMEI visíveis para fácil identificação.

---

## Resultado Esperado

1. Lista mostra apenas rastreadores em porte do vistoriador (portador_id = profile.id)
2. Exibe código, número de série e IMEI para identificação física
3. Mensagem clara quando não há rastreadores disponíveis no porte
4. Busca filtra por código, número de série ou IMEI
