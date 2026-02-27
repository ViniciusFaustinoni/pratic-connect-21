
# Etapa 2B: Alinhar termo-filiacao.ts com a Tabela de Configuracoes

## Diagnostico

A funcao `exigeRastreador` em `src/types/termo-filiacao.ts` usa R$ 20.000 hardcoded para carros (deveria ser R$ 30.000). Ela e importada em `GerarTermo.tsx` mas **nunca e chamada** no corpo do componente — apenas importada. Nenhum outro arquivo frontend a utiliza.

## Alteracoes

### 1. `src/types/termo-filiacao.ts` (linhas 191-208)

Parametrizar `exigeRastreador` para aceitar config opcional, identico ao padrao das edge functions:

```typescript
export const exigeRastreador = (
  veiculo: VeiculoData,
  config?: { fipeMinCarro: number; fipeMinMoto: number }
): { exige: boolean; motivo: string | null } => {
  if (veiculo.combustivel?.toLowerCase() === 'diesel') {
    return { exige: true, motivo: 'Veiculo a diesel' };
  }

  const thresholdCarro = config?.fipeMinCarro ?? 30000;
  const thresholdMoto = config?.fipeMinMoto ?? 9000;

  if (veiculo.tipo === 'carro' && veiculo.valorFipe > thresholdCarro) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdCarro.toLocaleString('pt-BR')}` };
  }

  if (veiculo.tipo === 'moto' && veiculo.valorFipe > thresholdMoto) {
    return { exige: true, motivo: `Valor FIPE acima de R$ ${thresholdMoto.toLocaleString('pt-BR')}` };
  }

  return { exige: false, motivo: null };
};
```

Mudancas concretas:
- Segundo parametro opcional `config?: { fipeMinCarro: number; fipeMinMoto: number }`
- Fallback de R$ 20.000 corrigido para R$ 30.000 (carro)
- Mensagem de motivo agora usa o valor dinamico em vez de string fixa

### 2. `src/pages/cadastro/GerarTermo.tsx`

Nenhuma alteracao necessaria. A funcao e importada mas nao chamada no componente. A assinatura continua compativel (parametro config e opcional).

## Impacto

- Retrocompativel: chamadas sem config continuam funcionando, agora com fallback correto (30k)
- Quando futuramente o GerarTermo ou outro componente chamar a funcao, podera passar valores do hook `useConfigFipeRastreador`
- Diesel inalterado, formato de retorno inalterado

## Arquivos nao alterados

- Edge functions (ja corrigidas na Etapa 2A)
- Hooks (`useConfigRastreador.ts`)
- Componentes do instalador
- Tabela `configuracoes`
