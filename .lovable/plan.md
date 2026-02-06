

## Calculadora de Preço Rápida - Faixa de Valores com Critérios

### Objetivo

Transformar a calculadora atual (que mostra um valor único) em uma ferramenta mais robusta que:
1. Exiba uma **faixa de valores** (ex: R$ 89 a R$ 169/mês) baseada nos planos disponíveis
2. Inclua **critérios básicos** que influenciam o cálculo para maior coerência
3. Mantenha a experiência de **cálculo rápido** (sem necessidade de cadastro)

---

### Campos de Entrada Propostos

| Campo | Tipo | Objetivo |
|-------|------|----------|
| **Valor FIPE** | Input monetário | Base para encontrar faixa de preço |
| **Ano do veículo** | Select (faixas) | Veículos mais antigos podem ter variação |
| **Tipo de uso** | Toggle (Particular/Trabalho) | Uso profissional pode ter acréscimo |
| **Cobertura desejada** | Select (Básica/Completa/Premium) | Filtrar por categoria de plano |

---

### Lógica de Cálculo

O sistema já possui na tabela `tabelas_preco`:
- `fipe_de` / `fipe_ate` - Faixas de valor FIPE
- `taxa_administrativa` - Taxa fixa mensal
- `valor_cota` - Valor variável por faixa
- `valor_rastreamento` - Taxa de rastreamento
- `valor_assistencia` - Taxa de assistência (opcional)
- `plano_id` - Referência ao plano (Básico, Total, Premium)

**Fórmula base:**
```
Mensalidade = taxa_administrativa + valor_rastreamento + valor_assistencia + (valor_cota * fator_risco)
```

**Fatores de ajuste:**
- **Ano do veículo**: Veículos com mais de 10 anos = fator 1.15 (15% adicional)
- **Tipo de uso**: Trabalho/comercial = fator 1.20 (20% adicional)
- **Sem fator**: Particular + veículo recente = fator 1.0

---

### Exibição do Resultado

Ao invés de um valor único, mostrar:

```
┌──────────────────────────────────────────────────────────────┐
│  Estimativa para veículo R$ 40.000,00                       │
│  Faixa FIPE: R$ 0 - R$ 50.000                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│     Mensalidade estimada:                                   │
│     ┌─────────────────────────────────────────┐             │
│     │  R$ 89,00  a  R$ 169,00                 │             │
│     │  (Plano Básico até Premium)             │             │
│     └─────────────────────────────────────────┘             │
│                                                              │
│  Critérios aplicados:                                       │
│  - Uso particular                                           │
│  - Veículo até 10 anos                                      │
│  - Cobertura: Todas as opções                               │
│                                                              │
│  * Valores estimados. Consulte um especialista              │
│    para cotação personalizada.                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/planos/CalculadoraPreco.tsx` | Reescrever componente com novos campos e lógica de faixa |
| `src/hooks/usePlanos.ts` | Adicionar query para buscar preços por faixa FIPE (se necessário) |

---

### Detalhes de Implementacao

**1. Estados do componente:**

```typescript
const [valorFipe, setValorFipe] = useState<string>('');
const [anoVeiculo, setAnoVeiculo] = useState<'recente' | 'antigo'>('recente'); // 0-10 anos vs 10+
const [tipoUso, setTipoUso] = useState<'particular' | 'trabalho'>('particular');
const [coberturaDesejada, setCoberturaDesejada] = useState<'todas' | 'basica' | 'completa' | 'premium'>('todas');
const [resultado, setResultado] = useState<ResultadoFaixa | null>(null);
```

**2. Interface de resultado:**

```typescript
interface ResultadoFaixa {
  faixaFipe: string;
  valorMinimo: number;
  valorMaximo: number;
  planoMinimo: string;
  planoMaximo: string;
  fatoresAplicados: string[];
  observacao?: string;
}
```

**3. Funcao de calculo:**

```typescript
const calcular = () => {
  const valor = parseFloat(valorFipe.replace(/\D/g, '')) / 100;
  
  // Buscar faixa FIPE correspondente
  const faixas = tabelas.filter(t => 
    valor >= Number(t.fipe_de) && valor <= Number(t.fipe_ate)
  );
  
  // Calcular fatores
  let fator = 1.0;
  const fatoresAplicados: string[] = [];
  
  if (anoVeiculo === 'antigo') {
    fator *= 1.15;
    fatoresAplicados.push('Veículo com mais de 10 anos (+15%)');
  }
  
  if (tipoUso === 'trabalho') {
    fator *= 1.20;
    fatoresAplicados.push('Uso para trabalho (+20%)');
  }
  
  // Calcular valores por plano
  const valores = faixas.map(f => {
    const base = Number(f.taxa_administrativa) + Number(f.valor_rastreamento) + Number(f.valor_assistencia || 0);
    return base * fator;
  });
  
  // Filtrar por cobertura se especificado
  // Retornar min/max
  setResultado({
    faixaFipe: `R$ ${formatCurrency(faixas[0].fipe_de)} - R$ ${formatCurrency(faixas[0].fipe_ate)}`,
    valorMinimo: Math.min(...valores),
    valorMaximo: Math.max(...valores),
    planoMinimo: 'Básico',
    planoMaximo: 'Premium',
    fatoresAplicados,
  });
};
```

---

### Interface Visual (Wireframe)

```
┌─────────────────────────────────────────────────────────────┐
│  Calculadora de Preço                                    x │
│  Simule rapidamente sua mensalidade                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Valor FIPE do Veículo                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ R$ 40.000,00                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Ano do Veículo                                            │
│  ┌────────────────────┐ ┌────────────────────┐             │
│  │ ● Até 10 anos      │ │ ○ Mais de 10 anos  │             │
│  └────────────────────┘ └────────────────────┘             │
│                                                             │
│  Tipo de Uso                                               │
│  ┌────────────────────┐ ┌────────────────────┐             │
│  │ ● Particular       │ │ ○ Trabalho/App     │             │
│  └────────────────────┘ └────────────────────┘             │
│                                                             │
│  Cobertura                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Todas as opções                               ▼     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Calcular                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Resultado:                                                │
│                                                             │
│  Faixa FIPE: R$ 0 - R$ 50.000                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      Mensalidade estimada:                          │   │
│  │                                                     │   │
│  │      R$ 89,00  a  R$ 169,00/mês                    │   │
│  │      ─────────────────────────                      │   │
│  │      Plano Básico até Premium                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Critérios:                                                │
│  ✓ Uso particular                                          │
│  ✓ Veículo até 10 anos                                     │
│                                                             │
│  * Valores sujeitos a análise. Entre em contato            │
│    para cotação personalizada.                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Benefícios

1. **Coerência**: Valores baseados em critérios reais (tipo uso, idade veículo)
2. **Transparência**: Cliente entende que há uma faixa e quais fatores influenciam
3. **Rapidez**: Poucos campos, cálculo instantâneo
4. **Realismo**: Exibe min/max ao invés de valor único que pode frustrar

---

### Considerações Tecnicas

- Dados vêm da tabela `tabelas_preco` já existente
- Hook `useTabelasPreco` já busca as faixas
- Os fatores (15% e 20%) podem ser configuráveis via tabela `configuracoes`
- Se cobertura específica selecionada, filtra para mostrar apenas aquele plano

