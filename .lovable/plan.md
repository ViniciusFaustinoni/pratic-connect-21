
# Correcao do Termo de Filiacao: dia_vencimento e plano.descricao

## Problemas identificados

### 1. Vencimento mostra "10" em vez de "20"

**Causa raiz confirmada:** O contrato `CTR-20260217124002-07MZ2Y` tem `dia_vencimento: NULL` no banco de dados. A cotacao tem `dia_vencimento: 20`, mas a edge function `contrato-gerar/index.ts` **nunca copia** esse campo da cotacao para o contrato.

Na linha 530-588 do `contrato-gerar/index.ts`, o insert do contrato nao inclui `dia_vencimento`. Quando o template e gerado, o `mapearDadosParaTemplate` usa `contrato.dia_vencimento || 10`, resultando no fallback "10".

Alem disso, ao criar o associado (linha 466), o `dia_vencimento` tambem e hardcoded como `10` em vez de vir da cotacao.

### 2. `{{plano.descricao}}` nao substituido

**Analise:** O template no banco esta limpo (`<p>{{plano.descricao}}</p>`) e o mapeamento existe em `template-utils.ts` linha 82. A segunda captura de tela mostra os servicos/coberturas listados corretamente, indicando que a substituicao funcionou no documento final. O primeiro screenshot provavelmente e de uma tentativa anterior ou de um preview diferente. Porem, para garantir robustez, vou fortalecer a logica de substituicao para lidar com possiveis caracteres unicode inviseis (non-breaking spaces, zero-width characters) que o TipTap pode inserir.

## Alteracoes

### Arquivo 1: `supabase/functions/contrato-gerar/index.ts`

**Mudanca principal:** Copiar `dia_vencimento` da cotacao para o contrato e para o associado.

No insert do contrato (linha ~532):
```typescript
dia_vencimento: cotacao.dia_vencimento || 10,
```

No insert do associado (linha ~466):
```typescript
dia_vencimento: cotacao.dia_vencimento || 10,
```

### Arquivo 2: `supabase/functions/_shared/template-utils.ts`

**Mudanca de robustez:** Melhorar a regex de substituicao para lidar com caracteres unicode invisiveis que o TipTap pode inserir dentro das chaves `{{}}`:

```typescript
// Normalizar o conteudo antes da substituicao
// Remover zero-width characters e normalizar espacos dentro de {{}}
resultado = resultado.replace(/\{\{([^}]*)\}\}/g, (match, inner) => {
  const cleaned = inner.replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
  return `{{${cleaned}}}`;
});
```

Isso garante que mesmo que o TipTap insira caracteres invisiveis entre `{{` e `}}`, a variavel sera normalizada antes da substituicao.

### Arquivo 3: Correcao do contrato existente (SQL manual)

O contrato ja gerado precisa ser corrigido diretamente:

```sql
UPDATE contratos 
SET dia_vencimento = 20 
WHERE numero = 'CTR-20260217124002-07MZ2Y';
```

Isso nao pode ser feito pelo codigo (o documento ja foi enviado ao Autentique), mas e importante para registros futuros.

## Resumo tecnico

| Problema | Causa | Solucao |
|----------|-------|---------|
| Vencimento "10" | `contrato-gerar` nao copia `dia_vencimento` da cotacao | Adicionar campo no insert do contrato e associado |
| `{{plano.descricao}}` | Possivel caractere unicode invisivel do TipTap | Normalizar conteudo antes de substituir variaveis |

## Arquivos alterados

1. `supabase/functions/contrato-gerar/index.ts` - copiar `dia_vencimento` da cotacao
2. `supabase/functions/_shared/template-utils.ts` - normalizar variaveis antes da substituicao
