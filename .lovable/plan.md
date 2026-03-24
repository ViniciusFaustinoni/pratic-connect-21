

# Corrigir notificações WhatsApp na atribuição de vistoria/instalação

## Problema

Na `cron-atribuir-tarefas`, quando uma tarefa de vistoria ou instalação é atribuída:

1. **Associado NAO recebe notificação** — para vistorias, nenhuma notificação é enviada ao associado em nenhum momento; para instalações, foi removida da atribuição e adiada para o "Iniciar Tarefa"
2. **Vistoriador recebe mensagem genérica** (linha 785: apenas nome + endereço + data) — faltam dados do veículo, telefone do associado, período, e observações

## Solução

Editar a edge function `cron-atribuir-tarefas` para adicionar notificações completas no momento da atribuição.

## Arquivo

| Arquivo | Ação |
|---------|------|
| `supabase/functions/cron-atribuir-tarefas/index.ts` | **Editar** |

## Detalhes

### 1. Notificar ASSOCIADO via `notificar-cliente` (tipo `tecnico_em_rota`)

Após a atribuição de **vistorias** (bloco `vistoria_origem_id`, após linha 801), adicionar chamada ao `notificar-cliente` com tipo `tecnico_em_rota` — o mesmo template `tecnico_a_caminho_1` já mapeado na função `notificar-cliente`. Buscar `associado_id` da tabela `vistorias` (join com `associados` para obter nome/telefone) e dados do vistoriador atribuído.

Fazer o mesmo para **instalações** (reverter a remoção da linha 668-670): chamar `notificar-cliente` com tipo `tecnico_em_rota` usando dados do técnico atribuído.

### 2. Melhorar mensagem WhatsApp ao VISTORIADOR (linha 782-796)

Substituir a mensagem genérica por uma completa com:
- Nome e telefone/WhatsApp do associado
- Veículo (placa, marca, modelo)
- Endereço completo
- Data e período
- Observações (se houver)

Isso requer buscar dados da vistoria com join em `associados` e `veiculos` (similar ao que já é feito para instalações na linha 648-651).

### 3. Melhorar mensagem WhatsApp ao INSTALADOR (linha 702-707)

A mensagem ao instalador (instalações) já está boa, mas falta o período. Adicionar `periodo` à mensagem.

### Fluxo resultante

```text
Atribuição automática (cron)
├── Instalação
│   ├── WhatsApp ao INSTALADOR: dados completos do cliente + veículo + endereço
│   └── WhatsApp ao ASSOCIADO: "técnico a caminho" (template tecnico_a_caminho_1)
└── Vistoria
    ├── WhatsApp ao VISTORIADOR: dados completos do cliente + veículo + endereço
    └── WhatsApp ao ASSOCIADO: "técnico a caminho" (template tecnico_a_caminho_1)
```

