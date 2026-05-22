## Diagnóstico da causa raiz

O caso Luiz Fernando (cotação `3eda326b-4cd1-42d6-8197-847ad601a913`) revelou que o "Vistoria Agendada com Sucesso!" é renderizado a partir de **colunas espelho** em `cotacoes` (`vistoria_*` ou `agendamentos_base`), e não a partir de uma confirmação de que os registros operacionais correspondentes existem no banco.

**Estado real do caso Luiz Fernando hoje:**
- `cotacoes.tipo_vistoria = 'agendada_base'`, mas `vistoria_data_agendada` / `vistoria_endereco_*` estão NULL
- `agendamentos_base` existe (22/05, 13:00, status `realizado`) — não bate com a tela ("Manhã 08:00-12:00")
- `vistorias` existe (`modalidade=presencial`, `status=agendada`) mas com `data_agendada=22/05 00:00`, `instalacao_id=NULL` e sem `agendamentos_base.instalacao_id` apontando pra ela
- `instalacoes` para essa cotação: **inexistente**

**Origem do limbo no código (duas portas):**

1. **Fluxo presencial (cliente):** `supabase/functions/agendar-vistoria-presencial/index.ts` só faz `UPDATE cotacoes SET vistoria_data_agendada=...` e retorna `success:true` — **nunca insere em `vistorias` nem `instalacoes`** (comentários linhas 199-200 confirmam o design). O hook `useFinalizarVistoriaCotacao` recebe `success` e chama `onConfirmar` → tela de sucesso aparece sem nenhum registro operacional gravado.

2. **Fluxo base:** `useCriarAgendamentoBase` insere em `agendamentos_base` corretamente, mas o `criar-instalacao-pos-pagamento` (chamado em seguida) pode falhar silenciosamente (try/catch com `console.warn`), e o `onConfirmar` é chamado mesmo assim. A vistoria correspondente nunca é materializada por essa porta — depende de outros gatilhos.

A tela em `src/pages/public/CotacaoContratacao.tsx` (linhas 1642-1846) lê só `cotacao.vistoria_*` ou conta `hasAgendamentoBase` — não valida que existe `vistorias` com `data_agendada` preenchida nem que `instalacoes` foi criada.

---

## O que vai ser feito

### 1. Persistir o agendamento de verdade antes da tela de sucesso

**1a. Edge `agendar-vistoria-presencial` passa a criar `vistorias` (e quando aplicável `instalacoes`) na mesma transação**
- Após o `UPDATE cotacoes`, fazer `INSERT INTO vistorias` com `cotacao_id`, `contrato_id`, `associado_id`, `veiculo_id`, `modalidade='presencial'`, `status='agendada'`, `data_agendada=<dataAgendada>`, `periodo=<periodoAgendado>`, endereço completo e coordenadas
- Reaproveitar o caminho já existente do `criar-instalacao-pos-pagamento` (idempotente) chamando-o em sequência para materializar `instalacoes` + back-link em `agendamentos_base.instalacao_id` quando aplicável
- Se qualquer um dos INSERTs falhar, **retornar `success:false` com `error` claro** e **fazer rollback do UPDATE em `cotacoes`** (reverter `vistoria_data_agendada`, `tipo_vistoria` para os valores anteriores) para não deixar o espelho atualizado sem o registro operacional
- Devolver `{ success, vistoriaId, instalacaoId }` reais (hoje devolve `instalacaoId:null` por design)

**1b. `useCriarAgendamentoBase` para de engolir falha do `criar-instalacao-pos-pagamento`**
- Substituir o `try/console.warn` por throw que propaga para o `onError` da mutation
- Toast de erro claro: "Não foi possível registrar seu agendamento. Tente novamente."
- Não chamar `onAgendado` (a página não troca para a tela de sucesso)

**1c. Hooks `useFinalizarVistoriaCotacao` e `useAgendarVistoriaCompleta` viram gate de verificação**
- Após `success:true` da edge, fazer um SELECT de confirmação em `vistorias` por `cotacao_id` exigindo `data_agendada IS NOT NULL`. Se vier vazio em até 3 tentativas (250ms/500ms/1s), tratar como falha
- Só então chamar `onConfirmar`. Caso contrário, lançar erro → `onError` mostra toast e o usuário continua na etapa 5 com o formulário aberto

**1d. `CotacaoContratacao.tsx` para de confiar nas colunas espelho da cotação como prova**
- Antes de renderizar "Vistoria Agendada com Sucesso!", exigir que **pelo menos uma** das seguintes verificações seja verdadeira via `useAgendamentoExistente`:
  - existe `vistorias` com `status` ativo e `data_agendada` não-nula, OU
  - existe `agendamentos_base` em status `agendado/confirmado/realizado` com `data_agendada` preenchida, OU
  - existe `instalacoes` agendada com `cotacao_id`
- Se `cotacao.vistoria_data_agendada` está preenchido mas nenhum desses registros existe, renderizar **card de inconsistência detectada** (ver item 4) em vez da tela de sucesso

---

### 2. Erro forçado: confirmar que tela de sucesso não aparece

Roteiro de validação manual após implementar:
- Forçar `agendar-vistoria-presencial` a retornar `success:false` (ex.: passar `cotacaoId` inválido)
- Confirmar que o cliente vê toast vermelho "Erro ao agendar vistoria" e o formulário de data/período/endereço continua aberto na etapa 5
- Confirmar que `cotacoes.vistoria_data_agendada` continua NULL após a tentativa

---

### 3. Listar cotações em limbo (sem corrigir)

Criar query SQL (executada via `supabase--read_query` e exportada para `/mnt/documents/limbo-vistorias-agendamento.csv`) com critério canônico de limbo:

```sql
SELECT c.id, c.nome_solicitante, c.tipo_vistoria,
       c.vistoria_data_agendada, c.created_at,
       v.id as vistoria_id, v.status as vistoria_status, v.data_agendada,
       ab.id as agendamento_base_id, ab.data_agendada as base_data,
       i.id as instalacao_id, i.status as instalacao_status
FROM cotacoes c
LEFT JOIN vistorias v ON v.cotacao_id = c.id
LEFT JOIN agendamentos_base ab ON ab.cotacao_id = c.id
LEFT JOIN instalacoes i ON i.cotacao_id = c.id
WHERE c.created_at >= date_trunc('month', now())
  AND c.tipo_vistoria IN ('agendada','agendada_base')
  AND (
    -- caminho presencial: cotação diz agendado, mas vistoria sem data ou inexistente
    (c.tipo_vistoria='agendada' AND (v.id IS NULL OR v.data_agendada IS NULL))
    -- caminho base: cotação diz agendada_base mas agendamentos_base ausente
    OR (c.tipo_vistoria='agendada_base' AND ab.id IS NULL)
    -- vistoria existe mas instalação obrigatória ausente (carro≥30k/moto≥9k/diesel)
    OR (v.id IS NOT NULL AND v.data_agendada IS NOT NULL AND i.id IS NULL)
  );
```

Devolver no chat: `cotacao_id`, nome, data de criação, `tipo_vistoria`, e quais campos estão faltando. **Sem nenhum UPDATE.** Confirmar que `3eda326b-4cd1-42d6-8197-847ad601a913` aparece.

---

### 4. Caminho de recuperação para casos em limbo

Em `CotacaoContratacao.tsx`, quando detectar inconsistência (cotação diz agendado mas registros operacionais ausentes), renderizar um **card de recuperação** no lugar do "Vistoria Agendada com Sucesso!":

- Título: "Detectamos uma inconsistência no seu agendamento"
- Mensagem: "Nosso sistema não conseguiu confirmar o registro completo. Por favor, reagende abaixo para garantir que tudo seja registrado corretamente."
- Botão "Reagendar agora" → reabre o `AgendamentoVistoria` / `AgendamentoBase` com o endereço pré-preenchido
- A reabertura usa o fluxo corrigido (item 1), então uma vez salvo, o registro fica completo

A mesma detecção é usada por operador interno acessando o detalhe da vistoria — adicionar banner discreto em `ModalDetalhesVistoria` (já existente) avisando "Cotação aprovou agendamento na etapa pública mas registro operacional está incompleto — peça reagendamento pelo link público".

---

## Detalhes técnicos

**Arquivos modificados:**
- `supabase/functions/agendar-vistoria-presencial/index.ts` — criar `vistorias` + chamar `criar-instalacao-pos-pagamento`; rollback de cotação em falha; resposta com `vistoriaId` real
- `src/hooks/useAgendamentoBase.ts` — `useCriarAgendamentoBase` propaga falha de `criar-instalacao-pos-pagamento`
- `src/hooks/useCotacaoVistoria.ts` — `useFinalizarVistoriaCotacao` e `useAgendarVistoriaCompleta` fazem SELECT de confirmação antes de retornar
- `src/pages/public/CotacaoContratacao.tsx` — só renderiza tela de sucesso quando há registro operacional confirmado via `useAgendamentoExistente`; renderiza card de recuperação no caso inconsistente
- `src/components/vistorias/ModalDetalhesVistoria.tsx` — banner de inconsistência para operador interno

**Fora de escopo (confirmado no pedido):**
- Não corrigir automaticamente os limbos existentes
- Não mexer na divisão arquitetural vistoria × instalação
- Não mexer na detecção de tipo de veículo do roteiro

**Entregáveis no fim:**
1. Print de novo agendamento via link público mostrando o registro em `vistorias` e `agendamentos_base` **antes** da tela de sucesso
2. Print do teste de falha forçada: toast de erro e formulário continua aberto
3. CSV com lista de cotações em limbo do mês corrente em `/mnt/documents/limbo-vistorias-agendamento.csv`
4. Confirmação explícita que `3eda326b` aparece na lista