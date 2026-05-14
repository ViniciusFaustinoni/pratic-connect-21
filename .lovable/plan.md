## Causa raiz comprovada (caso Gleice — LTV3631, Fiat Uno 1.0, FIPE R$ 28.240, álcool/gasolina)

Sequência reconstruída a partir de `ativacao_status_log`, `instalacoes`, `servicos` e `vistorias`:

```
11:23:55.286  contratos.aprovado_em                              ← aprovar-proposta
11:23:55.474  associados: pendente_vistoria → aguardando_instalacao   (db:trigger)
11:23:58.066  instalacoes (id=c0059247) INSERT  status=concluida, dispensa_rastreador=false
              └─ trigger sync_instalacao_to_servicos cria servicos
                 (id=5c15ccc6, tipo='instalacao', protocolo INS-2026-00150)
11:24:03.239  associados: aguardando_instalacao → ATIVO          (logged as db:trigger,
                                                                  source GUC nunca seteado)
11:24:03.340  ativacao_status_log idem-side-effects
              source = edge:ativar-associado ← edge:criar-instalacao-pos-pagamento
              payload: { aguardar_instalacao:true, motivo:'adesao_isenta_pos_instalacao' }
16:34–16:42   técnico vai ao endereço, conclui o servico (decisao_instalador='aprovado')
16:35:02      vistoria (id=8abc0e61, tipo='entrada') criada, segue 'em_analise' até hoje
```

### Por que o associado virou `ativo` automaticamente

1. **`criar-instalacao-pos-pagamento` chamou `ativar-associado`** logo após o cliente concluir a etapa "Instalação" do link público — a edge não sabe que para FIPE < 30k carro / 9k moto não-Diesel **não existe instalação**, só vistoria. Linhas 919–977 chamam `ativar-associado` para qualquer cotação `inclusao` ou `adesao` isenta, independentemente do veículo precisar de rastreador.

2. **`ativar-associado` promoveu `associados.status` para `'ativo'`** mesmo com `aguardar_instalacao=true` no body. O log (.239) registra a transição `aguardando_instalacao → ativo` e logo depois (.340) o próprio edge faz o log de side-effects idempotentes — confirmando que a versão deployada hoje aceitou a chamada e gravou `ativo` (a regra de manter em `aguardando_instalacao` quando `aguardar_instalacao=true` não barrou esse caso, seja porque o flag não chegou, seja porque o trigger trans-atualizou).

3. **Trigger `fn_sync_contrato_status_apos_ativacao`** então propagou `contratos.status='ativo'`.

4. **Trigger `sync_instalacao_to_servicos`** materializou um `servicos.tipo='instalacao'` para uma "instalação" que nunca deveria ter existido (veículo dispensa rastreador). É o que sustenta a falsa fila de instalação, faz o técnico aparecer no roteiro e leva a `decisao_instalador='aprovado'` — fechando o ciclo.

5. A `vistorias` (tipo='entrada', em_analise) foi criada às 16:35 e está pendente até agora — prova de que a Aprovação de Associados nunca foi acionada para este caso.

Resultado: `associado=ativo`, `contrato=ativo`, `veiculo=em_analise`, vistoria pendente, sem aprovação humana — exatamente o estado relatado.

### Fluxo correto para FIPE < 30k carro / < 9k moto não-Diesel (memória `mem://logic/operations/vistoria-sem-rastreador-flow`)

1. Cadastro aprovado → contrato `liberada_para_assinatura` / `aguardando_vistoria`. **Nenhuma instalação criada**, nenhum técnico despachado para instalar.
2. Cliente faz **autovistoria** (link público, fotos) ou agenda **vistoria presencial** (técnico só fotografa, sem rastreador).
3. Vistoria entra em `Monitoramento › Aprovações › Aprovação de Associados` com `status='em_analise'`.
4. **Somente após aprovação manual da vistoria**, `aplicar-conclusao-vistoria` chama `ativar-associado` (sem `aguardar_instalacao`) e promove associado/contrato/veículo para `ativo`.

## Plano de correção

### 1. `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- Antes do bloco "9. CHAIN ATIVAÇÃO" (linha 919), calcular se o veículo precisa de rastreador (mesma fn `precisaRastreador` de `aprovar-proposta`, considerando combustível Diesel, FIPE e tipo moto/carro com configurações `fipe_minimo_rastreador*`).
- Se **não precisa de rastreador**, **não chamar** `ativar-associado`. Em vez disso:
  - Garantir que o registro existente em `instalacoes` para esse veículo NÃO seja criado (ou seja convertido para `vistorias.tipo='entrada'` agendada com a mesma data/endereço/period). A âncora do link público passa a ser a `vistorias` (não a `instalacoes`).
  - Logar claramente o motivo (`fluxo=vistoria_sem_rastreador`).
- Mensagem `notificar-cliente` muda para `vistoria_agendada` em vez de `instalacao_agendada` quando aplicável.

### 2. `supabase/functions/aprovar-proposta/index.ts`
- No loop de veículos (linhas 206–401), quando `veiculoPrecisaRastreador===false`:
  - **Não criar `instalacoes`** (mesmo com `dataAgendada`). Criar `vistorias` (tipo='entrada', status='agendada') com endereço/data/período da cotação.
  - `gerar-link-vistoria-publica` deve aceitar âncora `vistoria_id` (já aceita `instalacao_id`); se ainda não aceita, adicionar fallback.

### 3. Defesa em profundidade no banco
Migration nova:
- **Trigger `BEFORE INSERT/UPDATE` em `instalacoes`** (`fn_bloquear_instalacao_sem_rastreador`): rejeita INSERT/UPDATE quando o veículo dispensa rastreador (FIPE/Diesel/tipo) E `dispensa_rastreador IS NOT TRUE`. Garante que nenhum caminho legado (cron, RPC, edge antiga) consiga criar instalação fantasma novamente.
- **Trigger guard em `ativar-associado` flow**: ajustar `fn_sync_contrato_status_apos_ativacao` para exigir, além de `associados.status='ativo'`, que exista `vistorias` aprovada para o `contrato_id` (status='aprovada' ou 'aprovada_ressalvas') quando a cotação for `vistoria_sem_rastreador`. Sem vistoria aprovada o contrato fica em `assinado` mesmo se associado for promovido por engano.
- **Função utilitária** `fn_veiculo_precisa_rastreador(_veiculo_id uuid) returns boolean` para ser chamada pelos triggers acima e por edges, eliminando duplicação de regra.

### 4. Reparo do caso da Gleice
Migration de hotfix no mesmo arquivo:
- `associados.status` → `aguardando_instalacao` (ou `em_analise` se preferir reentrada na fila).
- `contratos.status` → `assinado`, `data_ativacao=NULL`.
- `veiculos.status` mantém `em_analise`, garantir `cobertura_total=false`, `cobertura_roubo_furto=false`.
- Apagar `instalacoes` id=`c0059247…` e `servicos` id=`5c15ccc6…` (instalação fantasma + servico materializado). Manter a `vistorias` 8abc0e61 em `em_analise` para aparecer corretamente em **Monitoramento › Aprovações › Aprovação de Associados**.
- Inserir registro em `ativacao_status_log` documentando o reset (source `manual:hotfix-ltv3631`).

### 5. Sanity sweep (read-only, depois aplicar mesmo hotfix)
Listar todos os outros casos com o mesmo padrão para reverter em lote:

```sql
SELECT v.placa, v.valor_fipe, v.combustivel, c.id contrato_id, a.id assoc_id
FROM associados a
JOIN contratos c ON c.associado_id=a.id AND c.status='ativo'
JOIN veiculos v ON v.id=c.veiculo_id
WHERE a.status='ativo'
  AND v.status='em_analise'
  AND NOT EXISTS (SELECT 1 FROM vistorias vi
                  WHERE vi.veiculo_id=v.id
                    AND vi.status IN ('aprovada','aprovada_ressalvas'));
```
Se vier mais de 1 registro, aplicar o mesmo reset transacionalmente.

## Pontos técnicos relevantes

- A regra `precisaRastreador` hoje considera apenas FIPE; a versão correta (memória `tracker-eligibility-and-contract-logic-v2`) inclui Diesel obrigatório. A nova `fn_veiculo_precisa_rastreador` deve consolidar: `combustivel ILIKE '%diesel%' OR (tipo='automovel' AND fipe>=fipe_min_carro) OR (tipo='moto' AND fipe>=fipe_min_moto)`.
- O trigger `sync_instalacao_to_servicos` continua válido para fluxo com rastreador. O bloqueio na origem (`instalacoes`) impede que ele dispare indevidamente.
- `aplicar-conclusao-vistoria` já chama `ativar-associado` corretamente (com `source='edge:aplicar-conclusao-vistoria'`); nada muda lá.
- Não mexer em `cron-reconciliar-instalacoes` — passa a só promover veículo para `ativo` quando `vistorias` aprovada existir, via guard do banco.

## Entregas

1. Edits em `aprovar-proposta` e `criar-instalacao-pos-pagamento`.
2. Migration única com: `fn_veiculo_precisa_rastreador`, trigger bloqueio em `instalacoes`, ajuste em `fn_sync_contrato_status_apos_ativacao`, hotfix da Gleice, sweep dos demais casos órfãos.
3. Validação manual após deploy: re-executar fluxo com placa fictícia FIPE<30k não-Diesel e confirmar que o caso aparece em Aprovação de Associados sem ativar.
