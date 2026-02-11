
# Turno Automatico ao Ativar Localizacao

## Problema

Atualmente, o registro de turno (`turnos_profissionais`) depende de uma chamada separada a `iniciarTurno`. Quando o vistoriador clica em **"Iniciar Servico"** (que ativa a localizacao e marca `em_servico = true`), o turno NAO e criado automaticamente. Isso faz com que a pagina de Jornadas do RH fique vazia.

## Solucao

Criar automaticamente o registro de turno na tabela `turnos_profissionais` no momento em que o profissional clica em "Iniciar Servico" (dentro do hook `useIniciarServico`). Assim, a metrificacao comeca imediatamente ao ativar a localizacao, sem depender de nenhum botao adicional.

## Alteracao

### `src/hooks/useIniciarServico.ts`

Apos o sucesso da mutation `atribuirTarefaMutation` (que marca o profissional como em servico e envia a localizacao), inserir automaticamente um registro na tabela `turnos_profissionais` com:

```text
profissional_id: profile.id
data: hoje (formato YYYY-MM-DD)
inicio_turno: now()
status: 'ativo'
saldo_anterior_minutos: (buscar do dia anterior)
```

Usar `upsert` com `onConflict: 'profissional_id,data'` para evitar duplicatas caso o profissional ja tenha um turno no dia.

Isso sera feito importando a logica de criacao de turno diretamente (query ao banco), sem depender do hook `useJornadaTrabalho` (que e usado no contexto do profissional para controle visual).

### `src/hooks/useIniciarServico.ts` (encerrarServico)

Na funcao `encerrarServico`, alem de marcar `em_servico = false`, tambem encerrar o turno ativo do dia (se houver):

```text
UPDATE turnos_profissionais
SET status = 'encerrado', fim_turno = now()
WHERE profissional_id = X AND data = hoje AND status != 'encerrado'
```

## Arquivos a alterar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useIniciarServico.ts` | Criar turno automaticamente ao iniciar servico; encerrar turno ao encerrar servico |

## O que NAO muda

- Hook `useJornadaTrabalho` continua funcionando normalmente (ele le o turno que ja foi criado)
- Componente `JornadaStatusBar` continua exibindo o progresso
- Pagina de Jornadas do RH (`JornadasProfissionais`) passa a ter dados automaticamente
- Nenhuma migration necessaria (as colunas ja existem)
