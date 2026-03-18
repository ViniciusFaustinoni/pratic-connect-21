
Objetivo: eliminar o “loop” entre assinatura e PIX atacando a causa raiz compartilhada, não apenas os sintomas.

1. Diagnóstico já confirmado
- O problema não é timeout nem fila: os logs mostram falha imediata por validação de CPF.
- A cotação `635fcf40-7c80-4965-a027-69b1fa91a8bd` está com `cliente_cpf = 126.936.697-37` no banco.
- O `document-ocr` extraiu exatamente esse CPF da CNH.
- `contrato-gerar` falha repetidamente ao validar esse CPF.
- `EtapaPagamentoCotacao` e `PagamentoAdesao` também validam esse mesmo CPF e/ou dependem do contrato gerado, então a falha “migra” entre assinatura e cobrança.

2. Causa raiz real dos dois problemas
A. Fonte de dados errada/confiada demais
- O OCR está alimentando o CPF da cotação sem uma etapa forte de confirmação manual quando o valor extraído é inválido matematicamente.
- Resultado: um CPF visualmente plausível entra no fluxo como se estivesse validado.

B. Orquestração duplicada do fluxo
Hoje o projeto tenta gerar contrato em vários lugares:
- `useCotacaoContratacao.ts` (geração automática após salvar dados)
- `EtapaAssinaturaContrato.tsx`
- `EtapaPagamentoCotacao.tsx`
- `confirmarPagamento` em `useCotacaoContratacao.ts`
Isso cria reprocessamento, repetição de erro e sensação de que “quando arruma um lado quebra o outro”.

C. Dependência circular entre etapas
- Pagamento ainda tenta gerar/recuperar contrato por conta própria.
- Assinatura e pagamento não estão isolados por responsabilidade.
- Ambos dependem do mesmo CPF persistido, então qualquer inconsistência explode em ambos.

3. Plano de correção
Fase 1 — Parar o loop
- Fazer da etapa de assinatura o único ponto que pode gerar contrato.
- Remover a geração de contrato de:
  - `useCotacaoContratacao.ts` após salvar dados
  - `EtapaPagamentoCotacao.tsx`
  - `confirmarPagamento` em `useCotacaoContratacao.ts`
- A etapa de pagamento deve apenas:
  - exigir `contrato_gerado_id`
  - exigir contrato existente
  - criar/consultar cobrança Asaas
- Se não houver contrato assinado/pronto, a UI deve orientar o usuário de volta para assinatura, sem tentar “consertar” gerando contrato de novo.

Fase 2 — Corrigir a origem do CPF
- No fluxo de documentos/dados (`EtapaDadosPessoaisDocumentos.tsx` + `useCotacaoContratacao.ts`):
  - validar CPF antes de persistir `cliente_cpf`
  - se o OCR extrair CPF inválido, não salvar como dado confirmado
  - mostrar erro claro e pedir correção manual/novo envio
- O OCR pode continuar extraindo, mas o sistema não deve promover automaticamente um CPF inválido para “fonte oficial”.

Fase 3 — Unificar a regra de leitura dos dados do cliente
- Centralizar a resolução de dados do cliente para contrato e cobrança.
- Regra proposta: para cotação pública, a prioridade deve ser a cotação atualizada (`cotacoes.*`), não dados antigos de lead.
- Aplicar a mesma regra em:
  - `supabase/functions/contrato-gerar/index.ts`
  - `supabase/functions/asaas-cobranca-adesao/index.ts`

Fase 4 — Melhorar a experiência de recuperação
- Quando o erro for CPF inválido:
  - mostrar mensagem objetiva
  - oferecer retorno direto para a etapa de dados/documentos
  - permitir corrigir a mesma cotação sem reiniciar o processo
- Isso evita a impressão de que precisa criar nova cotação.

4. Arquivos principais a ajustar
Frontend
- `src/hooks/useCotacaoContratacao.ts`
  - remover geração automática de contrato após salvar dados
  - remover nova chamada a `contrato-gerar` no pós-pagamento
  - bloquear avanço de status se CPF estiver inválido
- `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`
  - validar CPF OCR antes de submeter
  - exigir correção manual quando inválido
- `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`
  - manter como único lugar de geração do contrato
  - evitar reentradas duplicadas
- `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx`
  - parar de chamar `contrato-gerar`
  - usar apenas `contrato_gerado_id`
- `src/components/associado/PagamentoAdesao.tsx`
  - alinhar com a mesma regra do fluxo público

Edge Functions
- `supabase/functions/contrato-gerar/index.ts`
  - usar fonte única de dados
  - manter validação forte, mas sem participar de fluxo duplicado
- `supabase/functions/asaas-cobranca-adesao/index.ts`
  - usar a mesma resolução de CPF/nome/email
  - retornar erro específico e consistente
- Opcionalmente criar helper compartilhado em `supabase/functions/_shared/` para resolver os dados do cliente.

5. Resultado esperado
- Assinatura deixa de “brigar” com o PIX.
- PIX não tenta mais gerar contrato.
- Contrato é gerado uma vez, no lugar certo.
- OCR inválido não contamina mais a cotação.
- A mesma cotação pode ser corrigida e continuar o fluxo normalmente.
- O erro deixa de alternar entre “assinatura” e “pagamento”, porque ambos passam a usar a mesma fonte e uma ordem única de execução.

6. Critérios de aceite
- CPF inválido extraído por OCR não avança para assinatura nem cobrança.
- CPF corrigido na mesma cotação permite:
  - gerar contrato
  - enviar para Autentique
  - assinar
  - gerar cobrança PIX
- Reabrir a página não cria novo contrato nem nova cobrança indevidamente.
- Nenhuma etapa chama `contrato-gerar` fora da assinatura.

7. Observação importante sobre o caso atual
- A cotação atual está travada porque o CPF salvo nela hoje está inválido no banco.
- A implementação acima resolve o problema estrutural e também evita recorrência nas próximas cotações.
