

## Plano: Alinhar Calculadora de Preço com a tabela real

### Divergências encontradas

Comparando a calculadora (`CalculadoraPreco.tsx`) com o motor de cotação (`usePlanosCotacao.ts`), há 3 problemas que fazem os números divergirem:

| Problema | Calculadora (hoje) | Motor de cotação (correto) |
|----------|-------------------|---------------------------|
| **Combustível sem placa** | `combustivelDetectado = null` → filtro ignora combustível → pega a primeira row aleatória (diesel ou gasolina) | Normaliza para `'gasolina'` como padrão |
| **Adicional por nível** | Não aplica `adicional_mensal` — mostra apenas o preço base da linha | Select Premium = base + R$30, Exclusive = base + R$60, etc. |
| **Desconto promo** | Não aplica `desconto_percentual` | Select One Promo 5% = valor × 0.95 |

**Exemplo concreto** (FIPE R$80k, RJ, Particular):
- Tabela base Select gasolina = R$360,90
- Calculadora mostra: R$360,90 (ou R$389,30 se pegou diesel)
- Cotação real mostra: Basic R$360,90 / Premium R$390,90 / Exclusive R$420,90

### Alterações propostas

**1. Refatorar a calculadora para mostrar planos individuais (não apenas linhas)**

Em vez de agrupar por `linha_slug`, buscar os dados de `plano_preco_map` e `planos` para iterar por plano, aplicando:
- `adicional_mensal` do plano
- `desconto_percentual` do plano
- Nome do plano real (SELECT BASIC, SELECT PREMIUM, etc.)

**2. Defaultar combustível para gasolina quando sem placa**

Quando `combustivelDetectado` é null (entrada manual sem placa), usar `'gasolina'` como padrão — mesma lógica do motor de cotação.

**3. Adicionar seletor de combustível (opcional)**

Mostrar toggle Gasolina/Diesel visível apenas para tipo "Carro", permitindo ao consultor simular ambos cenários sem precisar da placa.

**4. Resultado visual**

Cada resultado mostra o nome completo do plano e preço final:
```text
SELECT BASIC          R$ 360,90/mês
SELECT PREMIUM        R$ 390,90/mês
SELECT EXCLUSIVE      R$ 420,90/mês
SELECT ONE            R$ 404,70/mês
SELECT ONE 5% PROMO   R$ 384,47/mês
LANÇAMENTO BASIC      R$ 360,90/mês
...
```

### Arquivos afetados

- `src/components/planos/CalculadoraPreco.tsx` — refatoração principal (buscar plano_preco_map, iterar por plano, aplicar adicional + desconto, default combustível)
- Nenhuma alteração de banco necessária

