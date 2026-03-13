

## Plano: Renomear "Iniciar Percurso" para "Iniciar Tarefa"

### Contexto
O botão "Iniciar Percurso" no app do instalador já executa a lógica correta: muda o status do serviço para `em_rota` e dispara a notificação WhatsApp ao associado via `notificar-inicio-rota`. O problema identificado é apenas de nomenclatura — o usuário espera um botão chamado "Iniciar Tarefa".

### Alteração

**Arquivo**: `src/components/vistoriador/TarefaAtualCard.tsx`

- Linha 382: Renomear o texto do botão de `Iniciar Percurso` para `Iniciar Tarefa`
- Linha 380: Trocar o ícone `Route` por `Play` (mais intuitivo para "iniciar")

Nenhuma alteração de lógica, hooks ou edge functions é necessária. O comportamento permanece idêntico:
1. Instalador clica "Iniciar Tarefa"
2. Status muda para `em_rota`
3. `notificar-inicio-rota` é chamada em background
4. Associado recebe WhatsApp com template `tecnico_em_rota`

