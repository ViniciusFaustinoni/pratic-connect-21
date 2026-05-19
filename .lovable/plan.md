## Problema

A fila do Cadastro está mostrando propostas com caminho **incompleto**. Caso Marllon (KRF8B74): autovistoria iniciada com **1 foto e sem vídeo 360°** já apareceu como "Aceita / Escolha de Vistoria" para o Cadastro.

Causa raiz em `src/hooks/usePropostasPendentes.ts`:

```ts
// linha 762 — qualquer mídia conta como autovistoria entregue
const temAutovistoria = !!(vistoria && vistoria.fotos && vistoria.fotos.length > 0);
```

Esse `>= 1 foto` é o gate atual. Não exige vídeo 360°, não exige roteiro mínimo. Por isso uma autovistoria começada e abandonada (ou em andamento) entra na fila do Cadastro.

## Correção

### 1. Ajustar gate de "etapa concluída" em `src/hooks/usePropostasPendentes.ts`

Substituir o teste atual por **autovistoria completa** seguindo a regra canônica (`mem://logic/operations/autovistoria-2-fotos-video-360`):

- **Mínimo universal:** `fotos >= 2 && !!video_360_url` (cobre enxuta acima FIPE — caso o cliente complete a enxuta também atinge sub-FIPE pelo mesmo bloco).
- Carro/moto não muda o teste — sub-FIPE completa naturalmente atinge `>=2 + vídeo`.

```ts
const autovistoriaCompleta =
  !!vistoria &&
  vistoria.modalidade === 'autovistoria' &&
  (vistoria.fotos?.length ?? 0) >= 2 &&
  !!vistoria.video_360_url;

// Vistorias presenciais (modalidade !== 'autovistoria') já vêm de
// agendamentos/instalações materializados — mantém o boolean atual.
const temVistoriaPresencialMaterializada =
  !!vistoria && vistoria.modalidade !== 'autovistoria' && (vistoria.fotos?.length ?? 0) > 0;

const temAutovistoria = autovistoriaCompleta || temVistoriaPresencialMaterializada;
```

E também recalcular `temAutovistoriaProp` na linha 1485 (mesma lógica, dentro do `realtimeRefetcher`/segundo bloco) para manter paridade.

### 2. Manter o restante do gate intacto

`temVistoriaBaseAgendada`, `temVistoriaBaseRealizada`, `temInstalacaoAgendada`, `instalacaoInfo` permanecem como estão — cada um representa um caminho efetivamente escolhido e materializado pelo cliente. Cobrem:

- Cliente foi pela **vistoria base** (agendamento criado) → entra.
- Cliente foi pela **instalação domiciliar** (instalação agendada via `criar-instalacao-pos-pagamento`) → entra.
- Cliente foi pela **autovistoria** → entra somente quando 2 fotos + vídeo enviados.

Se o cliente escolheu autovistoria, parou no meio e depois mudou para instalação (ou vice-versa), o gate de `temInstalacaoAgendada` / `temVistoriaBaseAgendada` capta naturalmente a nova escolha.

### 3. Paridade automática do badge

`usePropostasPendentesCount` apenas conta `data.length` do hook, então corrige sozinho. `usePropostasMetricas` precisa ser verificado — se ele duplica a query, aplico o mesmo critério lá; se reusa o hook, nada a fazer.

### 4. Sem mudança de banco

Nenhuma migração. Sem mudança de fluxo backend. A regra "autovistoria sem 2 fotos + vídeo NÃO promove cadastro" já está garantida em backend (`escopoAnaliseCadastro.ts` + edge `aprovar-proposta`). A correção é puramente na **visibilidade da fila**.

## Verificação

1. Recarregar `/cadastro/propostas` — a proposta KOU... do Marllon (autovistoria 1 foto, sem vídeo) deve **sumir** da fila.
2. Subir o número de fotos para 2 + setar `video_360_url` em uma vistoria de teste → proposta reaparece.
3. Conferir badge da sidebar bate com a quantidade da lista.
4. Cotação com instalação agendada (caminho instalação) continua aparecendo — não é regressão.

## Memória

Atualizar `mem://logic/operations/propostas-pendentes-saida-por-vistoria` (ou criar uma nova `mem://logic/operations/propostas-pendentes-entrada-caminho-completo`) registrando:

> Proposta SÓ entra na fila do Cadastro quando o caminho escolhido pelo cliente está **completo**: autovistoria = 2 fotos + vídeo 360°; instalação domiciliar = agendamento materializado; vistoria base = agendamento criado. Autovistoria com mídia parcial é invisível ao Cadastro.