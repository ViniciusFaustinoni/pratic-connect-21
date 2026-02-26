

# Fix: Auto-finalizar almoco quando tempo expirar

## Problema
Quando o contador de almoco chega a zero, o profissional fica travado na tela de almoco (overlay bloqueante) sem poder receber tarefas. O codigo atual tem um comentario explicito dizendo "NAO finalizar almoco automaticamente", mas nao oferece nenhuma alternativa para o profissional sair desse estado.

## Causa Raiz
No `useJornadaTrabalho.ts` (linha 314), o almoco nunca e finalizado automaticamente. O overlay `AlmocoBloqueioOverlay.tsx` bloqueia toda a interface, entao o profissional nao consegue interagir com nada para voltar.

## Solucao

### Arquivo: `src/hooks/useJornadaTrabalho.ts`

Adicionar um `useEffect` que chama `finalizarAlmocoMutation.mutate()` automaticamente quando os 60 minutos de almoco se completam:

```text
useEffect:
  Condicao: turno.status === 'em_almoco' && tempoReal.minutosAlmoco >= 60
  Acao: chamar finalizarAlmocoMutation.mutate()
```

Isso vai:
1. Mudar o status do turno de `em_almoco` para `ativo`
2. Registrar `fim_almoco` e `minutos_atraso_almoco` (se houver)
3. O overlay some automaticamente (ja verifica `emAlmoco`)
4. O profissional volta a receber tarefas pela Edge Function de atribuicao

Remover o comentario antigo que dizia para nao finalizar automaticamente.

### Arquivo: `src/components/vistoriador/AlmocoBloqueioOverlay.tsx`

Adicionar um botao "Retornar ao trabalho" visivel quando o tempo acabar (emAtraso = true), como alternativa de seguranca caso o auto-finalize demore pelo intervalo de 1 minuto do calculo de tempo real.

O botao chamara `finalizarAlmoco()` diretamente.

## Resultado esperado
- Ao completar 60 minutos de almoco, o sistema automaticamente volta o profissional para status ativo
- O overlay desaparece e ele volta a receber tarefas
- Se houver atraso, o tempo extra e registrado como acrescimo na jornada (logica ja existente)
- Botao manual de retorno visivel como fallback

