## Objetivo
Permitir que a placa da troca de titularidade siga no `CotacaoFormDialog` padrão após a assinatura do termo de cancelamento, sem ser barrada pelas travas normais de cotação/veículo que valem para cotação avulsa.

## Diagnóstico confirmado
- A solicitação de troca da placa `KOU6D37` está em `aguardando_cadastro` e o termo já foi assinado.
- Não existe cotação vinculada nessa solicitação ainda.
- O cotador trava antes de avançar porque o fluxo padrão ainda aplica bloqueios globais de placa.
- Há uma cotação anterior para a mesma placa (`COT-20260512-182512266-652`, status `aceita`) e ela dispara o modal `Placa Já em Atendimento`.
- Além disso, no fluxo de troca a placa também pode cair nas travas de:
  - veículo já existente no SGA
  - veículo já vinculado a associado na base local

## O que vou implementar
1. Detectar no `CotacaoFormDialog` quando ele foi aberto por `origemTroca`.
2. Criar um modo de exceção controlada para esse caso, válido somente quando:
   - existe `origemTroca`, e
   - a solicitação veio do fluxo oficial de troca.
3. No modo de troca, não bloquear a busca da placa por:
   - cotação ativa existente para a mesma placa
   - veículo existente no SGA
   - veículo já vinculado na base local
4. Manter todas essas travas intactas para o cotador normal.
5. Preservar o restante do fluxo atual:
   - abrir o modal padrão de cotação
   - criar a cotação apenas ao salvar
   - vincular via `vincular-cotacao-troca`

## Arquivos a ajustar
- `src/components/cotacoes/CotacaoFormDialog.tsx`
- Se necessário, pequeno ajuste no ponto que abre o dialog para passar melhor contexto de troca, sem alterar regra de negócio.

## Resultado esperado
- Na troca de titularidade, após o termo assinado, a placa `KOU6D37` poderá ser cotada normalmente no modal padrão.
- A cotação normal fora da troca continuará protegida pelas travas atuais.
- A placa só ficará vinculada à nova cotação quando o plano for salvo, como já foi desenhado.

## Validação
- Reabrir a troca da placa `KOU6D37`.
- Clicar em `Realizar Cotação`.
- Buscar a placa no cotador.
- Confirmar que não aparece mais `Placa Já em Atendimento` nem bloqueio por veículo já existente nesse fluxo.
- Salvar com um plano e verificar que a nova cotação foi vinculada à solicitação de troca.

## Detalhes técnicos
- O bloqueio atual acontece no método `buscarPorPlaca()` do `CotacaoFormDialog`, antes do carregamento FIPE.
- A correção será restrita por condição de origem (`origemTroca`) para evitar abrir exceção no cotador comum.
- Não vou reintroduzir a antiga criação de cotação avulsa.