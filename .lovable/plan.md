## Objetivo

Remover o gate de **Diretor** dos pontos de bloqueio que ainda travam o fluxo, deixando o **botão "Ignorar e Prosseguir" disponível para qualquer usuário**, mantendo o registro auditado da decisão (já implementado em `cotacao_avisos_sga`) e o envio do histórico no campo `observacao` do veículo SGA (já implementado em `sga-hinova-sync`).

## Estado atual (auditado)

| # | Bloqueio | Arquivo | Bypass hoje |
|---|----------|---------|-------------|
| 1.1 | Placa duplicada (outro vendedor) | `CotacaoFormDialog` → `PlacaDuplicadaModal` | ✅ qualquer usuário |
| 1.2 | Veículo já existe no SGA | `CotacaoFormDialog` → `VeiculoSGAModal` | ✅ qualquer usuário |
| 1.3 | Placa de outro associado (base local) | `CotacaoFormDialog` → `PlacaOutroAssociadoModal` | ✅ qualquer usuário |
| 2.1 | CPF já é associado com veículo ativo | `DialogTipoOperacao` | Não é hard-block — oferece Substituição/Inclusão |
| 2.2 | Ex-cliente inadimplente (CPF) | `EtapaDadosAssociado` | ❌ só Diretor |
| 3.1 | Inclusão com débito (flag ativa) | `DialogTipoOperacao` | ❌ só Diretor |
| 4.1 | Boletos vencidos no Cadastro | `SituacaoFinanceiraGate` | ❌ só Diretor |

Os 3 últimos casos têm o diálogo `IgnorarAvisoSGADialog` pronto e o registro em `cotacao_avisos_sga` já funciona — falta apenas remover a checagem `isDiretor` que esconde o botão.

## Alterações

### 1. `src/components/cotacao/EtapaDadosAssociado.tsx` (caso 2.2)
- Remover a condição `isDiretor && !bypassDebitoSGA` do bloco que renderiza o botão "Ignorar e Prosseguir (Diretor)".
- Trocar label para `"Ignorar e Prosseguir"` (sem o sufixo "(Diretor)").
- Manter `IgnorarAvisoSGADialog` exigindo justificativa ≥ 5 caracteres.

### 2. `src/components/cotacao/DialogTipoOperacao.tsx` (caso 3.1)
- Remover `{isDiretor && (...)}` em volta do botão de bypass para inclusão de 2º veículo com débito; mostrar para qualquer usuário sempre que `bloqueioAtivo && temDebito`.
- Trocar label para `"Ignorar e Prosseguir"`.
- Remover import/uso de `usePermissions` se não houver mais consumo no arquivo.

### 3. `src/components/cadastro/SituacaoFinanceiraGate.tsx` (caso 4.1)
- Remover o `isDiretor &&` que esconde o botão de abrir o diálogo de bypass na linha 218.
- Manter o registro duplo: `bypass.mutate(...)` + `cotacao_avisos_sga` (já presente, com `tipo: cadastro_situacao_financeira_pendente`, `decisao: ignorado_prosseguiu`).
- Trocar o texto "Liberado por bypass do Diretor" para `"Liberado por decisão registrada"` para refletir que não é mais exclusivo de Diretor.
- Remover import/uso de `usePermissions` se não houver mais consumo.

### 4. Sem alterações
- Casos 1.1 / 1.2 / 1.3: bypass já universal e auditado.
- Caso 2.1: já é um fluxo de escolha, não bloqueio.
- Tabela `cotacao_avisos_sga`, hook `useRegistrarAvisoSGA`, edge `sga-hinova-sync` (concatenação no `observacao`): permanecem como estão.
- Nenhuma migração necessária.

## Resultado esperado

Em todos os 7 pontos listados, o usuário verá o aviso, poderá clicar **"Ignorar e Prosseguir"**, justificar, e o fluxo continua. Cada decisão fica em `cotacao_avisos_sga` com tipo, motivo, autor, e o histórico completo é enviado no campo `observacao` do veículo no SGA quando o veículo for sincronizado.
