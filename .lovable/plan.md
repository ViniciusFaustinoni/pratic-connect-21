

## Bug

Quando técnico de **base** recebe vistoria atribuída (veículo já está fisicamente na oficina), o card "Tarefa Atual" exige contato prévio com o associado para liberar o botão **Iniciar Tarefa**. Isso não faz sentido — o cliente já entregou o veículo.

A regra de "ligar antes de iniciar percurso" só serve para serviços **externos** (técnico vai até o endereço do cliente).

## Causa

`src/components/vistoriador/TarefaAtualCard.tsx` (linhas 503–533) bloqueia incondicionalmente:

```tsx
{isAgendada ? (
  <>
    {!contatoRealizado && <aviso amarelo />}
    <Button disabled={... || !contatoRealizado}>Iniciar Tarefa</Button>
  </>
)
```

O campo `tarefa.local_vistoria` já indica o local (`'base'` ou `'cliente'`), mas não é consultado aqui.

## Correção

### 1) `src/components/vistoriador/TarefaAtualCard.tsx`
- Derivar `isNaBase = tarefa.local_vistoria === 'base'`.
- Quando `isNaBase` for true:
  - **Ocultar** o aviso amarelo "Entre em contato com o associado antes de iniciar o percurso".
  - **Remover** `!contatoRealizado` da condição `disabled` do botão Iniciar Tarefa.
  - Trocar o texto do botão (opcional) ou manter "Iniciar Tarefa" — o usuário não pediu, mantenho igual.
- Não mexer em nada quando `local_vistoria === 'cliente'` (fluxo externo permanece exigindo contato).

### 2) Não mexer
- `useRegistrarContato`, banco, RPCs: continuam iguais. O técnico ainda pode registrar contato manualmente se quiser (botões WhatsApp/Ligação seguem funcionando).
- Não toco no fluxo de "Em Rota" / "Em Andamento".

## Validação

1. Logar como técnico de base com vistoria atribuída onde `local_vistoria='base'` → botão **Iniciar Tarefa** habilitado direto, sem aviso amarelo.
2. Logar como técnico volante com `local_vistoria='cliente'` → comportamento atual preservado (exige contato).

## Resultado esperado

Vistorias na base fluem sem fricção; vistorias externas continuam protegidas pelo gate de contato prévio.

