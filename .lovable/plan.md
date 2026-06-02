## Objetivo

Mostrar um botão **"Concluir atendimento"** no header do chat de Conversas IA sempre que a IA estiver pausada por intervenção humana (e não só nos casos `transbordo_*` que já têm o botão hoje). Ao clicar, a pausa expira na hora e a IA volta a responder na próxima mensagem do cliente.

## Diagnóstico do que existe

- **Hook `useConcluirTransbordo`** (em `src/hooks/useTransbordosAtivos.ts`) já faz exatamente o que precisamos: expira `whatsapp_ia_pausas.pausada_ate=now()`, marca `contexto_cortado_em`, reseta `agente_consultor_contatos.status='ativo'` e invalida todas as queries relevantes. **Funciona para qualquer motivo de pausa.**
- **`ChatPanel.tsx` (linha 50)** hoje só mostra o botão quando `isTransbordo = motivo IN ('transbordo_boleto', 'transbordo_humano')`. A pausa de 10 min de `intervencao_humana` cai fora — por isso o operador não tem como destravar a IA sem esperar passar.
- Hook `useIaPausa` (linha 76) chama `pausar({ motivo: 'intervencao_humana', minutos: 10 })` automaticamente quando o atendente envia mensagem pelo drawer.

## Mudança

### Única alteração: `src/components/eventos/chat-ia/ChatPanel.tsx`

Trocar a condição de exibição do botão de `isTransbordo` para **"qualquer pausa ativa de IA"** (`iaPausada && !!pausa`), e ajustar o copy para refletir os dois cenários:

```tsx
{iaPausada && pausa && (
  <Button
    size="sm"
    variant="default"
    disabled={concluirTransbordo.isPending}
    onClick={async () => {
      if (!telefone) return;
      try {
        await concluirTransbordo.mutateAsync(telefone);
        toast.success('Atendimento concluído. IA reativada.');
      } catch (e: any) {
        toast.error(e?.message ?? 'Falha ao concluir atendimento');
      }
    }}
  >
    {concluirTransbordo.isPending
      ? <Loader2 className="h-4 w-4 animate-spin" />
      : 'Concluir atendimento'}
  </Button>
)}
```

- Botão fica ao lado do badge âmbar "IA pausada até HH:mm" que já existe.
- Texto único "Concluir atendimento" cobre os dois motivos (intervenção de 10 min e transbordo).
- A flag `isTransbordo` e o cálculo dela podem ser removidos (sem outros usos).
- Toast adaptado para "IA reativada" (mais genérico que "contexto zerado" — o `useConcluirTransbordo` já corta contexto internamente, então o comportamento é o mesmo).

## Comportamento resultante

| Cenário | Antes | Depois |
|---|---|---|
| Atendente respondeu manualmente (`intervencao_humana`, 10 min) | Badge "IA pausada", sem botão. Operador espera 10 min. | Badge + botão "Concluir atendimento". 1 clique reativa. |
| Transbordo (`transbordo_boleto` / `transbordo_humano`) | Badge + botão (funciona hoje) | Igual — sem regressão. |
| IA não pausada | Sem badge, sem botão | Igual. |

## Fora de escopo

- Configurar janela dos 10 min (continua hardcoded em `useIaPausa.ts`).
- Mudar o motivo de pausa registrado (continua `intervencao_humana`; quem concluir vira `encerrado_humano` via `useConcluirTransbordo`).
- Mexer em `EventosChatIA.tsx`, `ContatoDetalheDrawer.tsx`, ou nos edges `processar-fila-ia`/`whatsapp-webhook`.

## Arquivos tocados

- `src/components/eventos/chat-ia/ChatPanel.tsx` (1 condição + 1 string de toast)
