

# Plano: Corrigir contagens nas plataformas

## Problemas identificados

1. **Contagens truncadas**: `useRastreadoresPorPlataforma()` faz `supabase.from('rastreadores').select('plataforma, status')` que retorna no máximo 1.000 linhas. Com ~6.000+ rastreadores Softruck, os números Total (988) e Instalados (736) estão errados — refletem apenas uma amostra.

2. **"Online" sempre 0**: O campo `online` nunca é incrementado na lógica. E como removemos a busca em massa de posições, esse dado não existe mais.

## Correções

### 1. `src/hooks/usePlataformasCRUD.ts` — Usar contagem via `head: true`

Substituir a query que baixa todas as linhas por queries paralelas com `{ count: 'exact', head: true }` para cada plataforma. Isso retorna o total real sem limite de 1.000 linhas.

```
// Para cada plataforma, fazer 2 queries paralelas:
// 1. Total: .from('rastreadores').select('*', { count: 'exact', head: true }).eq('plataforma', codigo)
// 2. Instalados: mesma query + .eq('status', 'instalado')
```

### 2. Remover coluna "Online" dos cards de plataforma

Já que não há mais busca em massa, o dado "Online" não existe. Remover de ambos:
- `src/components/rastreadores/PlataformasConfigPanel.tsx` — remover o terceiro item do grid (Online), ajustar grid para `grid-cols-2`
- `src/pages/monitoramento/ConfigPlataformas.tsx` — mesmo ajuste

## Arquivos alterados
- `src/hooks/usePlataformasCRUD.ts` — corrigir query para contagem exata
- `src/components/rastreadores/PlataformasConfigPanel.tsx` — remover coluna Online
- `src/pages/monitoramento/ConfigPlataformas.tsx` — remover coluna Online

