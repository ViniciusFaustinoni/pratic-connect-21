## O que acontece hoje (o "limbo")

Em `src/pages/cadastro/AssociadoDetalhe.tsx` linha 776, na aba **Documentos**, o botão "Solicitar Reenvio" é apenas decorativo:

```tsx
<Button size="sm" variant="outline" className="h-7 text-xs">
  <Send className="h-3 w-3 mr-1" /> Solicitar Reenvio
</Button>
```

Não tem `onClick`, não dispara mutation, não cria registro, não notifica ninguém. O usuário clica e nada acontece — daí a sensação de "limbo".

## O que JÁ existe no projeto e pode ser reaproveitado

A lógica completa do reenvio já está implementada e em uso em **PropostaAnalise.tsx**:

1. **Hook `useSolicitarDocumentos`** (`src/hooks/usePropostasPendentes.ts:1532`) que faz:
   - INSERT em `documentos_solicitados` (status `pendente`, com `solicitado_por`, `observacao_solicitacao`).
   - UPDATE no associado para `status = 'documentacao_pendente'`.
   - Registro em `associados_historico`.
   - Chama edge function `notificar-cliente` com tipo `documentos_solicitados`, mandando WhatsApp com link `/{APP_BASE_URL}/acompanhar/{link_token}` (ou `/cotacao/{cotacao_token_publico}` como fallback).
   - Log em `logs_auditoria`.

2. **Dialog `SolicitarDocumentosDialog`** (`src/components/cadastro/SolicitarDocumentosDialog.tsx`) — UI com checklist categorizado (Pessoais, Vistoria, Outros) + textarea de observação.

3. **Onde o associado vê:**
   - Componente `DocumentosPendentes` (associado logado) → consulta `useDocumentosSolicitadosPendentes(associadoId)`.
   - Componente `DocumentosPendentesPublico` → renderizado em `/acompanhar/:token` (`AcompanhamentoProposta.tsx`) — é o link que o WhatsApp envia. Esse link **funciona sem login**, então qualquer associado consegue abrir, ver os pendentes e fazer upload.

Ou seja: o pipeline ponta a ponta já funciona para propostas. O botão da aba Documentos do detalhe do associado simplesmente nunca foi conectado a esse mesmo pipeline.

## Solução (sem quebrar nada)

Conectar o botão existente ao fluxo já testado:

### 1. `AssociadoDetalhe.tsx` (única tela alterada)

- Importar `useSolicitarDocumentos` de `usePropostasPendentes` e `SolicitarDocumentosDialog`.
- Adicionar estado `openReenvioDialog`.
- Pré-selecionar no dialog os tipos dos documentos que estão **reprovados** (já temos `todosDocumentos.filter(d => d.status === 'reprovado')`).
- Resolver `contratoId`: usar o contrato ativo do associado (já carregado na página). Se houver mais de um, escolher o do veículo do documento reprovado (a tabela `documentos.veiculo_id` permite essa associação) ou abrir um Select rápido.
- `onConfirm` → chamar `useSolicitarDocumentos.mutateAsync({ contratoId, associadoId: id, documentos, observacoes })`.
- Toast de sucesso + invalidate `['documentos', id]` para o badge "1 reprovado(s)" sair na hora.

### 2. Tornar o card mais informativo (UX, não-bloqueante)

Logo abaixo do botão, mostrar um pequeno indicador quando já existirem `documentos_solicitados` com `status='pendente'` para o associado:

> "📨 3 documento(s) já solicitado(s) ao associado em 30/04 — aguardando reenvio."

Reusa `useDocumentosSolicitadosPendentes(id)` que já existe. Evita o cadastro duplicar a solicitação e dá visibilidade do que está em curso.

### 3. (Opcional) Botão "Ver link enviado ao associado"

Mostrar/copiar o `link_token` do contrato (mesma URL que vai pelo WhatsApp). Útil quando o cliente diz "não recebi nada" — o atendente copia e manda manualmente.

## Por que isso resolve o limbo

- O associado **já tem** uma tela própria (`/acompanhar/:token`) que lista os pendentes e aceita upload — só faltava popular `documentos_solicitados`.
- O WhatsApp do cliente recebe a mensagem com o link direto, automaticamente, via edge function `notificar-cliente` (que já está em produção).
- O cadastro vê o estado em tempo real ("aguardando reenvio") e o histórico fica registrado em `associados_historico` + `logs_auditoria`.

## Fora de escopo (intencionalmente)

- Não criar tabela nova, não alterar RLS, não mexer em edge function — todo o backend já está pronto.
- Não tocar no `PropostaAnalise.tsx` (fluxo paralelo continua funcionando do mesmo jeito).
- Não trocar a UI do `DocumentosPendentesPublico` — o associado continua vendo no mesmo lugar.

## Arquivos a alterar

- `src/pages/cadastro/AssociadoDetalhe.tsx` — único arquivo de produção; ~30 linhas adicionadas (import + state + handler + props no Button + indicador de pendentes em curso).
