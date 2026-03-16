

## Plano: Compartilhar elegibilidade por linha de produto

### Diagnóstico

Ambos os planos SELECT ONE e SELECT ONE 5% PROMO têm dados idênticos no banco (218 regras cada, mesma `product_line_id`, mesmo `linha_slug`, mesmo `plano_preco_map`). Apesar disso, o SELECT ONE 5% PROMO não aparece nos resultados da cotação em runtime.

A causa mais provável é uma inconsistência na resolução de elegibilidade por `plano_id` individual — se houver qualquer atraso de sincronização entre as regras duplicadas, o plano variante pode ser negado.

### Solução

Modificar `verificarElegibilidadeModelo` em `src/hooks/usePlanosCotacao.ts` para buscar regras de elegibilidade pelo `linha` (product line slug) do plano, ao invés do `plano_id` individual. Todos os planos da mesma linha compartilham automaticamente as mesmas regras de elegibilidade.

### Edição — `src/hooks/usePlanosCotacao.ts`

**1. Alterar a função `verificarElegibilidadeModelo` (linhas 213-271)**

Aceitar `linha` como parâmetro e buscar regras de TODOS os planos da mesma linha:

```typescript
function verificarElegibilidadeModelo(
  planoId: string,
  linha: string | null,
  veiculo: { marca: string; modelo: string; ano: number; combustivel: string },
): 'aprovado' | 'limitado' | 'negado' {
  // Buscar regras por linha (família), não por plano individual
  // Fallback: busca por plano_id se linha não disponível
  const planosNaLinha = linha
    ? (planosBanco || []).filter(p => (p.linha || '').toLowerCase() === linha).map(p => p.id)
    : [planoId];

  const regrasDoPlano = elegibilidadeData?.filter(e => planosNaLinha.includes(e.plano_id)) ?? [];
  // Sem configuração = aceita tudo
  if (regrasDoPlano.length === 0) return 'aprovado';

  // ... resto da lógica de matching permanece igual
```

**2. Atualizar a chamada (linha 377-385)**

Passar `linha` como segundo argumento:

```typescript
elegibilidadeStatus = verificarElegibilidadeModelo(
  plano.id,
  linha,  // ← passa a linha do plano
  {
    marca: params.marca,
    modelo: params.modelo,
    ano: anoVeiculoNum,
    combustivel: combustivelOriginal,
  },
);
```

### Resultado
- SELECT ONE 5% PROMO herda automaticamente as regras de elegibilidade de toda a família `select-one`
- Não é necessário duplicar regras no banco para variantes promocionais
- Todas as outras famílias (select, lancamento, especial, etc.) já se beneficiam da mesma lógica

