
## Diretriz do usuário

Nenhuma das duas trocas pode ser auto-efetivada agora. Ambas precisam seguir o **caminho canônico real**: aparecer em **Serviços de Campo / Atribuição Manual do Monitoramento**, onde o coordenador atribui a um técnico ou realiza a vistoria manualmente. Só depois disso o Monitoramento aprova de novo, e aí sim o `efetivar-troca-titularidade` roda.

---

## Parte 1 — `solicitar_vistoria` passa a materializar serviço (correção estrutural)

Hoje a ação só seta `status='aguardando_vistoria'` + `tipo_vistoria_troca` e dispara WhatsApp. Não cria nada executável → vistoria nunca chega ao Monitoramento. **Esta é a raiz dos casos.**

Novo comportamento na edge `aprovar-troca-monitoramento` (branch `solicitar_vistoria`):

- Ampliar body para receber `vistoria: { data_agendada, periodo, endereco }` (mesmo shape de `manutencao`/`retirada`). Validar antes de qualquer escrita.
- Resolver `veiculo_id` (da solicitação) e `associado_id` = `novo_associado_id` (vistoria é executada com base no novo titular).
- Criar 1 registro em `servicos` com:
  - `tipo = 'vistoria_entrada'` (canônico — equivale a instalação na primeira visita; segue memória `vistoria_entrada ≡ instalacao`).
  - `modalidade = 'somente_fotos_troca'` quando `tipo_vistoria_troca='somente_fotos'`, ou `'fotos_instalacao_troca'` quando `'fotos_com_rastreador'`.
  - `instalar_rastreador = (tipo === 'fotos_com_rastreador')`.
  - `status='pendente'`, `permite_encaixe=true`, `local_vistoria='cliente'`, `origem='troca_titularidade'`.
  - Endereço completo do body.
  - `data_agendada` / `periodo` do body.
- Gravar `servico_vistoria_id` em `solicitacoes_troca_titularidade` + manter `status='aguardando_vistoria'`.
- Notificação Meta atual permanece.

Resultado: o serviço aparece imediatamente em **Atribuição Manual** (a exceção canônica `origem='troca_titularidade'` já está prevista nos 5 hooks operacionais — `mem://logic/operations/gate-cadastro-monitoramento-universal`).

### UI

Trocar o atual `Button` simples "Solicitar vistoria" do `ModalDetalhesTroca.tsx` por um Dialog dedicado (`DialogSolicitarVistoriaTroca.tsx`) que coleta:
- Tipo (somente fotos × fotos + instalação de rastreador)
- Data (com `useDatasAgendamentoUF` — janela por UF, mesma do link público)
- Período (manhã/tarde)
- Endereço (autocomplete CEP / mesmos campos usados em manutenção e retirada)

Toast de erro usa o helper `toastErroEdge` para mostrar o `code` quando voltar 400/409.

## Parte 2 — `aprovar` propaga erro real do efetivar

Substituir o fire-and-forget atual (linhas 218–244):

1. Chamar `efetivar-troca-titularidade` e ler `success`, `error`, `etapa_falha`.
2. Se `!success`:
   - **Reverter** `aprovado_monitoramento_em`/`aprovado_monitoramento_por` (ficaria preenchido pelo `baseUpdate` e esconderia o item da fila — comportamento errado).
   - Setar `sga_status='falha'` + `observacao_monitoramento` anexa com `etapa_falha`.
   - Inserir em `sga_sync_queue` `{ tipo:'troca_titularidade', placa, payload:{ solicitacao_id, cenario_override:'B' }, proximo_retry_em: now()+1min }`.
   - Retornar **502** com `Retry-After: 60` e body `{ success:false, code:'falha_efetivar_troca', etapa_falha, error }`.
3. Se `success`: caminho atual permanece.

Idem para a chamada `ativar-associado` que hoje é fire-and-forget (linhas 195–213): se voltar `!success`, propagar 502 com `code:'falha_ativar_novo_titular'` antes de chamar efetivar (e nem invocar efetivar, evitando estado parcial).

Front (`ModalDetalhesTroca.tsx`) já tem `toastErroEdge` para a action "Aprovar"; bastará repassar.

## Parte 3 — Destravar LQY5543 e LUJ0G95 manualmente (sem efetivar)

Ambos precisam **voltar para o estado canônico de "vistoria pendente"** com `servicos` materializado para o Monitoramento ver.

### LQY5543 (solicitação `50e43757`)

Estado atual: `status='aguardando_vistoria'`, `tipo_vistoria_troca='fotos_com_rastreador'`, `instalar_rastreador=true`, `servico_vistoria_id=NULL`, `aprovado_monitoramento_em=09/06 15:25`.

Ações (via `supabase--insert`):
1. INSERT em `servicos`:
   - `tipo='vistoria_entrada'`, `modalidade='fotos_instalacao_troca'`, `instalar_rastreador=true`.
   - `associado_id = novo_associado_id`, `veiculo_id` = veículo da solicitação.
   - `status='pendente'`, `permite_encaixe=true`, `local_vistoria='cliente'`, `origem='troca_titularidade'`.
   - Endereço herdado do contrato novo (`contratos.cotacao_id = solicitacao.cotacao_id`, novo titular).
   - `data_agendada` = preencher com hoje + 1 dia útil (Monitoramento reagenda se precisar) **ou** deixar NULL se a coluna permitir — confirmar antes de rodar; preferência: NULL + flag de "aguardando atribuição".
   - `observacoes = '[destravamento_manual] Serviço materializado retroativamente — solicitar_vistoria não criou serviço antes do hotfix.'`.
2. UPDATE `solicitacoes_troca_titularidade` set `servico_vistoria_id = <id>`.
3. Manter `status='aguardando_vistoria'`. Cobertura suspensa permanece — religa só quando efetivar rodar pós-vistoria/aprovação.

### LUJ0G95 (solicitação `aaf27c03`)

Estado atual: manutenção `vistoria_manutencao` já concluída (09/06), `status='aguardando_monitoramento'`, `aprovado_monitoramento_em=09/06 13:03` preenchido mesmo após `efetivar` ter falhado silenciosamente. Novo contrato em `assinado`, não ativado.

Ações:
1. UPDATE `solicitacoes_troca_titularidade` set `aprovado_monitoramento_em=NULL`, `aprovado_monitoramento_por=NULL`, `sga_status='pendente'`, `observacao_monitoramento` anexa `'[destravamento_manual] Aprovação anterior falhou no efetivar; reaberta para Monitoramento decidir novamente.'`.
2. Sem novo `servico` — manutenção já foi feita. A solicitação volta para a fila pendente do Monitoramento (`status` continua em `aguardando_monitoramento`), com o histórico da manutenção visível.
3. Não tocar no contrato novo nem em `ativar-associado` — Monitoramento clica "Aprovar" pela tela e o fluxo corrigido (Parte 2) cuida do resto, propagando erro se reaparecer.

---

## Arquivos a alterar (Partes 1 e 2)

- `supabase/functions/aprovar-troca-monitoramento/index.ts`
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
- Novo: `src/components/troca-titularidade/DialogSolicitarVistoriaTroca.tsx`

Sem migration de schema. Os destravamentos (Parte 3) entram via `supabase--insert` em uma única chamada.

## Validação

1. LQY5543: após destravamento, conferir que serviço aparece em **Monitoramento › Serviços › Atribuição Manual** com badge "Troca de titularidade".
2. LUJ0G95: aparecer de volta em **Monitoramento › Aprovações › Troca de Titularidade › Pendentes**. Clicar Aprovar e verificar comportamento: success → efetivada; falha → 502 visível no toast + entry em `sga_sync_queue` (visível em `/configuracoes/integracoes/sga-hinova?placa=LUJ0G95`).
3. Smoke E2E em troca nova: solicitar vistoria pelo Dialog → serviço criado → técnico conclui → aprovar passa.

## Pós-implementação

Registrar memória nova `mem://logic/operations/troca-solicitar-vistoria-materializa-servico` reforçando que `solicitar_vistoria` cria `servicos.tipo='vistoria_entrada'` com `origem='troca_titularidade'`, e atualizar `mem://logic/operations/troca-titularidade-etapas-obrigatorias` com o code estruturado novo (`falha_efetivar_troca` / `falha_ativar_novo_titular`).
