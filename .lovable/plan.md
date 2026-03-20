
Objetivo: tornar a jornada totalmente funcional no app do instalador/vistoriador, cobrindo os 3 sintomas que você relatou: não cria turno, não mostra barra e não atualiza horas.

Diagnóstico encontrado
- O código da jornada existe e a tabela `turnos_profissionais` também.
- Hoje há profissionais com `em_servico = true` em `vistoriadores_localizacao`, mas não há turnos de hoje em `turnos_profissionais`.
- Isso cria um estado quebrado: o app entende que o profissional está ativo, mas a jornada do dia não existe. Nesse caso:
  - `JornadaStatusBar` não aparece, porque `useJornadaTrabalho` retorna status `inativo`
  - as horas não avançam, porque não existe registro do turno do dia
- A causa mais provável é um descompasso entre as duas fontes de estado:
  - `useIniciarServico` usa `vistoriadores_localizacao.em_servico`
  - `useJornadaTrabalho` usa `turnos_profissionais`
- Hoje o app cria o turno ao clicar em “Iniciar Serviço”, mas não garante a criação do turno quando o usuário já volta para o app marcado como `em_servico`.
- Também falta um mecanismo robusto de sincronização/recuperação no frontend para garantir que a jornada reflita mudanças do banco sem depender só do fluxo ideal.

Plano de correção

1. Unificar a regra de entrada da jornada
- Ajustar `useIniciarServico` para, sempre que detectar `emServico = true`, garantir a existência do turno de hoje.
- Criar uma rotina idempotente “garantir turno de hoje”:
  - se já existe, reutiliza
  - se não existe, cria
  - se existe encerrado indevidamente mas o profissional está em serviço, reativa conforme a regra definida
- Essa rotina deve rodar:
  - ao clicar em “Iniciar Serviço”
  - ao abrir/reabrir o app com `emServico = true`
  - ao voltar do background
  - opcionalmente no polling de segurança

2. Tornar `turnos_profissionais` a fonte real da jornada no app
- Revisar o acoplamento entre `em_servico` e jornada:
  - `em_servico` continua controlando disponibilidade operacional
  - `turnos_profissionais` passa a ser sempre garantido quando houver disponibilidade ativa
- Evitar o estado inválido “em serviço sem turno”.

3. Corrigir a exibição da barra no app
- Ajustar a home do instalador/vistoriador para tratar 3 estados corretamente:
  - não ativo: mostra “Iniciar Serviço”
  - ativo + turno encontrado: mostra `JornadaStatusBar`
  - ativo + turno ausente: mostra estado de recuperação/carregamento e dispara autocorreção, em vez de simplesmente sumir
- Isso elimina a sensação de que a funcionalidade “sumiu”.

4. Melhorar atualização das horas
- Em `useJornadaTrabalho`, adicionar sincronização mais robusta:
  - manter cálculo local por minuto
  - adicionar subscription realtime para `turnos_profissionais`
  - manter polling fallback para não depender só de realtime
- Assim o app continua refletindo:
  - início do turno
  - almoço automático/manual
  - volta do almoço
  - encerramento automático/manual

5. Revisar almoço e encerramento automático
- Validar se a automação de almoço/encerramento está acontecendo mesmo quando o usuário deixa o app aberto por muito tempo ou volta depois.
- Padronizar a recuperação de estado ao reabrir o app:
  - se já passou de 4h, refletir almoço corretamente
  - se almoço passou de 60 min, refletir retorno/atraso corretamente
  - se a jornada já terminou, refletir encerramento corretamente

6. Fortalecer o backend/consistência de dados
- Revisar se existe necessidade de uma função SQL ou edge flow simples para “garantir turno de hoje” de forma centralizada.
- Benefício: evita duplicar regra em vários componentes/hooks.
- Também revisar timezone da jornada para garantir consistência entre:
  - `getHojeBrasilia()`
  - `CURRENT_DATE`
  - timestamps gravados no banco

7. Melhorias no painel gerencial
Já existe base pronta em `/rh/jornadas`, então eu incluiria melhorias de alto impacto:
- card/alerta de inconsistência: “profissional em serviço sem turno de hoje”
- ação manual de correção/reativação
- status em tempo real mais confiável
- filtro por função: instalador x vistoriador
- visão de inconsistências operacionais do dia
- histórico semanal/mensal e total de banco de horas
- indicador de quem está sem almoço obrigatório após 4h

8. Validação após implementação
- Testar fluxo completo no app do profissional:
  - iniciar serviço
  - verificar criação do turno
  - ver barra aparecer imediatamente
  - confirmar horas avançando
  - atingir almoço
  - retornar do almoço
  - encerrar turno
- Testar reentrada:
  - fechar app e abrir de novo com `em_servico = true`
  - confirmar que o turno do dia é recuperado/criado automaticamente
- Testar painel `/rh/jornadas` com dados do mesmo dia

Arquivos mais prováveis de ajuste
- `src/hooks/useIniciarServico.ts`
- `src/hooks/useJornadaTrabalho.ts`
- `src/pages/instalador/InstaladorHome.tsx`
- possivelmente `src/components/vistoriador/JornadaStatusBar.tsx`
- possivelmente lógica SQL/migração complementar para consistência da jornada

Melhorias recomendadas além da correção
- autocorreção de inconsistência “em_servico sem turno”
- realtime + polling fallback
- estado visual de recuperação quando a barra ainda não carregou
- alertas gerenciais de jornada inconsistente
- relatório consolidado de banco de horas por profissional

Resultado esperado
- O turno passa a ser criado de forma confiável
- A barra deixa de desaparecer indevidamente
- As horas voltam a marcar no app mesmo após reabrir/retomar sessão
- RH/operação ganha visibilidade clara de inconsistências e jornada em tempo real
