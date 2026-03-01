

# Analise do Processo de Imprevistos no App do Instalador

## O que JA esta funcionando corretamente

O processo de imprevistos **ja existe e funciona** no app do instalador. O card de tarefa atual (`TarefaAtualCard`) e compartilhado entre vistoriadores e instaladores, e ja inclui:

1. **Botao "Comunicar Imprevisto"** -- aparece para qualquer tarefa atribuida (instalacao, manutencao, retirada, vistoria) nos status agendada, em rota ou em andamento
2. **Modal de registro** -- com selecao de motivo (Associado ausente, Endereco incorreto, Problema no veiculo, Desistencia, Outro) e campo de observacoes
3. **Duplo Check obrigatorio** -- apos registrar o imprevisto, exige que o instalador entre em contato com o associado (WhatsApp ou Ligacao) antes de confirmar
4. **Envio automatico de link de reagendamento** -- apos o duplo check, o status muda para "nao_compareceu" e um link de reagendamento e enviado via WhatsApp

## Problemas identificados (2 gaps)

### Gap 1: Cron de reagendamento automatico ignora instalacoes/manutencoes/retiradas

O job diario que roda as 18h (BRT) para tarefas nao iniciadas **so processa vistorias**. Ele filtra apenas por:
- `vistoria_adesao`
- `vistoria_transferencia`
- `vistoria_substituicao`
- `revistoria`

Isso significa que se uma instalacao, manutencao ou retirada agendada nao for iniciada no dia, o sistema NAO envia automaticamente o link de reagendamento ao associado.

**Correcao**: Adicionar os tipos `instalacao`, `manutencao` e `retirada` ao filtro `.in("tipo", [...])` da edge function `cron-reagendamento-automatico`.

### Gap 2: Mensagem de reagendamento menciona apenas "vistoria"

A edge function `enviar-link-reagendamento` envia a mensagem: *"sua **vistoria** nao pode ser realizada"*. Quando o servico e uma instalacao ou manutencao, isso confunde o associado.

**Correcao**: Buscar o campo `tipo` do servico e adaptar a mensagem:
- Vistoria: "sua vistoria"
- Instalacao: "a instalacao do rastreador"
- Manutencao: "a manutencao do rastreador"
- Retirada: "a retirada do rastreador"

## Alteracoes necessarias

### Arquivo 1: `supabase/functions/cron-reagendamento-automatico/index.ts`

Expandir o filtro de tipos para incluir todos os servicos de campo:

```text
.in("tipo", [
  "vistoria_adesao",
  "vistoria_transferencia",
  "vistoria_substituicao",
  "revistoria",
  "instalacao",
  "manutencao",
  "retirada",
])
```

### Arquivo 2: `supabase/functions/enviar-link-reagendamento/index.ts`

1. Adicionar `tipo` ao select do servico
2. Criar mapa de labels por tipo de servico
3. Usar o label correto na mensagem de WhatsApp

```text
// Mapa de labels
const TIPO_LABELS = {
  vistoria_adesao: "vistoria",
  vistoria_transferencia: "vistoria",
  vistoria_substituicao: "vistoria",
  revistoria: "vistoria",
  instalacao: "instalação do rastreador",
  manutencao: "manutenção do rastreador",
  retirada: "retirada do rastreador",
};

// Mensagem adaptada
const tipoLabel = TIPO_LABELS[servico.tipo] || "serviço";
const mensagem = `Olá ${primeiroNome}, seu(sua) ${tipoLabel} não pôde ser realizado(a). ...`;
```

## Resumo

| Item do Processo | Status | Acao |
|---|---|---|
| Botao de imprevisto no card do instalador | Funcionando | Nenhuma |
| Modal com motivos e observacoes | Funcionando | Nenhuma |
| Duplo check com associado | Funcionando | Nenhuma |
| Link de reagendamento via WhatsApp | Funcionando | Corrigir mensagem |
| Cron diario as 18h para tarefas nao iniciadas | Parcial | Incluir instalacao/manutencao/retirada |

Apenas **2 arquivos** de edge functions precisam ser ajustados. Nenhuma alteracao no frontend e necessaria.

