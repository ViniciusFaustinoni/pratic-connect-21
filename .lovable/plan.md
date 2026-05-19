# Plano para corrigir a duplicação de tarefas no monitoramento

## Diagnóstico confirmado
- A duplicação não é só visual: já existe **duplicidade real em `public.servicos`**.
- Hoje há pelo menos **15 origens de vistoria duplicadas** (`vistoria_origem_id`) e **4 origens de instalação duplicadas** (`instalacao_origem_id`).
- Também há **duplicação de logs de atribuição manual** para o mesmo `servico_id` e mesmo profissional em poucos segundos, sinal de falta de idempotência no ato de atribuir.
- O problema voltou porque a regra de `vistoria_entrada ≡ instalacao` foi corrigida em pontos isolados, mas **o modelo inteiro ainda aceita múltiplos registros para o mesmo evento físico**.

## Causa raiz
1. **Banco sem trava estrutural**
   - `servicos` não tem unicidade por `instalacao_origem_id` nem por `vistoria_origem_id`.
   - `agendamentos_base` também não está protegido contra múltiplos ativos para a mesma origem.

2. **Modelo canônico ainda inconsistente**
   - O mesmo evento físico aparece ora como `instalacao`, ora como `vistoria_entrada`, e em alguns casos aparecem **os dois**.
   - Existem serviços `instalacao` com `vistoria_origem_id` preenchido, o que mistura duas identidades e favorece duplicação futura.

3. **Criação de registros sem idempotência total**
   - Triggers/funções antigas e correções manuais ainda usam `INSERT` simples ou materialização paralela.
   - Há indício de correções operacionais/manuais que criaram um novo `servico` para uma origem já existente.

4. **Atribuição manual sem proteção suficiente**
   - O fluxo atual permite repetir a atribuição antes de o estado estabilizar.
   - Isso já aparece nos dados como log manual duplicado para o mesmo serviço/profissional.

5. **Tela de monitoramento junta duas fontes sem dedupe de origem**
   - `useServicosParaAtribuir` mistura `servicos` e `agendamentos_base` e pode exibir o mesmo trabalho duas vezes quando ambos representam a mesma visita.

## Plano de correção

### 1) Consolidar a identidade canônica da tarefa
- Definir uma regra única para o “evento físico”:
  - se o fluxo nasce de instalação, a linha canônica em `servicos` deve ser ancorada na origem correta e reutilizada;
  - se for vistoria pura/base, idem;
  - `instalacao` e `vistoria_entrada` devem ser tratados como **a mesma primeira visita**, não como duas tarefas paralelas.
- Revisar todos os pontos que criam serviço para que **atualizem o registro canônico** em vez de inserir um irmão.

### 2) Blindar o banco contra recorrência
- Criar migração de saneamento para:
  - identificar grupos duplicados em `servicos`;
  - escolher o registro canônico por origem;
  - cancelar/mesclar duplicados sem perder histórico útil.
- Depois do saneamento, criar travas de unicidade no banco para impedir recorrência:
  - unicidade em `servicos.instalacao_origem_id` quando houver valor;
  - unicidade em `servicos.vistoria_origem_id` quando houver valor;
  - unicidade de agendamento ativo por origem em `agendamentos_base`.
- Onde houver criação de agendamento/serviço, trocar a estratégia para **upsert/merge atômico com chave de conflito real**.

### 3) Corrigir os geradores de duplicidade
- Revisar e ajustar os fluxos que hoje podem materializar serviço duplicado:
  - triggers `sync_instalacao_*` e `sync_vistoria_*`;
  - RPC `realocar_servico`;
  - fluxos de base e reabertura;
  - qualquer correção/manualização que faça `INSERT INTO servicos` diretamente.
- O objetivo é que toda criação siga a mesma regra: **uma origem = um serviço canônico**.

### 4) Tornar a atribuição manual idempotente
- Mover a atribuição para um caminho atômico no servidor ou endurecer o update atual com guarda de estado.
- Só registrar `servicos_atribuicoes_log` quando houver mudança real de estado.
- Travar duplo clique/reenvio no front enquanto a atribuição estiver pendente.

### 5) Deduplicar a fila do monitoramento pela origem, não pelo tipo textual
- Ajustar `useServicosParaAtribuir` para não mostrar `agendamentos_base` e `servicos` ao mesmo tempo quando ambos representam a mesma tarefa.
- Tratar `instalacao` + `vistoria_entrada` como equivalentes no monitoramento.
- Ajustar também a deduplicação da aba “Serviços” para usar chave lógica de origem, não apenas `associado + veículo + tipo`.

### 6) Validar com cenários de regressão
- Testar estes cenários de ponta a ponta:
  - instalação comum;
  - vistoria de entrada presencial;
  - realocação para base;
  - devolução para fila e reatribuição;
  - reabertura pós-cancelamento;
  - atribuição para prestador.
- Critério de aceite:
  - um único card por tarefa física;
  - um único serviço canônico por origem;
  - um único log por ação real de atribuição;
  - nenhuma nova duplicação mesmo sob clique repetido ou fluxo reprocessado.

## Detalhes técnicos
- O problema principal não deve ser resolvido só com filtro visual.
- A correção precisa ter **3 camadas ao mesmo tempo**:
  1. **modelo canônico**,
  2. **restrição no banco**,
  3. **idempotência no fluxo de atribuição**.
- Sem isso, qualquer ajuste futuro ou correção manual volta a reabrir o bug.

```text
Origem física única
   -> serviço canônico único
   -> agendamento base único ativo
   -> atribuição atômica única
   -> UI exibe uma tarefa só
```

## Resultado esperado
- O monitoramento deixa de criar ou reapresentar tarefas duplicadas.
- `vistoria_entrada` e `instalacao` param de competir entre si pelo mesmo evento.
- Mesmo se o fluxo rodar duas vezes, o banco passa a absorver como atualização, não como nova tarefa.