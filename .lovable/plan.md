Plano para corrigir o fluxo de pendências documentais no link público e facilitar o envio manual pelo Cadastro.

Diagnóstico confirmado
- Existe 1 pendência real recente para ALEX DE OLIVEIRA SILVA: documento `chassi`, status `pendente`, associado em `documentacao_pendente`.
- O WhatsApp enviado em 22/04 usou `https://app.praticcar.org/acompanhar/09fe56fe-30ce-4d2d-adc0-64a971a372f3` e foi registrado como `enviada` via Meta.
- O payload/mensagem possui o link, mas o template Meta `documentacao_pendente` só recebe nome + documentos; o botão dinâmico não recebe link específico de pendências.
- Há histórico antigo com URLs de preview/lovableproject e um erro Meta `132018` por incompatibilidade de parâmetros do template.
- A tela pública já tenta priorizar pendências, mas precisa ficar mais resiliente para `/cotacao/:token` e `/acompanhar/:token`, especialmente quando o status muda e a query de documentos ainda não carregou.

Implementação proposta

1. Corrigir a URL padrão das pendências
- Centralizar a montagem do link público em `useSolicitarDocumentos` usando sempre `https://app.praticcar.org`.
- Priorizar `/acompanhar/:link_token` quando existir, pois é o token do contrato já assinado e é o link usado para acompanhamento.
- Usar `/cotacao/:cotacao_token_publico` apenas como fallback.
- Retornar o `linkPendencias` no resultado da mutation para a tela de Cadastro conseguir exibir/copiar o link após solicitar documentos.

2. Mostrar link copiável para o analista de Cadastro
- Após criar pendências, manter o analista na proposta ou exibir feedback antes de navegar, com um bloco destacado:
  - “Link público para envio das pendências”
  - campo com URL completa
  - botão “Copiar link”
  - orientação: “Você também pode enviar manualmente este link ao associado.”
- Incluir o mesmo link no card de solicitações pendentes (`DocumentosSolicitadosCard`) quando houver `contratoId`/`associadoId`, para o analista poder copiar depois, não só no momento da solicitação.
- Evitar ação destrutiva; apenas copiar para clipboard e exibir toast.

3. Garantir que o link público atualize para pendências
- Em `/cotacao/:token`, manter a prioridade das pendências antes das demais etapas, mas ajustar o estado `documentacao_pendente` para não ficar preso em “carregando” se a consulta retornar vazia/erro.
- Em `/acompanhar/:token`, adicionar refetch/realtime/invalidação para `documentos_solicitados` e `associados`, não depender só do polling de 30s.
- Ao receber alteração realtime, invalidar `acompanhamento-proposta` e atualizar imediatamente a tela.
- Garantir que `DocumentosPendentesPublico` seja exibido quando existirem pendências, independentemente da etapa atual do fluxo.

4. Ajustar payload de WhatsApp/Meta para não perder o link
- Atualizar `notificar-cliente` para que `documentos_solicitados` envie o link completo no corpo da mensagem e, se o template tiver botão dinâmico, usar `link_token` correto como `template_button_params`.
- Registrar logs mais claros no console da Edge Function: tipo, associado, documentos, link recebido, template usado e retorno do envio.
- Não alterar template Meta em banco sem necessidade; a correção principal será garantir payload consistente e fallback textual com link completo.

5. Auditoria nos logs do sistema
- Registrar em `logs_auditoria` quando uma solicitação de documentos for criada:
  - usuário/analista (`profile.id`, nome se disponível)
  - contrato/associado
  - documentos solicitados
  - motivo/observação
  - link público gerado
  - status da notificação quando disponível
- Isso permitirá a Diretoria rastrear quando e qual link foi disponibilizado/enviado.

6. Validação pós-implementação
- Conferir a query de pendências para um contrato com `documentacao_pendente`.
- Testar que o card no Cadastro mostra o link copiável.
- Testar que `/acompanhar/:link_token` e `/cotacao/:cotacao_token_publico` exibem `DocumentosPendentesPublico` quando há `documentos_solicitados.status = pendente`.
- Revisar logs/payloads de WhatsApp e auditoria para confirmar URL de produção e dados da decisão.

Arquivos previstos
- `src/hooks/usePropostasPendentes.ts`
- `src/pages/cadastro/PropostaAnalise.tsx`
- `src/components/cadastro/DocumentosSolicitadosCard.tsx`
- `src/pages/public/AcompanhamentoProposta.tsx`
- `src/pages/public/CotacaoContratacao.tsx`
- `supabase/functions/notificar-cliente/index.ts`

Observação
- Não vou criar nova tabela inicialmente. A estrutura existente (`documentos_solicitados`, `logs_auditoria`, `link_token` e `cotacao_token_publico`) já atende à correção.