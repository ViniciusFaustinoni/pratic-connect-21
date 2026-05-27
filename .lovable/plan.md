## Objetivo

Permitir que a analista de Cadastro **desfaça uma reprovação de documento** (volte para `em_analise`/`pendente` ou aprove diretamente) **enquanto a proposta ainda não foi fechada** (Cadastro ainda não aprovado). Toda reversão exige uma **justificativa obrigatória**, registrada no histórico do associado e em logs de auditoria.

## Regras de negócio

- **Quando pode reverter:** só enquanto o contrato da proposta tem `aprovado_em IS NULL` (Cadastro ainda em análise). Depois disso, o card de doc reprovado fica como hoje (somente leitura).
- **Quem pode reverter:** mesmo perfil que aprova/reprova documento hoje (analista de Cadastro / interno).
- **Justificativa:** texto obrigatório (mín. 10 caracteres). Sem texto válido, botão de confirmar fica desabilitado.
- **Para onde volta:**
  - "Reverter para análise" → status `em_analise`, limpa `motivo_reprovacao`.
  - "Reverter e aprovar" (atalho) → status `aprovado`, limpa `motivo_reprovacao`.
- **Rastro obrigatório (sempre os dois):**
  - `associados_historico` (aba Histórico do associado) — tipo `documento_reprovacao_revertida`, descrição com nome do tipo do doc + justificativa + analista, `dados_anteriores` (status anterior + motivo) e `dados_novos` (novo status).
  - `logs_auditoria` via `registrarLog` — ação `atualizar` + descrição `[CADASTRO] Reversão de reprovação de documento`.
- **Snapshot no próprio doc:** preserva o motivo reprovado no histórico (não some sem registro).

## Mudanças no produto

### 1. UI — Card do documento reprovado (`DocumentoAnexadoCard.tsx`)
- Quando `status === 'reprovado'` **e** contrato da proposta ainda **não aprovado** (`aprovado_em IS NULL`), exibir um botão discreto **"Reverter reprovação"** abaixo do badge "Reprovado".
- Sem o contexto de "proposta aberta", o botão não aparece (mantém o card como hoje em telas de histórico/associado já fechado).

### 2. Novo dialog — `ReverterReprovacaoDocumentoDialog.tsx`
- Mostra: tipo do doc, data da reprovação, motivo original.
- Campo **Justificativa** (textarea, obrigatório, mín. 10 chars).
- Dois CTAs:
  - **Reverter para análise** (volta a `em_analise`).
  - **Reverter e aprovar** (vai direto para `aprovado`).
- Toast de sucesso/erro padrão.

### 3. Hook — `useReverterReprovacaoDocumento` (em `src/hooks/useDocumentos.ts`)
- Roda em transação lógica no cliente:
  1. Lê o documento atual (status, motivo, associado_id, tipo).
  2. Guarda contra reversão se contrato já aprovado (consulta `contratos.aprovado_em` da proposta — bloqueio defensivo além da UI).
  3. `UPDATE documentos` → novo status, `motivo_reprovacao = null`, `analista_id = auth.uid()`, `data_analise = now()`.
  4. `INSERT associados_historico` com tipo, descrição e snapshots.
  5. `registrarLog` em `logs_auditoria`.
- Invalida as mesmas queries que `useAnaliseDocumento`.

### 4. Telas que devem consumir o novo botão
- `PropostaAnalise.tsx`, `FilaDocumentos.tsx`, `AnaliseDocumento.tsx`, `AssociadoDetalhe.tsx` (aba Documentos enquanto proposta aberta) — passar a prop `propostaAberta` para o card decidir se renderiza o botão.

## Não-objetivos (fora deste escopo)

- Não muda nada para documentos **aprovados** (não há reversão de aprovação aqui).
- Não muda fluxo do Cadastro depois de aprovado (não reabre proposta).
- Não altera regras de R/F nem `cadastro_aprovado` — apenas o status do documento.
- Não mexe nas reprovações em telas externas (Monitoramento, Vistoria etc.).

## Detalhes técnicos

- Não precisa de migração de schema: já há `documentos.status`, `motivo_reprovacao`, `analista_id`, `data_analise` e a tabela `associados_historico` já é usada pelo projeto.
- Guard backend leve: o próprio UPDATE em `documentos` pode rodar com o cliente atual (RLS de interno já permite); a checagem `contratos.aprovado_em IS NULL` é feita no hook antes do update. Se quiser proteção dura no banco, fica como tech-debt opcional (trigger BEFORE UPDATE em `documentos` bloqueando transição `reprovado → *` quando contrato já aprovado) — não bloqueante para esta entrega.
- `registrarLog` segue o padrão atual do projeto (Vigia universal de logs_auditoria com fallback `acao='criar'`).

## Critério de aceite

- Doc reprovado em proposta aberta mostra "Reverter reprovação".
- Clicar abre dialog; sem justificativa válida, não submete.
- Após reverter, status muda corretamente, motivo original aparece na aba Histórico do associado com a justificativa da analista + nome dela + carimbo de data/hora.
- Aparece também em Configurações › Logs (logs_auditoria).
- Em proposta já aprovada pelo Cadastro, o botão não aparece e (se chamado direto) o hook recusa com toast.
