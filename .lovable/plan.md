## Objetivo

Adicionar na Etapa 2 da Cotação (`/vendas/cotacao`) um toggle **"Veículo dentro da Agência (0km)"**. Quando ativo, oculta toda a UI de consulta/preenchimento FIPE (placa, botão "Consultar FIPE", seletor de variantes, alternativas, indicadores de auto-preenchimento) e exibe apenas:
- Marca, Modelo, Ano (manuais)
- **Valor da Nota Fiscal** (campo monetário) — usado em todo o cálculo no lugar do `valorFipe`

O valor da nota alimenta `valorFipe` no estado da cotação, de modo que `usePlanosCotacao`, depreciação, taxa de adesão (% sobre FIPE), regra do 1%, etc., funcionam sem nenhuma mudança nos hooks/cálculos a jusante.

## Mudanças

### 1. `src/components/cotacao/EtapaConsultaFipe.tsx`
- Adicionar prop `modoNotaFiscal: boolean` e `setModoNotaFiscal: (v: boolean) => void`.
- No topo do `CardContent`, render do `Switch` (shadcn) com label **"Veículo dentro da Agência (0km)"** e descrição curta ("Use o valor da Nota Fiscal no lugar da FIPE").
- Quando `modoNotaFiscal === true`:
  - Não renderizar: input de placa + botão "Consultar FIPE", alerta de variantes FIPE, badges de auto-preenchimento.
  - Limpar `placa`, `veiculoEncontrado`, `fipeAlternativas`, `camposAutoPreenchidos` ao ativar.
  - Renderizar Marca / Modelo / Ano (sem ícone "auto-preenchido") + campo **"Valor da Nota Fiscal"** (substituindo o label "Valor FIPE", reaproveitando `valorFipe`/`setValorFipe` com `parseCurrency`/`formatCurrency` já existentes).
  - `canProceed` continua exigindo marca, modelo, ano e valor > 0.
- Quando `modoNotaFiscal === false`: comportamento atual inalterado.

### 2. `src/pages/vendas/Cotacao.tsx`
- Novo estado: `const [modoNotaFiscal, setModoNotaFiscal] = useState(false);`
- Resetar em `handleNovaCotacao`.
- Passar props para `EtapaConsultaFipe`.
- Em `handleEtapa2Next`: se `modoNotaFiscal`, **não** sobrescrever campos com `veiculoEncontrado` (forçar `setModoEntrada('manual')` e manter `placa` vazia).
- Em `handleIniciarCadastro` / `handleGerarPDF`: nada muda — `valorFipe` já carrega o valor da nota; placa segue vazia ou o que o usuário digitou.
- (Opcional, não requerido agora) propagar flag `origem_valor: 'nota_fiscal' | 'fipe'` no `dadosCotacao` para o contrato saber a origem.

### 3. `src/components/cotacao/EtapaResultado.tsx` (ajuste mínimo de label)
- Quando `modoNotaFiscal` (passar como prop opcional `origemValor?: 'fipe' | 'nota'`), trocar o label exibido "Valor FIPE: R$ X" para "Valor da Nota: R$ X" no resumo do veículo. Sem mudança em cálculo.

## Detalhes técnicos

- Os hooks de cálculo (`usePlanosCotacao`, taxa de adesão, depreciação, regra do 1%) já operam sobre `valorFipe: number`. Reutilizar esse mesmo campo evita duplicação e mantém compatibilidade com Aprovações por FIPE alta, regra do 1%, etc.
- Não alteramos schema de banco nesta entrega; o valor da nota é tratado como FIPE para fins de cálculo.
- Toggle implementado com `<Switch />` do shadcn já existente no projeto.
- Detecção de tipo de veículo (`useDetectarTipoVeiculo(marca, modelo)`) continua funcionando porque marca/modelo seguem preenchidos.

## Fora de escopo

- Persistir flag `origem_valor` no banco (`cotacoes`/`contratos`).
- Replicar o toggle no fluxo público (`/cotacao-publica/...`) — só `/vendas/cotacao`. Confirmar antes se também é desejado no público.