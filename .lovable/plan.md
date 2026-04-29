# Plano para corrigir associados que voltam/ficam presos no Cadastro

## O que foi identificado

Há dois problemas combinados:

1. O endpoint `aprovar-proposta` está processando todos os veículos do associado, não apenas o veículo do contrato aprovado.
2. A fila de Cadastro (`usePropostasPendentes`) continua considerando propostas com vínculo operacional residual, mesmo quando o processo já avançou ou foi concluído.

Isso explica o comportamento “não linear”: Cadastro → Monitoramento → instalação/vistoria → volta para Cadastro.

## Evidência principal encontrada

### Caso do Marcos
- Contrato `CTR-20260428214640-3UW9KI` está `ativo`
- Associado está `ativo`
- Veículo do contrato `KOS1G37` está `ativo`
- Mas o mesmo contrato tem duas instalações:
  - uma `concluida` para outro veículo (`LTB4J74`)
  - outra `agendada` para `KOS1G37`

Ou seja: o contrato do Marcos ficou com instalações de veículos diferentes. Isso é sintoma direto do loop em `aprovar-proposta` que percorre todos os veículos do associado.

### Escopo do problema no banco
Foram encontrados:
- 8 instalações onde `instalacoes.veiculo_id != contratos.veiculo_id`
- 1 contrato `ativo` ainda com instalação `agendada`
- vários contratos com múltiplas instalações ligadas ao mesmo contrato

## Correção proposta

### 1) Corrigir a origem do bug no backend
Ajustar `supabase/functions/aprovar-proposta/index.ts` para:
- operar somente sobre o `veiculo_id` do contrato aprovado
- parar de criar instalações para todos os veículos do associado
- validar explicitamente que a instalação criada pertence ao mesmo veículo do contrato
- reforçar idempotência por `contrato_id + veiculo_id`
- impedir que o fluxo normal de proposta gere instalações “órfãs” ou cruzadas

### 2) Blindar a leitura da fila de Cadastro
Ajustar `src/hooks/usePropostasPendentes.ts` para:
- não exibir propostas já finalizadas operacionalmente
- usar somente instalações/vistorias compatíveis com o veículo do contrato
- ignorar instalações antigas, cruzadas ou residuais
- considerar como fora da fila qualquer proposta já ativada de fato

Também ajustar a estatística (`usePropostaStats`) para não contar casos já concluídos.

### 3) Corrigir a tela de detalhe da proposta
Ajustar `useProposta` / `PropostaAnalise` para:
- carregar a instalação correta do veículo do contrato
- não montar a tela com instalação concluída de outro veículo
- não sugerir retorno para análise quando já houve ativação final

### 4) Saneamento em massa dos casos já quebrados
Executar uma limpeza controlada dos registros afetados para:
- localizar contratos com instalações de veículo diferente
- cancelar/encerrar instalações agendadas residuais que não deveriam existir
- manter apenas a trilha operacional correta por contrato/veículo
- reativar corretamente casos que concluíram o processo mas ficaram com contrato/status inconsistente

Importante: qualquer ativação de associado/contrato/veículo continuará passando pela edge function `ativar-associado`.

### 5) Validar ponta a ponta com casos reais
Depois da correção:
- validar novamente o caso do Marcos
- validar pelo menos um caso com instalação agendada normal
- validar pelo menos um caso previamente preso no Cadastro
- confirmar que, após aprovação final, o associado não reaparece na fila

## Arquivos que devem ser ajustados

- `supabase/functions/aprovar-proposta/index.ts`
- `src/hooks/usePropostasPendentes.ts`
- `src/pages/cadastro/PropostaAnalise.tsx`
- possivelmente `src/pages/cadastro/PropostasPendentes.tsx` se houver badge/estado derivado incorreto

## Saneamento técnico

Além da correção do código, vou preparar uma rotina para levantar e limpar todos os contratos afetados por:
- instalações duplicadas no mesmo contrato
- instalação vinculada a veículo diferente do contrato
- contrato ativo com instalação agendada residual
- contrato assinado mas associado/veículo já ativo

## Observação de teste visual

Tentei abrir a fila no browser para confirmar visualmente, mas a sessão caiu na tela de login. Posso verificar isso visualmente depois da implementação usando o acesso autorizado de diretor.

## Detalhes técnicos

```text
Problema atual:
contrato X (veículo A)
  -> aprovar-proposta percorre veículos do associado
  -> cria/usa instalação para veículo B
  -> monitoramento/instalação conclui B
  -> contrato/associado podem ativar
  -> sobra instalação agendada de A
  -> fila de Cadastro/Operação ainda encontra etapa residual
  -> associado parece “voltar” para o Cadastro
```

```text
Estado desejado:
contrato X -> veículo A somente
  -> uma trilha operacional coerente
  -> uma instalação válida por contrato+veículo no fluxo normal
  -> após ativação final, sai definitivamente da fila de Cadastro
```

Se aprovar, eu executo a correção e já deixo o saneamento dos casos presos preparado e aplicado.