## Tratamento dos relatos de erro abertos

Há **6 relatos com status `aberto`** na tela Diretoria → Relatos de Erros. Cada um terá: análise → mudança para `em_tratamento` → correção → mudança para `concluído` (com `observacao_diretor` explicando o que foi feito para o reporter testar).

Ordem cronológica reversa (mais novos primeiro):

---

### 1) Kleytonn — "Já aceitei dois ou mais e não está aparecendo no histórico" (MONITORAMENTO)
**ID:** `b33d7038…`

**Diagnóstico:** investigar a aba/tela de "histórico de aceites" do monitoramento. Provavelmente o filtro padrão é por data/usuário e omite registros do dia, ou a invalidação de cache (react-query) não dispara após a ação "Aceitar". Validar query keys e RLS.

**Correção:** ajustar o hook que lista o histórico (filtro padrão = "hoje" sem timezone errado) e garantir `invalidateQueries` na mutation de aceitar.

---

### 2) Kleytonn — "Veículo só aparece nessa aba no Cadastro e não aparece para o monitoramento associar ao técnico" (MONITORAMENTO)
**ID:** `2127cad7…`

**Diagnóstico:** veículo aprovado pelo cadastro não cai na fila do monitoramento para atribuição. Padrão típico: trigger de criação de `agendamentos_base`/`servicos` não disparou, ou status do contrato não foi propagado, ou filtro do board do monitoramento exige campo (rastreador/endereço) ainda não preenchido.

**Correção:** revisar pipeline de aprovação de cadastro → criação de serviço de instalação. Garantir que ao aprovar (com vistoria/contrato OK) o registro entre na lista de "aguardando atribuição" do monitoramento. Adicionar fallback: botão manual no detalhe do associado para "Enviar para monitoramento".

---

### 3) Teste — "Planilha com veículos com erro no SGA" (cadastro)
**ID:** `43aaa131…`

**Diagnóstico:** complementar do relato #4. Não há planilha anexada na descrição; tratar em conjunto com #4 (mesma raiz).

**Correção:** mesma do item #4. Marcar como concluído referenciando o tratamento do #4 e pedir reenvio da planilha caso queira reprocessamento individual.

---

### 4) Teste — "Erros na migração para o SGA: cor, combustível, voluntário, plano errados; documentos/proposta enviados manualmente; vistoria não foi pro SGA" (cadastro)
**ID:** `0ab7e65c…`

**Diagnóstico:** edge function `sga-hinova-sync` já foi reforçada nesta sessão para incluir fotos. Os campos relatados (cor, combustível, voluntário/indicador, plano, documentos, proposta, vistoria) são mapeamentos no payload Hinova. Auditar mapeamento atual:
- Cor → vem de `veiculos.cor` mas pode estar usando label vs. código Hinova.
- Combustível → idem (Hinova tem código numérico).
- Voluntário/indicador → campo `indicador_id` precisa virar código de voluntário Hinova.
- Plano → usar `plano.codigo_hinova` (se existir) em vez do nome.
- Documentos/proposta → upload para SGA via endpoint de anexos (hoje provavelmente só envia metadados).
- Vistoria → criar registro de vistoria na Hinova após conclusão.

**Correção:** atualizar `sga-hinova-sync` com o mapeamento correto + endpoint de upload de documentos/proposta/vistoria. Rodar reprocessamento dos cadastros marcados.

---

### 5) Kaike — "Erro ao usar a função de Liberar o Serviço do Técnico" (MONITORAMENTO)
**ID:** `a4ea4264…`

**Diagnóstico:** o botão `LiberarServicoButton` chama RPC `liberar_servico_admin`. O RPC valida motivo, papel e status. Possíveis causas do erro:
- Status do serviço fora da lista (`agendada/em_rota/em_andamento/imprevisto_pendente`) — mensagem genérica para o usuário.
- Faltando invalidar `agendamentos_base` (o card volta a aparecer travado).
- Permissão: Kaike provavelmente é Coordenador de Monitoramento — já permitido, então não é isso.

**Correção:** 
- Melhorar tratamento de erro no botão (mensagem clara: "serviço já está concluído/cancelado").
- Estender RPC para também fechar `agendamentos_base` vinculado (aplica regra de dedupe/sincronização já documentada na memória `dedupe-agendamentos-rule`).
- Invalidar também `['agendamentos-base']` e `['monitoramento-mapa']` após sucesso.

---

### 6) Leonardo — "Não tá gerando contrato do cliente" (não gera contrato)
**ID:** `7813b9df…`

**Diagnóstico:** descrição vaga. Verificar logs do edge `generate-contract` / `gerar-proposta` para o usuário Leonardo nas últimas horas, identificar a cotação/associado. Causas comuns: créditos Autentique esgotados, template não vinculado ao plano, variável obrigatória faltando.

**Correção:** identificar a cotação alvo via logs, corrigir o gatilho/variável faltante, e adicionar log mais explícito de erro no fluxo público para o consultor ver o motivo real.

---

## Fluxo padrão por item
Para cada relato:
1. `UPDATE error_reports SET status='em_tratamento', tratado_em=now(), tratado_por=<diretor>` antes de iniciar.
2. Implementar a correção (código + migration se necessário).
3. `UPDATE error_reports SET status='concluido', concluido_em=now(), observacao_diretor='<resumo do que foi feito + como testar>'`.

## Detalhes técnicos
- Atualizações de `error_reports` via tool de insert/update (não migration).
- Correção #4 envolve edge function `sga-hinova-sync` — pode requerer secret de upload Hinova (verificar se já existe).
- Correção #5 envolve nova migration alterando RPC `liberar_servico_admin`.
- Correção #1, #2, #5: ajustes em hooks React e componentes do módulo monitoramento.
- Correção #6 começa com investigação em logs (`supabase--edge_function_logs`) antes de codar.

## Pergunta antes de executar
Os relatos #3 (planilha sem anexo) e #6 (Leonardo, sem detalhes) são vagos. Posso:
- (a) Marcar #3 como duplicata do #4 e tratá-los em conjunto;
- (b) Para #6, investigar logs do Leonardo nas últimas 6h e tentar deduzir a causa.

Confirma seguir assim?
