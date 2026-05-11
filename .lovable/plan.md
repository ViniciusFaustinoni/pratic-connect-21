## Problema

No modal **Aprovação do Monitoramento → Troca de Titularidade**, dois blocos não puxam dados reais:

- **Aba "Financeiro Antigo"** mostra sempre `0 / 0 / 0` e badge "ADIMPLENTE" mesmo quando o associado tem boletos em aberto no SGA. Hoje o componente `RelatorioFinanceiroAntigo` lê apenas a tabela local `cobrancas` (que normalmente está vazia para associados antigos vindos do SGA).
- **Bloco "Rastreador"** dentro do `VeiculoCompletoCard` usa `useRastreadorTempoReal(rastreador.id, false)` com `autoRefresh=false`, então só busca posição se o usuário clicar em "Atualizar"; e quando o veículo não tem `rastreadores.veiculo_id` vinculado, ele simplesmente diz "Sem rastreador instalado" mesmo havendo equipamento ativo no SGA/Softtruck.

## Endpoints corretos (já em uso e funcionando em outras telas)

- **Financeiro do associado antigo:** edge function `sga-listar-boletos-associado` via hook `useBoletosSgaPorAssociado(codigoHinova, cpf, enabled)` — é o mesmo que a tela de **criação** da troca usa (`TrocaTitularidadeDialog`) e que já popula veículos + saldo + boletos abertos.
- **Rastreador em tempo real:** hook `useRastreadorTempoReal(rastreadorId, autoRefresh=true)` (mesmo usado em `MapaRastreador`/drawers de rastreador) — basta habilitar `autoRefresh` quando o modal está aberto.

## Mudanças

### 1. `src/components/troca-titularidade/RelatorioFinanceiroAntigo.tsx`

- Trocar a query local por `useBoletosSgaPorAssociado(codigo_hinova, cpf)` (props expandidas).
- Calcular contagens diretamente a partir do payload SGA:
  - **Vencidas** = `veiculos[].boletos_abertos` cujo `data_vencimento < hoje`.
  - **A vencer** = boletos abertos com vencimento `>= hoje`.
  - **Total em atraso** = soma dos `valor` das vencidas.
  - **Adimplente** = `!sgaPayload.tem_debito && vencidas.length === 0`.
- Estados:
  - Loading → skeleton.
  - `erro_transitorio` → alert amarelo "SGA indisponível, tente novamente" + botão `refetch`.
  - `encontrado=false` → alert "Associado não encontrado no SGA — sincronize antes de prosseguir" (sem inferir adimplência).
  - Sucesso → cards atuais (Vencidas / A vencer / Pagas) usando dados SGA; "Pagas" deixa de existir (SGA não traz histórico) e é substituído por **Saldo devedor total** do payload (`saldo_devedor_total`).
- Manter a listagem dos primeiros 10 boletos vencidos com vencimento + valor.

### 2. `src/components/troca-titularidade/ModalDetalhesTroca.tsx`

- Carregar `codigo_hinova` do associado antigo (1 select adicional em `associados` ou expandir o select existente em `useSolicitacaoTroca` — preferimos expandir o hook).
- Passar `codigoHinova` + `cpf` para `<RelatorioFinanceiroAntigo />`.

### 3. `src/hooks/useSolicitacoesTroca.ts`

- Em `useSolicitacaoTroca`, incluir `codigo_hinova` no select do `associado_antigo:associados!associado_antigo_id(...)`.
- Adicionar o campo na interface `SolicitacaoTroca.associado_antigo`.

### 4. `src/components/troca-titularidade/VeiculoCompletoCard.tsx` (bloco Rastreador)

- Trocar `useRastreadorTempoReal(rastreador.id, false)` por `useRastreadorTempoReal(rastreador.id, true)` para auto-buscar posição ao abrir o modal.
- Quando `posicao` existir, exibir abaixo do grid: `Velocidade`, `Lat/Lng` (mono) e `Endereço` (se vier do payload), iguais ao `MapaRastreador`.
- Se `useVeiculoCompleto` retornar `rastreador=null` mas houver rastreador vinculado por outro caminho (ex.: `rastreadores.contrato_id`), incluir um fallback no hook: buscar `rastreadores` também por `contrato_id` quando `veiculo_id` for nulo. Isso evita o "Sem rastreador" falso para registros antigos.

### 5. (Opcional, baixo risco) `src/hooks/useVeiculoDetalhes.ts → useVeiculoCompleto`

- Melhorar a busca do rastreador: primeiro tentar `eq('veiculo_id', veiculoId)`; se vazio, tentar via `contrato_id` do contrato resolvido. Manter o select atual.

## Arquivos afetados

- `src/components/troca-titularidade/RelatorioFinanceiroAntigo.tsx`
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
- `src/components/troca-titularidade/VeiculoCompletoCard.tsx`
- `src/hooks/useSolicitacoesTroca.ts`
- `src/hooks/useVeiculoDetalhes.ts`

## Resultado esperado

- Aba "Financeiro Antigo" passa a refletir o SGA: contagens corretas, saldo devedor total e badge ADIMPLENTE/INADIMPLENTE coerente com a régua de débito que já trava a aprovação no backend.
- Bloco "Rastreador" carrega posição em tempo real ao abrir o modal e identifica equipamento mesmo quando o vínculo está só no contrato.
- Nenhuma duplicação de lógica: tudo passa pelos hooks/edge functions já consagrados nas telas de criação da troca e de monitoramento de rastreadores.
