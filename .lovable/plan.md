# Bloquear "Iniciar almoço" enquanto técnico tem serviço em andamento

## Problema

O técnico Kleyton iniciou o almoço enquanto executava um atendimento. O hook `useTemTarefaEmExecucao` já existe e detecta corretamente serviços em `em_rota` ou `em_andamento`, mas o flag `podeIniciarAlmoco` em `useJornadaTrabalho.ts` **não consulta esse hook**:

```ts
// src/hooks/useJornadaTrabalho.ts:429
const podeIniciarAlmoco = turno?.status === 'ativo' && !turno?.inicio_almoco;
```

Resultado: o botão "Iniciar almoço" fica habilitado mesmo durante a execução de um serviço.

## Correção

### `src/hooks/useJornadaTrabalho.ts`
- Incluir `temTarefaEmExecucao` no cálculo:
  ```ts
  const podeIniciarAlmoco =
    turno?.status === 'ativo' &&
    !turno?.inicio_almoco &&
    !temTarefaEmExecucao;
  ```
- Defesa em profundidade no `iniciarAlmocoMutation`: se `temTarefaEmExecucao` for `true` no momento do clique, abortar com `toast.error("Finalize ou pause o serviço atual antes de iniciar o almoço.")`.

### `src/components/vistoriador/JornadaStatusBar.tsx`
- Quando `podeIniciarAlmoco === false` apenas por causa de tarefa em execução, exibir o botão **desabilitado** com tooltip/legenda explicativa: *"Conclua o serviço atual antes de iniciar o almoço"*. Isso é mais didático do que sumir o botão silenciosamente.
- Para isso, expor um novo flag `bloqueadoPorTarefa` do hook (`turno ativo + sem almoço iniciado + tem tarefa em execução`).

## Compatibilidade com a regra existente

A memória *technician-lunch-cycle-automation* diz que almoço é **100% manual** e que motores de atribuição **não consultam** o status `em_almoco`. Esta correção não viola nada:
- Continua sendo manual (técnico clica para iniciar/finalizar).
- Edge functions de atribuição permanecem inalteradas.
- A regra adicionada é apenas uma trava de UI/cliente para evitar registro inconsistente quando há serviço em curso.

## Arquivos afetados

- `src/hooks/useJornadaTrabalho.ts`
- `src/components/vistoriador/JornadaStatusBar.tsx`
