
# Integração Eventos → Jurídico (5 Pontos)

## Diagnóstico

Auditei todos os componentes e identifiquei o que falta em cada ponto de integração:

### Ponto 1 — Sindicância "Irregular"
O `ConcluirSindicanciaModal` já cria um registro em `processos`, mas está incompleto:
- Não puxa o `associado_id` do sinistro para vincular ao processo
- Não inclui dados do veículo no objeto do processo

### Ponto 2 — Carta de Cancelamento
O resultado `carta_cancelamento` atualiza o status para `cancelado`, mas NÃO notifica o jurídico de nenhuma forma. Deveria criar uma `consulta_juridica` para registro formal e suspensão do veículo.

### Ponto 3 — Questão Legal Complexa na Análise
O dropdown de ações do `SinistroDetalhe` tem "Criar Processo Jurídico" (redireciona para o formulário manual) mas NÃO tem "Encaminhar para Jurídico" com criação automática de consulta/caso e mudança de status. Falta um modal dedicado.

### Ponto 4 — Análise Interna Jurídica (Alagamento + Incêndio)
Os cards `CardAnaliseAlagamento` e `CardAnaliseIncendio` marcam `analise_interna=true` no sinistro, mas NÃO criam nenhum registro no módulo jurídico (`consultas_juridicas`). O jurídico não tem visibilidade desses casos.

### Ponto 5 — Indenização Integral (PT / Roubo não recuperado)
Não existe acompanhamento jurídico da documentação de indenização (procuração, CRV, transferência). Este ponto será tratado com criação automática de consulta jurídica quando o fluxo de indenização integral é iniciado.

---

## Alterações Planejadas

### 1. Corrigir ConcluirSindicanciaModal (Pontos 1 e 2)

**Arquivo:** `src/components/sinistros/ConcluirSindicanciaModal.tsx`

Mudanças:
- Adicionar prop `associadoId` e `associadoNome` ao componente
- No resultado `irregular`: incluir `associado_id` no insert de `processos`
- No resultado `carta_cancelamento`: criar registro em `consultas_juridicas` com assunto "Carta de Cancelamento", descricao incluindo dados do evento, prioridade "alta", sinistro_id, associado_id, departamento "eventos"
- No resultado `juridico`: incluir `associado_id` no insert de `processos`

### 2. Criar EncaminharJuridicoEventoModal (Ponto 3)

**Novo arquivo:** `src/components/sinistros/EncaminharJuridicoEventoModal.tsx`

Modal para encaminhar evento diretamente ao jurídico durante a análise:
- Dropdown de motivos: "Disputa de propriedade", "Veículo com gravame judicial", "Espólio / massa falida", "Litígio entre partes", "Outro (especificar)"
- Textarea para descrição detalhada
- Ao confirmar:
  - Cria `consulta_juridica` vinculada ao sinistro com prioridade alta
  - Atualiza status do sinistro para `suspenso`
  - Registra no histórico
  - Registra `motivo_suspensao` no sinistro

### 3. Atualizar CardAnaliseAlagamento e CardAnaliseIncendio (Ponto 4)

**Arquivos:** `src/components/sinistros/CardAnaliseAlagamento.tsx` e `src/components/sinistros/CardAnaliseIncendio.tsx`

Ao encaminhar para análise interna/jurídica, além de marcar `analise_interna=true`, criar automaticamente uma `consulta_juridica` com:
- assunto: "Análise Jurídica — Alagamento" ou "Análise Interna — Incêndio"
- descricao: motivos selecionados formatados
- sinistro_id, associado_id (necessário adicionar prop)
- prioridade: "normal"
- departamento: "eventos"
- Isso garante que o jurídico veja o caso na fila de consultas pendentes

### 4. Criar consulta jurídica automática para indenização integral (Ponto 5)

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx` (ou componente de indenização existente)

Quando o fluxo de indenização integral é acionado (perda total aprovada ou roubo/furto não recuperado), criar automaticamente uma `consulta_juridica` com:
- assunto: "Acompanhamento de Indenização Integral"
- descricao: "Documentação de transferência de propriedade — procuração pública, CRV, transferência"
- sinistro_id, associado_id
- prioridade: "alta"
- departamento: "eventos"

Isso será integrado na lógica existente de iniciar indenização (no componente/modal que já trata isso).

### 5. Integrar EncaminharJuridicoEventoModal no SinistroDetalhe

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx`

- Importar o novo modal
- Adicionar state `modalJuridicoOpen`
- Substituir o item "Criar Processo Jurídico" por "Encaminhar para Jurídico" que abre o modal (manter "Vincular Processo" para casos já existentes)
- O modal cria a consulta automaticamente

### 6. Passar associado_id para CardSindicanciaStatus

**Arquivo:** `src/components/sinistros/CardSindicanciaStatus.tsx`

Adicionar prop `associadoId` e repassar ao `ConcluirSindicanciaModal`.

---

## Resumo de Arquivos

| Ação | Arquivo |
|---|---|
| Modificar | `src/components/sinistros/ConcluirSindicanciaModal.tsx` (associado_id + carta_cancelamento -> juridico) |
| Criar | `src/components/sinistros/EncaminharJuridicoEventoModal.tsx` (modal para ponto 3) |
| Modificar | `src/components/sinistros/CardAnaliseAlagamento.tsx` (criar consulta_juridica) |
| Modificar | `src/components/sinistros/CardAnaliseIncendio.tsx` (criar consulta_juridica) |
| Modificar | `src/components/sinistros/CardSindicanciaStatus.tsx` (passar associadoId) |
| Modificar | `src/pages/eventos/SinistroDetalhe.tsx` (integrar modal + indenização) |

## Migração de Banco

Nenhuma migração necessária. As tabelas `consultas_juridicas` e `processos` já possuem `sinistro_id` e `associado_id`. Todos os campos necessários já existem.

## Ordem de Implementação

1. `ConcluirSindicanciaModal` — corrigir associado_id + carta_cancelamento
2. `EncaminharJuridicoEventoModal` — criar novo modal
3. `CardAnaliseAlagamento` + `CardAnaliseIncendio` — criar consultas jurídicas
4. `CardSindicanciaStatus` — repassar associadoId
5. `SinistroDetalhe` — integrar tudo + indenização integral
