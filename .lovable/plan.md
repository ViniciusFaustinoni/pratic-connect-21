## Diagnóstico

A função `sga-hinova-sync` produz cadastros incorretos no SGA por 4 causas distintas, todas confirmadas em código e banco:

### 1. Consultor errado (vendedor)
`supabase/functions/sga-hinova-sync/index.ts` (linhas 872–884) tem um fallback que pega "qualquer vendedor com `codigo_sga_voluntario`" quando o vendedor real do contrato não tem código configurado.

- Apenas **4 de 228 vendedores** (vendedor_clt + vendedor_externo + agencia) possuem `codigo_sga_voluntario`.
- Quando o vendedor do contrato não tem código, o sistema atribui o cadastro a um dos 4 cadastrados — sempre os mesmos.
- Acima ainda existe um segundo fallback de último recurso: `codigo_voluntario = '1'` (linha 1408).

### 2. Placa enviada para 0KM
O `veiculoPayload` (linhas 1439–1458) envia `veiculo.placa` direto.
Para veículos 0KM a placa é um placeholder técnico no formato `0KM` + 5 caracteres (`0KMA1B2C`), gerado para satisfazer constraint UNIQUE/NOT NULL.
O `sga-hinova-sync` não detecta esse placeholder e envia essa string ao SGA como se fosse placa real.

### 3. Plano, valor de mensalidade, valor de adesão e benefícios não enviados
O `veiculoPayload` enviado a `/veiculo/cadastrar` contém apenas dados físicos do veículo (placa, chassi, renavam, FIPE, cor, combustível, voluntário, conta).

Não envia:
- `codigo_plano` (Hinova cai num plano default da `codigo_conta`)
- `valor_mensalidade`
- `valor_adesao`
- `produtos_vinculados` (benefícios e coberturas adicionais)

A tabela `hinova_mapeamentos` confirma que só há mapeamento para `cor`, `combustivel`, `tipo_veiculo`, `tipo_foto` — **não existe mapeamento de plano local → código SGA**. A tabela `planos` tem apenas a coluna genérica `codigo` (texto livre).

### 4. Sem reenvio de placa após emplacamento
Quando o associado recebe a placa definitiva do veículo 0KM, não há fluxo que atualize o cadastro no SGA (`/veiculo/atualizar`) com a placa real.

---

## Plano de correção

### A. Banco: novo mapeamento de plano e coluna `codigo_sga` por plano

Migration:

1. Adicionar coluna `codigo_sga_plano` (text) em `public.planos` para o código do plano no SGA.
2. Adicionar coluna `codigo_sga` (text) em `public.benefits` (ou `planos_beneficios`) para mapear cada produto vinculado.
3. Criar índices únicos parciais para evitar códigos duplicados ativos.

> Migrations não tocam dados; apenas estrutura.

### B. Edge function `sga-hinova-sync` — 4 correções

1. **Vendedor**:
   - Remover o fallback "qualquer vendedor".
   - Se o vendedor do contrato não tem código → registrar erro `vendedor_sem_codigo_sga`, marcar `status_sga = 'erro_sincronizacao'` e enfileirar (`upsertSyncQueue`) com mensagem clara.
   - Se não houver vendedor identificado → mesmo tratamento.
   - Manter o `codigo_voluntario = '1'` somente como rede de segurança absoluta com log de warning explícito.

2. **Placa 0KM**:
   - Importar `isPlacaPlaceholder` (replicar a regex no shared da função, pois edge functions não importam de `src/`).
   - Se a placa é placeholder → enviar `placa: ''` (Hinova v2 aceita veículo sem placa em cadastro 0KM) ou bloquear o sync até emplacamento, conforme a regra escolhida.

3. **Plano + valores + benefícios**:
   - Buscar do contrato: `plano_id`, `valor_mensal`, `valor_adesao`, `valor_adicional`.
   - Carregar `planos.codigo_sga_plano` correspondente.
   - Carregar `planos_beneficios` do plano + códigos SGA.
   - Adicionar ao `veiculoPayload`:
     - `codigo_plano` (numeric, do mapeamento)
     - `valor_mensalidade` (do contrato)
     - `valor_adesao` (do contrato, com fallback para `planos.valor_adesao`)
     - `produtos_vinculados`: array `[{ codigo_produto, valor }]` derivado dos benefícios+coberturas do plano com seus valores.
   - Se `codigo_sga_plano` ausente para o plano → erro `plano_sem_codigo_sga`, status_sga = 'erro_sincronizacao', enfileirar.

4. **Reenvio de placa pós-emplacamento**:
   - Adicionar uma nova função utilitária dentro de `sga-hinova-sync` (action: `atualizar_placa`) ou criar `sga-atualizar-veiculo` que dispara `/veiculo/atualizar` quando `veiculos.placa` muda de placeholder para placa real.
   - Trigger PG: criar trigger `AFTER UPDATE` em `veiculos` que enfileira em `sga_sync_queue` com `motivo='placa_atualizada'` quando a placa muda de placeholder → real e `codigo_veiculo_sga IS NOT NULL`.

### C. Tela de gestão de planos (Configurações > Planos)

- Adicionar campo `Código SGA` no formulário de plano e benefício.
- Validação: avisar quando salvar plano sem código SGA marcado como ativo na esteira de venda.

### D. Tela de usuários (Vendedores)

- Já existe `codigo_sga_voluntario` em `profiles`; adicionar **alerta visual** na tela de Atribuição de Grades indicando vendedores ativos sem código SGA configurado, com link para edição.

### E. Reprocessamento de cadastros incorretos já enviados

- Migration de dados (insert tool) NÃO será necessária; apenas alterar status na fila para reprocessar via `cron-sga-retry`:
  ```sql
  UPDATE veiculos SET status_sga = 'erro_sincronizacao' WHERE codigo_veiculo_sga IS NOT NULL AND <critérios de cadastros incompletos>;
  ```
  Será proposto separadamente após a correção da edge function, para você revisar quais cadastros reprocessar.

---

## Ordem de implementação

1. Migration A (estrutura — colunas `codigo_sga_plano` e `codigo_sga`).
2. Patches na edge `sga-hinova-sync` (B1, B2, B3).
3. Trigger + handler para reenvio de placa pós-emplacamento (B4).
4. UI de Planos com campo Código SGA (C).
5. Alerta de vendedores sem código SGA (D).
6. Levantamento de cadastros para reprocessar (E) — apresentado para sua aprovação.

## O que NÃO será feito sem nova confirmação

- Alteração em massa nos cadastros já existentes no SGA (envio de `/veiculo/atualizar` para corrigir histórico) — depende dos códigos SGA dos planos serem cadastrados primeiro.
- Preenchimento automático do `codigo_sga_plano` — você precisará informar os códigos do SGA Hinova de cada plano (eles são definidos no painel Hinova, não temos como inferir).