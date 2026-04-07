

# Plano: Formulário de Agendamento no Drawer de Tratativa

## Resumo

Substituir o placeholder pós "Confirmar falha" por um formulário completo de agendamento dentro do drawer, com card de confirmação pós-salvamento e integração com o calendário de Serviços de Campo.

## Alterações no banco de dados

### 1. Novo valor no enum `tipo_servico`
Adicionar `manutencao_rastreador` ao enum para distinguir visualmente no calendário.

### 2. Colunas extras em `manutencao_tratativas`
Adicionar campos para persistir o agendamento diretamente na tratativa:
- `endereco_tipo` (text) — 'cadastro', 'trabalho', 'outro'
- `endereco_texto` (text) — endereço digitado quando tipo = outro/trabalho sem cadastro
- `endereco_referencia` (text) — referência/complemento
- `periodo_agendamento` (text) — 'manha', 'tarde', 'integral'
- `tecnico_id` (uuid, FK profiles)
- `tipos_ocorrencia` (text[]) — array de checkboxes selecionados
- `observacoes_tecnico` (text)
- `taxa_visita_aplicar` (boolean, default false)
- `taxa_visita_observacao` (text)
- `servico_id` (uuid, FK servicos) — referência ao serviço criado no calendário

## Componentes

### 3. `AgendamentoManutencaoForm.tsx` (novo)

Formulário completo com as seções:
- **Local da visita**: 3 cards (Cadastro / Trabalho / Outro) + campo referência
- **Data e período**: DatePicker (min amanhã) + 3 botões (Manhã/Tarde/Integral — Integral mapeado como 'manha' na tabela servicos)
- **Técnico**: Select usando `useInstaladores()` do `useRotas.ts` + opção "A definir"
- **Tipo de ocorrência**: 5 checkboxes (Troca rastreador, Reparação fiação, Problema chip/sinal, Violação terceiros, Diagnóstico)
- **Taxa de visita**: Card amarelo com toggle + campo observação condicional
- **Observações para o técnico**: Textarea
- **Botão Confirmar**: desabilitado até local + data + período + ≥1 ocorrência

### 4. `CardConfirmacaoAgendamento.tsx` (novo)

Card azul claro pós-agendamento com:
- Resumo (data, período, técnico, endereço, ocorrências, observações)
- Botão "Notificar via WhatsApp" → `abrirWhatsAppWeb` com mensagem template
- Botão "Reagendar" → volta ao formulário pré-preenchido

### 5. Integração no `TratativaDrawer.tsx`

No bloco `etapaAtual === 'concluido'`:
- Se `tratativa.status === 'agendado'` e `!tratativa.servico_id` → mostrar `AgendamentoManutencaoForm`
- Se `tratativa.status === 'agendado'` e `tratativa.servico_id` → mostrar `CardConfirmacaoAgendamento`
- Se `tratativa.status === 'resolvido_sem_visita'` → manter card de conclusão atual

### 6. Hook `useTratativaDrawer.ts` — nova mutation `confirmarAgendamento`

Ao confirmar:
1. Buscar dados do associado (endereço, telefone)
2. Inserir registro na tabela `servicos` com `tipo = 'manutencao_rastreador'`, dados de endereço, data, período, técnico
3. Atualizar `manutencao_tratativas` com todos os campos do agendamento + `servico_id`
4. Inserir log com ação `agendamento_confirmado` e dados resumidos
5. Invalidar queries

### 7. Calendário de Serviços de Campo

Identificar onde o calendário renderiza serviços e adicionar lógica para:
- Cor laranja quando `tipo = 'manutencao_rastreador'`
- Título: "Manutenção — [PLACA]"

## Arquivos criados/modificados

- **Criado**: migration SQL (enum + colunas)
- **Criado**: `src/components/monitoramento/manutencao-rastreadores/AgendamentoManutencaoForm.tsx`
- **Criado**: `src/components/monitoramento/manutencao-rastreadores/CardConfirmacaoAgendamento.tsx`
- **Modificado**: `src/components/monitoramento/manutencao-rastreadores/TratativaDrawer.tsx`
- **Modificado**: `src/hooks/useTratativaDrawer.ts`

