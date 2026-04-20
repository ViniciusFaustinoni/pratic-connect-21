

## Diferenciar fluxo de almoço para técnicos Base vs Rota

### Comportamento atual
- Almoço inicia **automaticamente** após 4h trabalhadas (`useJornadaTrabalho` linha 398-411).
- Almoço finaliza **automaticamente** após 60min (linha 440-449).
- `AlmocoBloqueioOverlay` cobre a tela inteira durante o almoço.
- Não há diferenciação entre técnico Rota e técnico Base.

### Comportamento desejado
| Tipo | Início do almoço | Fim do almoço | Overlay de bloqueio |
|------|------------------|----------------|---------------------|
| **Rota** (atual) | Automático após 4h | Automático após 60min (ou manual) | Sim, cobre a tela |
| **Base** (novo) | **Manual** via botão "Iniciar almoço" (visível na janela de almoço) | **Manual** via botão "Finalizar almoço" | **Não** — apenas botões na barra de jornada |

Para o técnico Base, o tempo de trabalho e de almoço continua sendo medido e gravado em `turnos_profissionais` igual ao Rota — a única diferença é que ele decide quando pausa.

### Definição de "janela de almoço" para o Base
O botão "Iniciar almoço" só aparece quando:
- `status === 'ativo'` (turno em andamento, não em almoço, não encerrado)
- `tempoReal.minutosTrabalhados >= TEMPO_ATE_ALMOCO_MINUTOS` (ou seja, já passou das 4h trabalhadas configuradas)

Sem janela rígida de fim — ele pode iniciar o almoço a qualquer momento depois das 4h. Antes das 4h, o botão fica oculto (consistente com a regra de jornada).

### Implementação técnica

**Arquivo 1: `src/hooks/useJornadaTrabalho.ts`**
- Importar `useAlocacaoDiaria` e capturar `isBase`.
- Adicionar `isBase` ao retorno do hook (para a UI saber).
- **Bloquear auto-início do almoço quando `isBase === true`** (linha 398-411): adicionar `&& !isBase` na condição.
- **Bloquear auto-finalização do almoço quando `isBase === true`** (linha 440-449): adicionar `&& !isBase` na condição. Base finaliza manualmente.
- Manter o cálculo de atraso de almoço para Base também — se ele extrapolar 60min de pausa, o acréscimo continua sendo aplicado à jornada (mantém justiça no banco de horas).
- Manter `almocoAdiado` apenas para Rota (já é por construção, pois Base nunca entra no auto).

**Arquivo 2: `src/components/vistoriador/AlmocoBloqueioOverlay.tsx`**
- Importar `useAlocacaoDiaria`.
- No early-return: se `isBase === true`, **nunca renderizar o overlay** (mesmo em almoço). Base não tem tela de bloqueio.

**Arquivo 3: `src/components/vistoriador/JornadaStatusBar.tsx`**
- Receber `isBase` do hook.
- **Para Base com `status === 'ativo'` e `minutosTrabalhados >= TEMPO_ATE_ALMOCO_MINUTOS` e sem `inicio_almoco`**: renderizar botão verde **"Iniciar almoço"** (chama `iniciarAlmoco()`).
- **Para Base com `emAlmoco === true`**: trocar o card amarelo de "Horário de Almoço" para uma versão que mostra:
  - Tempo decorrido de almoço (contador crescente)
  - Aviso visual quando passa de 60min ("⚠️ +Xmin de acréscimo na jornada")
  - Botão **"Finalizar almoço"** (chama `finalizarAlmoco()`)
- Para Rota o comportamento permanece idêntico (overlay + auto-finalização).

### Validação pós-deploy
1. **Técnico Rota** com 4h trabalhadas e sem tarefa → overlay de almoço aparece automaticamente; finaliza sozinho aos 60min. (comportamento atual preservado)
2. **Técnico Base** trabalhando: ao cruzar 4h, **não** aparece overlay; aparece botão "Iniciar almoço" na barra de jornada.
3. **Técnico Base** clica em "Iniciar almoço" → status muda para `em_almoco`, tempo de almoço começa a contar, **sem overlay bloqueando**.
4. **Técnico Base** em almoço passa de 60min → barra mostra contador crescente + aviso de acréscimo; botão "Finalizar almoço" continua visível.
5. **Técnico Base** clica em "Finalizar almoço" → volta para `ativo`, atraso registrado em `minutos_atraso_almoco`, jornada ajustada.
6. Conferir no banco que `inicio_almoco`, `fim_almoco` e `minutos_atraso_almoco` são gravados corretamente para o técnico Base.
7. Em dia útil (segunda a sexta) onde `useAlocacaoDiaria` retorna `isBase=false` por padrão → técnico cai no fluxo Rota normalmente.

### Arquivos tocados
- `src/hooks/useJornadaTrabalho.ts` — bypass de auto-almoço para Base + expor `isBase`.
- `src/components/vistoriador/AlmocoBloqueioOverlay.tsx` — não renderizar para Base.
- `src/components/vistoriador/JornadaStatusBar.tsx` — botões manuais "Iniciar/Finalizar almoço" para Base.

Sem migração, sem novo hook, sem alteração de schema/RLS.

