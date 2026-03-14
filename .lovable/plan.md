
Objetivo: eliminar o erro de upload de fotos (FK 23503), impedir troca silenciosa para usuário errado no app do instalador e garantir que a tarefa não “desapareça”.

1) Diagnóstico consolidado (o que está acontecendo)
- Upload falha em `vistoria_fotos` quando `vistoria_id` não existe mais em `vistorias` (hook atual insere direto sem revalidar pai).
- O app pode abrir com sessão de outro usuário no mesmo navegador (cliente Supabase usa `localStorage` compartilhado), causando “entrou como diretor”.
- Se a tarefa sair do retorno da RPC (filtro atual), a aba “Atual” fica vazia mesmo com serviço ainda ativo.

2) Correção do fluxo de vistoria/fotos (robustez)
- `src/hooks/useVistoriaCompleta.ts` (`useUploadFotoVistoriaCompleta`):
  - Validar existência da vistoria antes de inserir foto.
  - Em `23503`, reconsultar/recriar vínculo da vistoria e tentar upload 1x (retry controlado).
  - Trocar sequência para evitar inconsistência (garantir DB antes de remover foto antiga do storage).
- `src/hooks/useVistorias.ts` (`useVistoriaCompletaPorServico`):
  - Após criar vistoria, confirmar leitura imediata da linha criada.
  - Validar update de `servicos.vistoria_origem_id` (hoje sem checagem de erro).
  - Preencher `instalacao_id` quando houver `instalacao_origem_id` para manter rastreabilidade.

3) Correção de sessão/troca de usuário no app instalador
- `src/pages/instalador/InstaladorLogin.tsx` + `src/contexts/AuthContext.tsx`:
  - Travar sessão ativa por usuário no app instalador (detectar troca inesperada em rota de execução).
  - Ao detectar mismatch em tarefa em andamento: bloquear tela e forçar relogin explícito.
  - Limpar cache de queries sensíveis ao trocar usuário (evitar estado “sem tarefa” herdado).

4) Recuperação de tarefa “sumida”
- SQL migration da RPC `buscar_tarefa_atual_profissional`:
  - Ajustar filtro para não ocultar tarefa ativa indevidamente.
  - Manter prioridade por `em_andamento/em_analise/em_rota/agendada`.
- `src/hooks/useTarefaAtual.ts`:
  - Fallback: se RPC vier vazia, buscar em `servicos` por `profissional_id` + status ativos e retornar a mais prioritária.

5) Validação final
- Testar E2E: iniciar tarefa → criar/obter vistoria → enviar várias fotos seguidas → refresh de tela → manter mesmo usuário e mesma tarefa.
- Testar troca de conta no mesmo navegador (diretor ↔ vistoriador) e garantir bloqueio/mensagem clara.
- Confirmar que tarefas voltam a aparecer em “Atual” após relogin correto.
