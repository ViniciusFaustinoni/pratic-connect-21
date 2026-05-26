## Bug
Quando o serviço é `local_vistoria='base'` (cliente vai até a base/oficina — ninguém vai até ele), ao iniciar a tarefa o cliente ainda recebe o WhatsApp **"🚗 Técnico a Caminho!"**. Foi o que aconteceu com CARLOS HENRIQUE em 22/05/2026 (print anexado).

## Causa raiz (código real)

`supabase/functions/notificar-inicio-rota/index.ts`
- Linha 34–75: o `SELECT` em `servicos` **não inclui** `local_vistoria`.
- Linhas 118–195: dispara incondicionalmente `notificar-cliente` com `tipo: 'tecnico_em_rota'` para qualquer serviço, sem distinguir Base × Rota. Comentário no código diz "Esta é a ÚNICA origem desta notificação", confirmando que é o ponto único.

Origem do trigger: `src/hooks/useTarefaAtual.ts:224` (botão "Iniciar Tarefa"). É a única chamada da função em todo o projeto. Confirmei via grep que não há outra rota disparando `tecnico_em_rota`.

Banco confirma o discriminador existente: `servicos.local_vistoria ∈ {cliente, base}` (29 serviços com `base` hoje). Não precisa coluna nova.

## Correção raiz

Editar **um único arquivo** — `supabase/functions/notificar-inicio-rota/index.ts`:

1. Adicionar `local_vistoria` ao SELECT (linha ~49).
2. Antes do bloco "2. Notificar o CLIENTE" (linha 118), guard:
   ```ts
   const ehBase = servico.local_vistoria === 'base';
   if (ehBase) {
     console.log('[notificar-inicio-rota] Serviço local_vistoria=base — cliente NÃO recebe "técnico a caminho" (cliente vai até a base)');
     resultados.cliente_notificado = false;
   } else if (clienteTelefone) { ... fluxo atual ... }
   ```
3. Manter intacto o bloco do profissional (linhas 197–282) — ele continua recebendo os dados da tarefa.

Nenhuma migration, nenhuma mudança de UI, nenhuma alteração no template `notificar-cliente`. Apenas o gate no único ponto de origem.

## Fora de escopo
- Não tocar em vistoria rota / instalação (`local_vistoria='cliente'` ou null permanecem com a notificação atual).
- Não mexer em `useTarefaAtual.ts` — manter o invoke como está (o edge é a barreira correta).
- Sem saneamento histórico (mensagens já enviadas não dá pra desfazer).

## Memória
Após apply, registrar `mem://logic/operations/notificar-inicio-rota-pula-base` deixando claro que `notificar-inicio-rota` é o ÚNICO ponto de origem do template `tecnico_em_rota` e que `local_vistoria='base'` suprime o envio ao cliente (profissional segue notificado).
