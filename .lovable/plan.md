
## Diagnóstico
- O backend já está funcionando: o link é gerado e salvo no banco. A evidência é que o contrato mais recente já possui `autentique_url` e os logs de `autentique-create` confirmam o salvamento do link. Portanto, o problema atual é de sincronização da UI, não da Autentique.
- O componente `EtapaAssinaturaContrato` ainda pode entrar em `aguardando_assinatura` sem consolidar um `contratoId` local estável. Quando isso acontece, os dois pollings retornam cedo porque dependem de `contrato?.id`, e a tela fica presa em “Aguarde...”.
- Há corrida de inicialização: os logs mostram chamadas duplicadas de `contrato-gerar` e `autentique-create`, inclusive com erro de unicidade. Isso aumenta a chance de estado local inconsistente.
- A página pública não escuta `contratos` em realtime; hoje ela escuta `cotacoes`, `vistorias`, `documentos_solicitados` e `associados`. Então, quando só `contratos.autentique_url` muda, a página não se atualiza sozinha.

## Plano definitivo de correção
1. `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`
   - Separar o estado mínimo crítico em variáveis independentes: `contratoId`, `contratoNumero`, `autentiqueDocumentoId`, `linkAssinatura`, `statusContrato`.
   - Garantir que `contratoId` seja preenchido imediatamente a partir de `contrato_gerado_id`, `contratoData.id` ou resposta do `contrato-gerar`, antes de entrar em `aguardando_assinatura`.
   - Trocar todos os guards e pollings que usam `contrato?.id` para usar `contratoId`.
   - Em `enviarParaAutentique`, atualizar `linkAssinatura` local assim que a edge function retornar `signatureLink`, sem depender do objeto `contrato`.

2. Eliminar chamadas duplicadas
   - Adicionar refs de trava (`initRef`, `processingRef`, `sendingRef`) para impedir dupla execução em StrictMode/re-render/retry.
   - Fazer `verificarOuGerarContrato` e `enviarParaAutentique` respeitarem essas travas e só liberarem nova execução quando o fluxo terminar ou falhar.

3. Realtime verdadeiro para o link
   - No próprio `EtapaAssinaturaContrato`, abrir um `publicSupabase.channel(...)` para a tabela `contratos`, filtrado pelo `contratoId`.
   - Em cada `UPDATE`, atualizar imediatamente `linkAssinatura`, `autentiqueDocumentoId` e `statusContrato`.
   - Se o status virar `assinado`/`ativo`, avançar a etapa na hora com `onContratoAssinado`.
   - Manter o polling de 3s/15s apenas como fallback, não como mecanismo principal.

4. `src/hooks/useCotacaoContratacao.ts`
   - Adicionar `contratos` às subscriptions realtime do fluxo público.
   - Invalidar `['contrato-publico-fallback', token]` e `['cotacao-contratacao', token]` quando o contrato mudar.
   - Ampliar `contratoFallback` para buscar também `numero`, `autentique_url` e `autentique_documento_id`, não só `status` e `link_token`.

5. `src/pages/public/CotacaoContratacao.tsx`
   - Passar para `EtapaAssinaturaContrato` os dados iniciais do contrato já conhecidos pela página.
   - Se necessário, usar uma `key` estável baseada em `cotacao.id` + `contratoId` para remontar com segurança quando o contrato aparecer.

## Resultado esperado
- O link/botão “Assinar Contrato Agora” aparece automaticamente assim que `autentique_url` for gravada.
- A atualização acontece em dois níveis: local imediato (resposta da edge function) e realtime real (update em `contratos`).
- A tela deixa de travar em “Aguarde...” por falta de estado local consistente.
- O fluxo para de disparar `contrato-gerar` / `autentique-create` em duplicidade.

## Observação técnica importante
- Não é necessária nova correção na Autentique para este problema.
- Também não há indicação de nova migration obrigatória para o link; o foco agora é consolidar o estado no frontend e escutar `contratos` em tempo real.

## Validação obrigatória
- Testar ponta a ponta estes cenários:
  1. cotação sem contrato prévio;
  2. contrato existente sem link;
  3. link gerado alguns segundos depois;
  4. contrato assinado avançando automaticamente para a próxima etapa.
- Confirmar nos logs que existe apenas 1 chamada de `contrato-gerar` e 1 de `autentique-create` no fluxo normal.
