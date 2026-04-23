
## Correção do erro na cotação: “Campos obrigatórios de valor ainda não calculados”

### Diagnóstico confirmado
O erro está no fluxo já existente da cotação rápida, não na criação da cotação em si.

Hoje o `CotacaoFormDialog.tsx` bloqueia a criação quando qualquer um destes campos está zerado:
- `valor_fipe`
- `valor_cota`
- `valor_total_mensal`

Esse bloqueio acontece aqui:
- `src/components/cotacoes/CotacaoFormDialog.tsx` linhas ~1470–1475

O problema raiz está no hook moderno que calcula os planos:
- `src/hooks/usePlanosCotacao.ts`

Nele, os valores detalhados são montados assim:
- `taxaAdministrativa` calculada
- `valorRastreamento` calculado
- `valorAssistencia` calculado
- `valorCota` está fixo em `0`

Ou seja:
- a mensalidade aparece corretamente no card
- o formulário copia `valorCota = 0` para o estado interno
- ao confirmar, a pré-validação entende que “o cálculo não terminou”
- por isso a cotação é barrada com exatamente o erro do print

### Implementação proposta
#### 1. Corrigir a decomposição financeira no hook de planos
Arquivo:
- `src/hooks/usePlanosCotacao.ts`

Ajustar a montagem dos campos derivados para seguir o mesmo padrão já usado no fluxo legado/avançado:
- `valorCota = valorMensal * decomposicao.cota`
- `taxaAdministrativa = valorMensal * decomposicao.admin`
- `valorRastreamento = valorMensal * decomposicao.rastreamento`
- `valorAssistencia = valorMensal * decomposicao.assistencia`

Isso elimina a origem do `valor_cota = 0` e centraliza a correção em um único lugar.

#### 2. Manter a pré-validação de criação
Arquivo:
- `src/components/cotacoes/CotacaoFormDialog.tsx`

Não vou remover a trava de `valor_cota > 0` neste primeiro ajuste, porque ela está correta como proteção contra payload incompleto.

Com a correção no hook, o fluxo deve voltar a funcionar sem precisar afrouxar a regra.

#### 3. Garantir que o formulário continue recebendo os valores recalculados
Arquivo:
- `src/components/cotacoes/CotacaoFormDialog.tsx`

Validar o ponto em que o plano selecionado é copiado para o form:
- `form.setValue('valor_cota', plano.valorCota || 0)`
- `form.setValue('taxa_administrativa', ...)`
- `form.setValue('valor_rastreamento', ...)`
- `form.setValue('valor_total_mensal', ...)`

Se necessário, complementar a sincronização para evitar que o modal de confirmação use snapshot desatualizado quando o plano recalcula após mudança de cenário/região/FIPE.

### Validação após a correção
Revalidar exatamente o cenário reportado:
- veículo: Toyota Corolla XEi Flex 2014
- FIPE: R$ 72.122,00
- plano: Select Exclusive Passeio
- vencimento: 25
- cenário: Isenta adesão + base

Confirmar que:
- o card continua mostrando a mensalidade correta
- `valor_cota` deixa de ir zerado
- o erro “Campos obrigatórios de valor ainda não calculados” desaparece
- a cotação é criada com sucesso
- `cenario_adesao = isenta_base`
- `tipo_instalacao = base`
- `dia_vencimento = 25`
- `valor_adesao = 0`

### Impacto esperado
A correção é localizada e de baixo risco:
- resolve a falha da cotação rápida
- preserva a validação defensiva já existente
- beneficia qualquer tela que consome `usePlanosCotacao` e usa os campos detalhados do plano

### Arquivos envolvidos
- `src/hooks/usePlanosCotacao.ts`
- `src/components/cotacoes/CotacaoFormDialog.tsx`
