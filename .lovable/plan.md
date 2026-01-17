# Plano: Adicionar Configuracao de Valor por Cota

## Objetivo

Criar uma configuracao de sistema para definir o "Valor por Cota" - um valor monetario base que representa uma fracao do valor FIPE do veiculo. Isso permitira que o sistema calcule automaticamente quantas cotas um veiculo possui.

**Exemplo pratico:**
- Valor por Cota configurado: R$ 5.000,00
- Veiculo com FIPE R$ 50.000 = 10 cotas
- Veiculo com FIPE R$ 75.000 = 15 cotas

## Escopo Inicial

Nesta primeira fase, a alteracao sera **apenas conceitual e de configuracao** - o sistema entendera o conceito de cotas, mas nao alteraremos (ainda) os calculos de precificacao ou exibicao.

---

## Etapas de Implementacao

### 1. Adicionar nova configuracao no banco de dados (Migration)

Inserir um novo registro na tabela `configuracoes`:

```sql
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES (
  'atuarial_valor_por_cota',
  '5000',
  'moeda',
  'atuarial',
  'Valor em reais que representa uma cota. Usado para calcular o numero de cotas de um veiculo (FIPE / valor_cota = quantidade de cotas)',
  true
);
```

**Campos:**
- `chave`: `atuarial_valor_por_cota`
- `tipo`: `moeda` (exibira input com prefixo R$)
- `categoria`: `atuarial` (agrupara na aba "Atuarial" junto com margem de seguranca, sinistralidade, etc.)
- `valor`: `5000` (valor padrao inicial)
- `editavel`: `true`

### 2. Criar hook utilitario para calculo de cotas

Criar `src/hooks/useValorPorCota.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useValorPorCota() {
  return useQuery({
    queryKey: ['configuracao-valor-por-cota'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'atuarial_valor_por_cota')
        .single();
      
      if (error) throw error;
      return Number(data?.valor) || 5000; // Fallback para 5000
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

// Funcao utilitaria para calcular numero de cotas
export function calcularQuantidadeCotas(valorFipe: number, valorPorCota: number): number {
  if (!valorPorCota || valorPorCota <= 0) return 0;
  return Math.ceil(valorFipe / valorPorCota); // Arredonda para cima
}

// Funcao utilitaria para calcular valor total em cotas
export function calcularValorEmCotas(quantidadeCotas: number, valorPorCota: number): number {
  return quantidadeCotas * valorPorCota;
}
```

### 3. (Opcional) Exibir quantidade de cotas na UI de cotacao

Para que o sistema "entenda" o conceito de cotas, podemos adicionar uma exibicao informativa em locais estrategicos:

**Exemplo em `usePlanosCotacao.ts`:**
```typescript
// Adicionar ao retorno do hook:
const quantidadeCotas = calcularQuantidadeCotas(valorFipe, valorPorCota);
```

**Exemplo de exibicao (futura):**
```
Veiculo: Honda Civic 2023
Valor FIPE: R$ 120.000,00
Cotas: 24 (base R$ 5.000/cota)
```

---

## Arquivos a Modificar/Criar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/migrations/XXXXXX_add_valor_por_cota.sql` | Criar | Migration para inserir a configuracao |
| `src/hooks/useValorPorCota.ts` | Criar | Hook + funcoes utilitarias de calculo de cotas |

---

## Resultado Esperado

1. **Na tela de Configuracoes (`/diretoria/configuracoes`):**
   - Aba "Atuarial" exibira novo campo "Atuarial Valor Por Cota"
   - Input com prefixo "R$" e valor padrao 5000
   - Editavel pela diretoria

2. **No sistema:**
   - Hook `useValorPorCota()` disponivel para qualquer componente
   - Funcao `calcularQuantidadeCotas(valorFipe, valorPorCota)` para calculos
   - Base preparada para futuras implementacoes (ex: usar cotas no calculo de mensalidade)

---

## Proximos Passos (fora deste escopo)

Apos a implementacao inicial, podemos evoluir para:
1. Exibir quantidade de cotas na cotacao publica
2. Usar quantidade de cotas no calculo de mensalidade
3. Exibir cotas em contratos e propostas
4. Usar cotas para calculo de sinistro/indenizacao

---

## Validacao

- Acessar `/diretoria/configuracoes` como diretor
- Verificar que a aba "Atuarial" mostra o campo "Atuarial Valor Por Cota"
- Editar o valor e confirmar que salva corretamente
- Usar o hook em um componente de teste para validar o calculo
