
# Etapa 3: Conectar GerarTermo.tsx aos Hooks de Configuracao

## Diagnostico

`exigeRastreador` e importada em `GerarTermo.tsx` mas **nao e chamada** em nenhum lugar do componente. A tela usa dados mock e renderiza o template diretamente, sem verificar obrigatoriedade de rastreador no frontend.

## Alteracoes em `src/pages/cadastro/GerarTermo.tsx`

### 1. Importar os hooks

Adicionar import dos dois hooks existentes:

```typescript
import { useConfigFipeRastreador, useConfigFipeRastreadorMoto } from '@/hooks/useConfigRastreador';
```

### 2. Usar os hooks no componente

Dentro de `GerarTermo()`, chamar os hooks para ter os valores disponiveis:

```typescript
const { data: fipeMinCarro = 30000 } = useConfigFipeRastreador();
const { data: fipeMinMoto = 9000 } = useConfigFipeRastreadorMoto();
```

### 3. Calcular resultado do rastreador

Adicionar chamada efetiva a `exigeRastreador` usando os valores dos hooks:

```typescript
const rastreadorInfo = exigeRastreador(associado.veiculo, { fipeMinCarro, fipeMinMoto });
```

### 4. Exibir informacao visual (opcional mas util)

Adicionar um Badge na secao de dados do veiculo indicando se rastreador e obrigatorio:

```typescript
{rastreadorInfo.exige && (
  <Badge variant="destructive">Rastreador obrigatorio</Badge>
)}
```

Isso sera adicionado proximo ao campo "Valor FIPE" na grid de dados do veiculo.

## Arquivos nao alterados

- `src/types/termo-filiacao.ts` (funcao ja parametrizada)
- `src/hooks/useConfigRastreador.ts` (hooks ja prontos)
- Edge functions (ja corrigidas)
- Tabela `configuracoes`

## Resultado

Quando o valor na tabela `configuracoes` mudar, o hook do React Query buscara o novo valor (com staleTime de 10 min) e a tela refletira automaticamente se o rastreador e obrigatorio ou nao para aquele veiculo.
