# Por que a IA não respondeu

A Maya **não está quebrada** — ela seguiu a regra. Quando a Julia (Thais) escreveu "Gostaria de solicitar um reboque", o prompt do agente força:

```
Mencionar sinistro, acidente, batida, colisão, roubo, furto, incêndio,
emergência → motivo='sinistro_emergencia', prioridade='alta'
```

Maya classificou como `sinistro_emergencia`, chamou `solicitar_atendente_humano` e a tabela `whatsapp_ia_pausas` ficou ativa até **00:13 BRT** (badge laranja no topo do chat). Por isso o "Quero solicitar um reboque" das 12:38 não recebeu resposta — a IA está pausada esperando humano.

A pronta resposta de Assistência 24h que você criou existe no `maya_ia_faq` (categoria *Assistência*, audiências `associado` + `lead`) e até é injetada no system prompt como BASE DE CONHECIMENTO — mas a regra de transbordo é **mais alta na hierarquia** e é executada antes da Maya considerar a FAQ.

# Correção

Tornar a FAQ de Assistência **precedente** ao transbordo para palavras-chave de assistência veicular (reboque, guincho, pane, socorro mútuo, chaveiro). Para sinistro real (roubo, furto, colisão, batida, acidente, incêndio) o transbordo continua imediato — esses casos exigem atendente humano de fato.

## Edit único em `supabase/functions/agente-consultor-ia/index.ts`

Na seção `## QUANDO CHAMAR A TOOL solicitar_atendente_humano (OBRIGATÓRIO)` (~linha 699):

1. Trocar a regra de gatilho de assistência por:
   - **Reboque / guincho / pane / socorro mútuo / chaveiro / bateria**: NÃO transborde. Responda com os canais da FAQ de Assistência 24h (telefone 0800 + WhatsApp) e ofereça transbordo apenas se o cliente insistir em falar com pessoa.
   - **Sinistro real** (roubo, furto, colisão, batida, acidente, incêndio): mantém transbordo imediato com `motivo='sinistro_emergencia'`, `prioridade='alta'`, mas a resposta de cortesia ANTES da tool deve incluir os canais da FAQ (cliente em emergência precisa do número na hora).

2. Reforçar logo abaixo: "Quando a BASE DE CONHECIMENTO (FAQ) tiver um item que casa com o pedido, USE a resposta da FAQ direto; só transborde se o cliente pedir humano explicitamente ou se a categoria for sinistro real."

## Despausa do caso atual (Julia / 5521985791044)

A pausa vai até 04/06 03:13 UTC. Posso (a) deletar a linha de `whatsapp_ia_pausas` para Maya voltar a responder agora, ou (b) deixar como está (Relacionamento conclui pelo botão "Concluir atendimento"). Sua escolha.

## Fora de escopo

- Não mexer na tool `solicitar_atendente_humano` em si nem no dedupe `agente_ia_locks`.
- Não mexer na FAQ — ela já está correta.
- Não mexer no badge "IA pausada" nem no card de Concluir atendimento.

# Atualização de memória

Atualizar `mem://logic/operations/transbordo-relacionamento-canonico` com a exceção: assistência veicular operacional (reboque/guincho/pane) é resolvida pela FAQ, não por transbordo.
