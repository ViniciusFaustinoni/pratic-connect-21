

# Calculadora Aprimorada — Regras do Cotador + Atalho para Cotação

## Resumo

Melhorar a Calculadora de Preço existente para exibir informações completas de cada plano (como no cotador), mantendo a simplicidade de consulta rápida. Ao final, um botão "Ir para Cotação" abre o CotacaoFormDialog já pré-preenchido com os dados informados na calculadora.

## O que muda na Calculadora

### Dados adicionais por plano (já disponíveis via `usePlanosCotacao`)

Cada card de resultado passa a exibir:
- **Valor mensal** (já existe)
- **Taxa de adesão** estimada (1% FIPE, mín. configurado)
- **Cota de participação** (ex: "10% da FIPE — mín. R$ 3.000")
- **Cobertura FIPE** (ex: "100% FIPE" ou "70% FIPE")
- **Coberturas principais** (lista resumida dos itens inclusos)
- **Opções de vencimento** (usando `calcularOpcoesVencimento` do utilitário já criado)

### Botão "Ir para Cotação"

Ao clicar em um plano no resultado, ou em um botão geral "Criar Cotação", o sistema:
1. Fecha a calculadora
2. Abre o `CotacaoFormDialog` com prop `cotacaoBase` preenchida com: valor FIPE, marca, modelo, ano, placa, região, categoria, plano selecionado
3. O consultor continua o fluxo normal do cotador, sem redigitar

### Fonte de dados

Trocar o cálculo manual atual por `usePlanosCotacao` (o mesmo hook do cotador), que já retorna coberturas, cotas, adesão, etc. Isso garante paridade total entre calculadora e cotador.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/planos/CalculadoraPreco.tsx` | Refatorar: usar `usePlanosCotacao`, exibir dados extras, botão "Ir para Cotação" |
| `src/pages/vendas/PlanosBeneficios.tsx` | Adicionar state para abrir `CotacaoFormDialog` com dados da calculadora |

## Detalhes técnicos

### CalculadoraPreco.tsx

- Substituir a lógica manual de cálculo (`calcular()`) por chamada a `usePlanosCotacao({ valorFipe, regiao, combustivel, categoria, anoVeiculo, tipoVeiculo, usoApp })` quando o usuário clica "Calcular"
- Manter os mesmos campos de entrada (placa, FIPE, ano, tipo veículo, região, combustível, uso)
- No resultado, cada plano exibe um card expandido com: mensalidade, adesão estimada, cota, cobertura FIPE, coberturas resumidas
- Linha inferior com as opções de vencimento (usando `calcularOpcoesVencimento(new Date().getDate())`)
- Botão "Criar Cotação" em cada plano que chama `onIrParaCotacao(dadosPreenchidos)`

### PlanosBeneficios.tsx

- Adicionar estado `cotacaoBaseCalculadora` e `showCotacaoCalculadora`
- Importar `CotacaoFormDialog` 
- A calculadora recebe um callback `onIrParaCotacao` que seta esses estados
- O `CotacaoFormDialog` abre com a prop `cotacaoBase` preenchida

### Dados da adesão

Buscar `useTaxaAdesaoPercentual()` e `useTaxaAdesaoMinimoBase()` (hooks já existentes) para calcular a estimativa de adesão: `Math.max(valorFipe * percentual / 100, minimo)`.

