# Por que Maya não respondeu o "Gostaria de solicitar um reboque"

## Diagnóstico (caso THAIS / 5521992593830 — 03/06 13:23 BRT)

Cronologia real no banco + logs:

```
16:23:49  Cliente: "Gostaria de solicitar um reboque"
16:23:58  Maya:    "informe o seu CPF"              ← via Meta ✓
16:24:16  Cliente: "15230046732"
16:24:22  Maya:    "Encontrei você, THAIS!"         ← via Meta ✓
16:24:48  Cliente: "Gostaria de solicitar um reboque"   ← repetiu
16:24:58  [transbordo] aberto, motivo='sinistro_emergencia', prioridade='alta'
16:25:04  agente-consultor-ia: "Resposta final (150 chars)"
16:25:06  whatsapp-send-text: ERRO "WhatsApp não está conectado"
          ❌ NENHUMA mensagem foi para o WhatsApp da cliente
```

Tem **dois bugs encadeados**, ambos de Maya, mais um item cosmético do painel.

---

## Bug 1 — força Evolution para a própria resposta (Evolution está caído)

`supabase/functions/agente-consultor-ia/index.ts` linha 2188 envia toda
resposta da Maya com `force_provider: "evolution"`.

Estado real das instâncias hoje:

| instância    | provedor | status         | principal |
|--------------|----------|----------------|-----------|
| sga-pratic   | evolution| `disconnected` | sim       |
| meta-whatsapp| meta     | `open`         | não       |

Todos os disparos sistêmicos (template "Encontrei você", cobranças,
serviço atribuído) vão via Meta e chegam. Só as respostas da Maya morrem,
porque o force_provider ignora o provedor ativo e tenta uma Evolution que
está down — log explícito `WhatsApp não está conectado`.

Isso é a causa direta de "Maya não respondeu nada após o reboque": ela
respondeu, mas o envio caiu silenciosamente.

**Correção:** remover `force_provider: "evolution"` em `enviarWhatsApp`
(linha 2188). Sem o force, o `whatsapp-send-text` usa o provedor ativo
(hoje Meta) — mesmo caminho que já funciona para todo o resto.

## Bug 2 — Maya transbordou em vez de responder pela FAQ

A regra canônica (memória `transbordo-relacionamento-canonico` + prompt
linhas 703-705) é clara:

> Reboque, guincho, pane, chaveiro, bateria, pneu → resolve pela FAQ de
> Assistência 24h (canais 0800 + WhatsApp). NÃO chamar
> solicitar_atendente_humano.

Mesmo assim a Maya classificou "Gostaria de solicitar um reboque" como
`motivo='sinistro_emergencia'` e abriu transbordo. Duas causas prováveis,
ambas no prompt:

1. A linha 699 já manda enviar FAQ + transbordar para "sinistro real"
   (acidente/roubo/furto/colisão/incêndio). O modelo está estendendo essa
   regra a reboque porque a palavra fica próxima de "emergência".
2. A regra anti-transbordo da 704 está descritiva, sem exemplo do
   classificador. Falta um veto explícito do tipo "reboque NUNCA é
   motivo='sinistro_emergencia'".

**Correção do prompt em `agente-consultor-ia/index.ts` (linhas 694-706):**

- Reforçar no bloco "QUANDO NÃO TRANSBORDAR" (704): listar reboque/guincho/
  pane/chaveiro/bateria/pneu como **assistência operacional pura** e
  proibir `motivo='sinistro_emergencia'` para esses casos.
- Adicionar regra de ordem: primeiro buscar resposta na FAQ; só
  transbordar se a FAQ não cobrir.
- Deixar explícito que `sinistro_emergencia` é exclusivo de acidente,
  colisão, batida, roubo, furto e incêndio — nada mais.

## Bug 3 (cosmético) — painel mostra mensagens antigas no topo

O ChatPanel está correto: `useWhatsAppHistorico` retorna as mensagens
desse telefone (a entrada "Gostaria de solicitar um reboque" das 13:24
está no banco e seria renderizada). O que o usuário vê na captura é o
**topo** da timeline com 3 mensagens muito parecidas de 15/04 (welcome
de lead "Sou o Vinicius, consultor virtual…"), porque o auto-scroll dispara
antes do conteúdo terminar de medir altura quando há muitas mensagens
antigas no histórico. Não é dados faltando — é ordem de render.

**Correção opcional (só se quiser fechar nessa mesma rodada):** no
ChatPanel `useEffect` de rolagem inicial (linhas 121-131), trocar o
`setTimeout(80)` por um `ResizeObserver` no viewport que reescaneia até
`scrollHeight` parar de crescer, então rola para o fim. Sem isso, o
painel ainda funciona — basta o operador rolar uma vez para baixo.

Se quiser, deixo a parte 3 para depois e foco em 1 e 2 — que são o
"Maya silenciosa" de verdade.

---

## Limpeza do caso atual

A pausa `transbordo_humano` da THAIS expira às 13:29 BRT (curta porque
o resumo já foi marcado como `encerrado_humano`). Após o fix 1+2, a
próxima mensagem dela já recebe FAQ de Assistência 24h normalmente.
Nenhum ajuste manual no banco é necessário.

## Validação pós-deploy

1. Deploy `agente-consultor-ia` (com fix 1 + 2).
2. Esperar a pausa da THAIS expirar (≤5 min).
3. Pelo WhatsApp dela, repetir "Gostaria de solicitar um reboque".
4. Confirmar nos logs: `whatsapp-send-text … via Meta` + linha em
   `whatsapp_mensagens` com a resposta de FAQ (telefones de Assistência
   24h), SEM novo transbordo.

## Memória

Atualizar `mem://logic/operations/transbordo-relacionamento-canonico`
adicionando: "Toda resposta da Maya sai pelo provedor ativo
(`whatsapp-send-text` sem `force_provider`). Hardcode de provedor na
edge da IA quebra atendimento quando o provedor preferido cai."
