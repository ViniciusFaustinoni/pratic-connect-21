## Problema

Na proposta `CTR-20260512100945-NQE90C` o cliente reenviou 1 documento (CNH) via fluxo de "Solicitar Documentos". O cabeçalho mostra corretamente "Reanálise — 1 documento(s) reenviado(s)", porém:

- O painel **Documentações Anexadas** lista apenas as 4 doc originais (todas ainda Aprovadas), e o stepper exibe "Todos os 4 documento(s) foram analisados ✓".
- O documento reenviado só aparece no Step 2 ("Fotos & Vistoria") dentro do `PropostaMidiaGrid` — etapa **oculta** quando o plano não tem Roubo/Furto (caso atual). Resultado: o analista não consegue ver nem aprovar o reenvio.

Origem técnica:
- `useProposta` carrega `documentos` apenas de `contratos_documentos` (linhas 840-860 de `src/hooks/usePropostasPendentes.ts`).
- O reenvio cria registro em `documentos_solicitados` (status `enviado`) + `documentos`, mas estes são expostos apenas em `documentos_solicitados_enviados`, consumidos só no Step 2.

## Solução

Incluir os documentos reenviados na mesma lista do Step 1, já marcados como pendentes de análise, para que o analista os aprove/reprove no fluxo natural antes de concluir o cadastro.

### 1. `src/hooks/usePropostasPendentes.ts` (e versão de lista)

Após carregar `documentos` (contratos_documentos) e `documentosSolicitadosEnviados`, mesclar:

- Para cada item de `documentos_solicitados_enviados` com `documento.arquivo_url`, criar uma entrada virtual em `documentos`:
  - `id`: `solicitado-{documentos_solicitados.id}` (prefixo permite roteamento na aprovação).
  - `tipo`: `tipo_documento` do solicitado (cnh, crlv, ...) com sufixo "(reenviado)" no `arquivo_nome`.
  - `arquivo_nome`: `documento.nome_arquivo` ou label amigável.
  - `arquivo_url`: `documento.arquivo_url`.
  - `status`: mapear `documento.status` → `pendente`/`em_analise`/`aprovado`/`reprovado` (default `em_analise` quando `enviado` mas ainda não decidido).
  - `created_at`: `enviado_em`.
  - Flag interna `_reenviado: true` (e `_solicitado_id`, `_documento_id`) para a UI marcar visualmente.
- Inserir essas entradas no início do array `documentos` (acima das originais).

Resultado: `totalDocs`, `docsPendentes` e `step1Complete` no `PropostaApprovalStepper` passam a refletir os reenvios automaticamente — sem alterar a lógica do stepper.

### 2. `src/components/cadastro/DocumentosAnexadosPanel.tsx`

- Detectar `_reenviado` e exibir badge "Reenviado para reanálise" (cor warning) ao lado do nome do documento, mantendo o restante da UI igual.

### 3. `src/pages/cadastro/PropostaAnalise.tsx` — `handleAprovarDocumento` / `handleReprovarDocumento`

Adaptar para roteamento por id:

- Se `docId` começa com `solicitado-`:
  - Extrair `solicitado_id`, buscar `documento_id` correspondente.
  - `update documentos set status='aprovado'|'reprovado' where id=documento_id`.
  - `update documentos_solicitados set status='aprovado'|'reprovado', observacao_cliente=motivo? where id=solicitado_id`.
  - Se reprovar: voltar `documentos_solicitados.status` para `pendente` e limpar `enviado_em`/`documento_id`, para o cliente reenviar novamente (mantém o fluxo já existente do card de reanálise).
- Caso contrário: comportamento atual em `contratos_documentos`.

Invalidate queries de `proposta` e `propostas-pendentes` ao final.

### 4. Comportamento esperado (validação manual)

- Abrir a proposta `CTR-20260512100945-NQE90C`: o painel deve mostrar **5** documentos, sendo a CNH reenviada com badge "Reenviado" e status pendente.
- Stepper passa de "4/4 aprovados" para "4/5 aprovados" e bloqueia o avanço até decidir.
- Aprovar a CNH reenviada → 5/5, libera Step 2/Final, banner de reanálise some no próximo refetch.
- Reprovar → solicitação volta a `pendente`, cliente recebe novo pedido (fluxo existente já cobre WhatsApp).

## Fora de escopo

- Sem mudanças em edge functions, no fluxo de envio do cliente, ou em `documentos_solicitados_pendentes` (continua bloqueando como hoje).
- Step 2 (`PropostaMidiaGrid`) continua mostrando o histórico de reenvios para auditoria; a duplicidade visual é intencional (lista para análise no Step 1, registro na mídia no Step 2).
