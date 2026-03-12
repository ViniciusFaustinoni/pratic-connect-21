

# Correções no Fluxo Pós-Pagamento: Atribuição Automática + Notificações WhatsApp

## Diagnóstico (caso Faustinoni)

Consultei os dados e logs em detalhe. Para o Marcos Vinícius Faustinoni:

- **Cotação** `fdb35013` → tipo `autovistoria`, `permite_encaixe: true`, coordenadas presentes
- **Contrato** `53b8a79c` → `adesao_paga: true`
- **Instalação** `717f2e22` → criada corretamente, status `em_rota`, atribuída ao instalador `68f4857b`
- **Serviço** `4f517a61` → `em_rota`, atribuído pelo cron

A atribuição automática **funcionou** neste caso via `cron-atribuir-tarefas`. Porém, há **3 problemas** identificados:

### Problema 1: Rota falha ao ser criada (coluna errada)

Nos logs do cron:
```
"Could not find the 'data' column of 'rotas' in the schema cache"
```
A tabela `rotas` usa `data_rota`, mas o cron usa `data` (linhas 486 e 496). Isso impede a criação da rota do dia e a vinculação dos serviços.

### Problema 2: Nenhuma notificação WhatsApp é enviada

- `criar-instalacao-pos-pagamento` **não envia nenhuma notificação** (nem ao associado, nem ao instalador)
- `cron-atribuir-tarefas` **só envia push para vistorias** (linhas 462-478), mas **ignora instalações** — sem WhatsApp ao associado ("técnico a caminho") nem ao instalador ("nova tarefa")
- A função `atribuir-proxima-tarefa` tem esse fluxo completo (notifica cliente e vistoriador via WhatsApp), mas o cron **não replica essa lógica**

### Problema 3: Falta notificação de "instalação agendada" ao associado

Quando a instalação é criada pós-pagamento, o associado deveria receber a mensagem do template `instalacao_agendada` com data, horário e local. Isso nunca acontece.

## Mudanças

### 1. Corrigir coluna `data` → `data_rota` em `cron-atribuir-tarefas`

Linhas 486, 496: trocar `.eq('data', hoje)` por `.eq('data_rota', hoje)` e `{ data: hoje }` por `{ data_rota: hoje }`.

### 2. Adicionar notificações WhatsApp em `cron-atribuir-tarefas` para instalações

Após a sincronização com a tabela `instalacoes` (linha 438), adicionar a mesma lógica que já existe em `atribuir-proxima-tarefa`:

- **Notificar o associado** via `notificar-cliente` (tipo `tecnico_em_rota`) com dados do técnico, endereço e período
- **Enviar push ao instalador** (já existe para vistorias, replicar para instalações)
- **Notificar o instalador** via WhatsApp (texto livre com dados do cliente, endereço, placa, link WhatsApp do cliente)

Para isso, buscar `associado_id` e dados do profissional/cliente dentro do bloco `if (servico.instalacao_origem_id)`.

### 3. Adicionar notificação `instalacao_agendada` em `criar-instalacao-pos-pagamento`

Após criar a instalação com sucesso (linha 389), invocar `notificar-cliente`:

```typescript
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'instalacao_agendada',
    associado_id: contrato.associado_id,
    dados: {
      data: dataAgendada,
      periodo: periodoValido === 'manha' ? 'Manhã (08:00-12:00)' : 'Tarde (14:00-18:00)',
    },
  },
});
```

Isso usa o template Meta `assistencia_confirmada` já mapeado para `instalacao_agendada`.

### 4. Resumo de arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Corrigir `data` → `data_rota`; adicionar notificações WhatsApp (associado + instalador) para instalações |
| `supabase/functions/criar-instalacao-pos-pagamento/index.ts` | Adicionar notificação `instalacao_agendada` ao associado após criar instalação |

