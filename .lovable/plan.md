## Objetivo
Corrigir definitivamente o erro de geração de link para prestador quando o valor do serviço é deixado em branco, mantendo o comportamento já esperado pelo usuário: valor opcional.

## Diagnóstico confirmado
A regra já foi flexibilizada no frontend de atribuição manual/mapa e no fluxo `gerar-link-prestador` (instalação externa).

O erro persiste no fluxo de vistoria por prestador porque a edge function `gerar-link-vistoriador-prestador` ainda bloqueia nova atribuição com a validação:
- `if (!valor || valor <= 0) -> "Valor é obrigatório para nova atribuição"`

Ou seja: a interface já aceita valor vazio, mas essa branch específica do backend ainda rejeita `0`/vazio.

## Plano
1. Ajustar a edge function `gerar-link-vistoriador-prestador`
- Remover a obrigatoriedade de valor para nova atribuição.
- Normalizar valor vazio para `0` (ou `null`, conforme padrão já usado no insert) sem quebrar reenvio de link.
- Manter lançamento financeiro apenas quando `valor > 0`.
- Manter auditoria, WhatsApp e criação/reuso do token intactos.

2. Unificar o comportamento em todos os pontos de entrada
- Revisar e alinhar os chamadores de vistoria por prestador para o mesmo contrato funcional:
  - `src/hooks/useAtribuicaoManual.ts`
  - `src/components/monitoramento/AtribuicaoManualTab.tsx`
  - `src/components/mapa/AtribuirPrestadorPopover.tsx`
  - `src/components/instalacoes/PainelAtribuicaoPrestador.tsx`
- Garantir que todos tratem valor como opcional, sem uma tela exigir valor enquanto outra dispensa.

3. Corrigir a inconsistência restante no painel de atribuição de prestador
- Hoje `PainelAtribuicaoPrestador.tsx` ainda exige `valor > 0` para habilitar confirmação.
- Vou alinhar essa tela ao mesmo comportamento já adotado no mapa e na aba de atribuição manual:
  - campo continua disponível
  - preenchimento continua opcional
  - link pode ser gerado mesmo com valor vazio
  - financeiro só recebe lançamento se houver valor positivo

4. Validar o fluxo completo e evitar regressão
- Validar estes cenários após a correção:
  - gerar link de vistoria por prestador sem valor
  - gerar link com valor informado
  - reenviar link existente
  - gerar link de instalação externa sem valor
- Confirmar que o link abre normalmente e que não há novo bloqueio por backend.

5. Fechar o relato com a causa correta
- Após validar, atualizar a tratativa do relato para refletir a causa raiz real:
  - o frontend estava correto
  - a regressão estava na edge function `gerar-link-vistoriador-prestador`
- Só então marcar como concluído para novo teste do usuário.

## Detalhes técnicos
- Arquivo crítico: `supabase/functions/gerar-link-vistoriador-prestador/index.ts`
- Ponto exato da regressão: validação de criação de novo link ainda exige `valor > 0`
- Fluxo já correto para referência: `supabase/functions/gerar-link-prestador/index.ts`
- Inconsistência visual remanescente: `src/components/instalacoes/PainelAtribuicaoPrestador.tsx` ainda desabilita a confirmação quando `valor <= 0`

## Resultado esperado
Depois dessa correção, qualquer fluxo de atribuição para prestador deve permitir gerar o link sem informar valor, e o valor poderá continuar sendo definido depois pela operação, sem erro e sem retrabalho do usuário.