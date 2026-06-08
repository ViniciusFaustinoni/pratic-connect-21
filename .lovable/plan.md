# Reanálise — visualizar e aprovar reenvios no Cadastro

## Diagnóstico

O card "Documentos da Reanálise" (`DocumentosSolicitadosCard`) lista os itens que o cliente reenviou, mas:

1. **Não tem botões Aprovar/Reprovar** — só "Visualizar". As ações existem em `PropostaAnalise.handleAprovarDocumento('solicitado-<id>')` e `handleReprovarDocumento(...)`, mas só são expostas no Step 1 (Documentos cadastrais) via `mergeDocsReenviadosNaLista`.
2. **Quando o reenvio é vídeo 360°** (caso da screenshot): o fluxo público `DocumentosPendentesPublico` (linhas 227–294) grava o arquivo em `vistorias.video_360_url` + `vistoria_fotos` e marca `documentos_solicitados.status='enviado'` **sem criar linha em `documentos`** → `documentos_solicitados.documento_id` fica NULL → o card esconde até o botão Visualizar (depende de `doc.documento?.arquivo_url`) e o item nem entra na lista mesclada do Step 1.

Resultado: o Cadastro só vê "video_360 — Enviado em 08/06/2026 às 11:21", sem qualquer ação possível, exatamente como na imagem.

## O que mudar (somente frontend + uma resolução de URL no hook)

### 1. Resolver URL de exibição também para peças de autovistoria sem `documento_id`

Em `src/hooks/usePropostasPendentes.ts`, complementar `documentos_solicitados_enviados` com uma `arquivo_url_fallback` quando `documento` é NULL:

- Se `tipo_documento` é vídeo (`video_360`/`video`) → usar `vistoria.video_360_url` da proposta.
- Se `tipo_documento` é foto de autovistoria (chassi, motor, lateral, pneu…) → buscar em `vistoria_fotos.arquivo_url` mais recente para aquela `vistoria_id`+`tipo` (consulta única em lote já feita no hook, expandindo o select existente).

Não criar tabela nem mudar como o link público grava — apenas resolver a URL no lado do Cadastro.

### 2. Card recebe handlers e mostra Aprovar/Reprovar por item reenviado

Em `src/components/cadastro/DocumentosSolicitadosCard.tsx`:

- Adicionar props `onAprovar(solicitadoId)`, `onReprovar(solicitadoId, motivo)`, `isPending`.
- Em cada item da seção "Já reenviados pelo cliente":
  - Botão **Visualizar** usa `doc.documento?.arquivo_url ?? doc.arquivo_url_fallback`.
  - Botões **Aprovar** (verde) e **Reprovar** (vermelho, abre modal com motivo) ao lado.
  - Quando `documentos.status === 'aprovado'` ou `documentos_solicitados.status === 'aprovado'`: troca por badge "Aprovado".
- Manter o card oculto quando não há reenviados nem pendentes (comportamento atual).

### 3. Passar os handlers nos dois pontos de uso

- `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` (linha 263): propagar `onAprovarDocumento`/`onReprovarDocumento` recebidos do `PropostaApprovalStepper`/`PropostaAnalise` para o card, usando o id no formato `solicitado-<id>` que os handlers de `PropostaAnalise.tsx` (linhas 343–430) já entendem.
- `PropostaApprovalStepper` (linha 436) já chama `PropostaMidiaGrid` no Step 2 — propagar pelos mesmos props.

### 4. Modal de motivo no Reprovar

Reusar o mesmo dialog usado em `DocumentosAnexadosPanel` para reprovar (texto curto, salva como `observacao_cliente`). Sem componente novo se já houver helper compartilhado; caso contrário, dialog inline simples.

## Comportamento esperado após a mudança

- Card "Documentos da Reanálise" mostra o item `video_360` com **Visualizar** (abre o vídeo da `vistorias.video_360_url`), **Aprovar** e **Reprovar**.
- Aprovar → `documentos_solicitados.status='aprovado'` (e `documentos.status='aprovado'` quando houver `documento_id`).
- Reprovar → volta a solicitação para `status='pendente'`, limpa `enviado_em`/`documento_id`, grava motivo em `observacao_cliente`. Cliente é notificado para reenviar (comportamento já existente em `handleReprovarDocumento`).
- Peças de autovistoria mantêm o efeito canônico: reenviar zera `vistoria_concluida_em` (já implementado em `DocumentosPendentesPublico`), permanecendo válida a memória `documentos-solicitados-reabre-autovistoria`.

## Fora do escopo

- Não mexer no fluxo público de reenvio (`DocumentosPendentesPublico`) — ele já grava no lugar canônico.
- Não criar novas tabelas, edge functions, triggers ou políticas.
- Não alterar como o Step 1 (documentos cadastrais) processa reenvios CNH/CRLV/comprovante — segue idêntico via `mergeDocsReenviadosNaLista`.

## Arquivos tocados

- `src/hooks/usePropostasPendentes.ts` — adicionar `arquivo_url_fallback` em `documentos_solicitados_enviados`.
- `src/components/cadastro/DocumentosSolicitadosCard.tsx` — botões Aprovar/Reprovar + fallback de URL.
- `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` — propagar handlers ao card.
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` — propagar handlers do stepper ao MidiaGrid.
- `src/pages/cadastro/PropostaAnalise.tsx` — nada a fazer (handlers já aceitam `solicitado-<id>`).
