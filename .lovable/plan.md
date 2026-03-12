
Diagnóstico confirmado: a tela está “travada” porque a cotação do Marcus ficou apontando para o contrato errado.

1) Evidência objetiva (base de dados)
- Cotação `COT-20260312-175611775-441` (`ae30f9d8...`) está em `status_contratacao = documentos_ok` e `contrato_gerado_id = b31109b1...`.
- Existem 2 contratos para a mesma cotação:
  - `6f48a326...` (`CTR-...-LWYFUM`) -> `assinado`
  - `b31109b1...` (`CTR-...-H6PWS8`) -> `pendente_assinatura`
- O fluxo público consulta o contrato vinculado/mais recente e fica sincronizando o pendente, então nunca avança etapa.

2) Causa raiz
- Geração duplicada de contrato (condição de corrida no fluxo público).
- `contrato-gerar` não está protegido contra concorrência de forma robusta para `cotacao_id`.
- UI confia em um único `contrato_gerado_id` e não reconcilia quando há duplicidade (ex.: já existe um contrato assinado para a mesma cotação).

3) Correção (implementação)
- Hotfix de dados deste caso:
  - Reapontar `cotacoes.contrato_gerado_id` para o contrato assinado (`6f48a326...`).
  - Atualizar `cotacoes.status_contratacao` para `contrato_assinado`.
  - Marcar o contrato duplicado pendente (`b31109b1...`) como cancelado e registrar histórico.
- Blindagem de recorrência:
  - `supabase/functions/contrato-gerar/index.ts`: tornar idempotente por cotação (reuso de contrato existente + tratamento de corrida).
  - Criar migração com restrição de unicidade por `cotacao_id` (estratégia parcial para permitir cancelados históricos).
  - `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`: proteger inicialização para não disparar múltiplas gerações em re-render e sempre preferir contrato assinado se houver mais de um.
  - `src/hooks/useCotacaoContratacao.ts`: fallback de contrato deve priorizar `assinado/ativo` em vez de “mais recente”.
  - `autentique-sync-contrato` e `autentique-webhook`: ao assinar contrato, sincronizar também `cotacoes.status_contratacao = contrato_assinado`.

4) Detalhes técnicos (resumo)
- Arquivos alvo:
  - `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`
  - `src/hooks/useCotacaoContratacao.ts`
  - `supabase/functions/contrato-gerar/index.ts`
  - `supabase/functions/autentique-sync-contrato/index.ts`
  - `supabase/functions/autentique-webhook/index.ts`
  - nova migration SQL (unicidade + saneamento de duplicados)
- Critério de sucesso:
  - 1 contrato ativo por cotação.
  - Ao assinar, a etapa pública sai de “Contrato” para “Vistoria” automaticamente.
  - Nenhum novo caso de dupla criação para a mesma cotação.
