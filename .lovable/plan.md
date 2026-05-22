## Diagnóstico do caso ALAN THIAGO / COT-20260522-102623985-742

### Estado real da cotação (do banco)
- `cotacoes.status_contratacao = 'pagamento_ok'`
- `cotacoes.tipo_vistoria = NULL` (cliente ainda não escolheu autovistoria ou agendamento)
- `cotacoes.valor_fipe = R$ 48.071` (Chevrolet Prisma — **acima do mínimo de R$ 30k**, logo exige rastreador e autovistoria é OPCIONAL/enxuta)
- `contratos.status='assinado'`, `cadastro_aprovado=false`
- `veiculos.status='em_analise'`, `associados.status='pendente_vistoria'`
- **Não existe** nenhum registro em `instalacoes`, `agendamentos_base`, `servicos`, `vistorias` nem `cotacoes_vistoria_fotos` para essa cotação

Ou seja: o cliente terminou Plano → Documentos → Contrato → Pagamento. Falta apenas escolher o caminho da vistoria.

### Onde está o bug
Em `src/pages/public/CotacaoContratacao.tsx`:

1. A árvore de render do **bloco `etapaAtual === 5` (Conclusão)** trata só 6 cenários:
   - troca de titularidade, `status='ativo'`, docs pendentes, `tipo_vistoria='autovistoria'`, `tipo_vistoria='agendada'`, `tipo_vistoria='agendada_base'`.
   - Sem nenhum desses, cai no **fallback infinito** (linha 1707-1715): `Loader2` + "Verificando status da sua proposta...".

2. A função `etapaDoStatus` (linhas 316-366) tem um caminho conhecido que empurra para 5 mesmo sem `tipo_vistoria` escolhido — o próprio comentário das linhas 280-281 reconhece esse risco:
   > "`pagamento_ok` NÃO marca vistoria como concluída — senão `etapaAtual` pula para 5 antes do cliente escolher autovistoria/agendamento e a UI fica no fallback 'Verificando status…'"
   
   A proteção atual cobre só uma parte do problema (remove `pagamento_ok` de `statusConcluidos.vistoria`), mas:
   - O `useEffect` de sincronização (linha 402-416) **não retorna** o usuário para etapa 4 se algo já tiver gravado `etapaAtual=5` (ex.: race do invalidate pós-pagamento, navegação manual ou cache stale do React Query enquanto `tipo_vistoria` ainda parecia ser 'autovistoria').
   - O bloco `etapaAtual === 5` **não tem self-heal**: assume que ou já há `tipo_vistoria`/agendamento, ou cai no spinner.

3. Resultado: cliente fica eternamente em "Verificando status da sua proposta..." sem nenhum botão/CTA para iniciar a autovistoria ou agendar a vistoria presencial.

## Plano de correção

### 1. Self-heal no `etapaDoStatus`
Em `src/pages/public/CotacaoContratacao.tsx`, dentro do `useMemo` de `etapaDoStatus`:
- Antes de retornar `etapaFinal`, se `status_contratacao === 'pagamento_ok'` **E** `tipo_vistoria` é null/undefined **E** não é troca de titularidade **E** não há `hasInstalacaoAgendada || hasAgendamentoBase || agendamentoConcluido`, **forçar `return 4`** (etapa Vistoria).
- Garante que mesmo que algum efeito tenha empurrado para 5, a derivação canônica recoloca o cliente na etapa onde ele escolhe autovistoria opcional × agendamento técnico.

### 2. Self-heal no `useEffect` de sincronização
No `useEffect` das linhas 402-416:
- Adicionar exceção para o caso "fallback infinito": se `etapaAtual === 5` mas o estado da cotação não atende nenhuma das condições renderizáveis da etapa 5 (sem `tipo_vistoria`, sem agendamentos, sem `ativo`, sem troca), **ignorar `navegacaoManual` e re-sincronizar** para `etapaDoStatus` (que com o item 1 será 4).
- Comentar explicitamente que essa é a guarda contra "limbo pós-pagamento".

### 3. Branch defensivo no bloco `etapaAtual === 5`
Mesmo com os dois itens acima, adicionar um último branch ANTES do fallback `<Loader2>`:
- Se `status_contratacao === 'pagamento_ok'` e `tipo_vistoria` é null e não há agendamento materializado, **renderizar a UI de seleção** (a mesma `EtapaVistoria` usada no `etapaAtual === 4`) em vez do spinner. Funciona como rede de segurança caso algum caminho ainda chegue lá.

### 4. Verificação
- Reabrir o link público do Alan (`/cotacao/36ca856f…85fb`) e confirmar que ele cai na tela de escolha "Fazer autovistoria agora" × "Agendar vistoria/instalação".
- Validar que a régua continua correta para os outros 3 fluxos (sub-FIPE obrigatória, troca dentro da janela mesmo-dia, autovistoria já em andamento) — apenas adicionamos rede de segurança, sem mudar branches existentes.

### Nenhuma mudança no banco
Não é necessário UPDATE direto no registro do Alan — assim que a UI for corrigida e ele recarregar a página, a etapa de Vistoria aparece naturalmente (não há lixo a limpar: zero registros operacionais foram criados).

### Arquivos tocados
- `src/pages/public/CotacaoContratacao.tsx` (única alteração)

Sem migração, sem edge function, sem mexer em fluxos de outros tipos de cotação.