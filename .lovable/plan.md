## Causa raiz

`src/components/cotacao-publica/AgendamentoVistoria.tsx` (linhas 96-122) gera a lista de datas com regra **hard-coded**: "hoje (se ainda houver período) + próximos dias úteis até completar **3 datas fixas**, pulando domingos e datas bloqueadas". Não há **nenhuma** consulta ao SLA por UF.

O prazo real está em `configuracoes`:
- `prazo_instalacao_horas_rj` = **48**
- `prazo_instalacao_horas_sp` = **72**
- `prazo_instalacao_autovistoria_horas` = **72** (default/fallback)

Esses valores hoje são lidos **apenas** pelo `supabase/functions/cron-suspender-cobertura-inativacao/index.ts` (linhas 25-32) para suspender cobertura. O agendador público nunca os consulta — por isso aparecem datas além da janela permitida.

Consequência prática para o RJ: o link oferece hoje + 2 dias úteis (até ~3 dias corridos), quando o SLA permite apenas as datas que caem dentro de 48h a partir de "agora".

## Correção proposta (apenas frontend público, sem mexer na regra de suspensão)

### 1. `src/hooks/useConteudosSistema.ts` (ou hook análogo já consumindo `useConfiguracoesAll`)
Adicionar 3 seletores tipados sobre o cache global existente:
- `usePrazoInstalacaoHorasRJ()` → default 48
- `usePrazoInstalacaoHorasSP()` → default 72
- `usePrazoInstalacaoHorasDefault()` → default 72

Sem nova rede — apenas leitura do cache `configuracoes/all`.

### 2. `src/lib/agendamento/janelaInstalacao.ts` (novo helper puro)
Função `gerarDatasDentroDoPrazo({ agora, prazoHoras, datasBloqueadas, pularDomingo, periodosPorHora })`:
- Calcula `deadline = agora + prazoHoras`.
- Itera dia a dia a partir de hoje até `deadline` (inclusive o dia em que `deadline` cai, mesmo que a hora exata extrapole — usuário escolhe período, não hora).
- Filtra: domingo, datas bloqueadas, dias sem nenhum período disponível (regra atual de `getPeriodosDisponivelsPorHora`).
- Remove o teto fixo de 3 datas — agora o teto é o **prazo**.
- Mantém regra "após 16h, D+1 é ocultado" só quando ainda sobra outra data válida dentro do prazo; senão mantém para não esvaziar o calendário.

### 3. `src/components/cotacao-publica/AgendamentoVistoria.tsx`
- Resolver UF: usar `endereco.estado` (já capturado por ViaCEP); fallback para UF do contrato/cotação se disponível; senão `default` (72h).
- Mapear UF → prazo: `RJ → prazoRJ`, `SP → prazoSP`, demais → `prazoDefault`.
- Substituir o bloco das linhas 96-122 pela chamada ao novo helper.
- Quando o usuário ainda não escolheu o CEP/estado, exibir aviso curto ("Preencha o endereço para liberar as datas disponíveis") e suprimir o seletor de data até `endereco.estado` existir — evita oferecer datas que depois somem.
- Quando o cálculo retornar zero datas (caso extremo: hoje pós-16h, amanhã bloqueado, prazo 48h estourado), mostrar mensagem "Sem agenda disponível dentro do prazo — entre em contato" em vez de calendário vazio.

### 4. Espelhar no fluxo equivalente
Aplicar o mesmo helper em `src/components/cotacao-publica/AgendamentoVistoriaCompleta.tsx` se ele também gerar lista própria (verificar antes de editar; reutilizar via prop).

### 5. Memory
Atualizar `mem://logic/operations/suspensao-cobertura-48h` (ou criar leaf `mem://logic/operations/janela-agendamento-publico-por-uf`) registrando que o agendamento público lê `prazo_instalacao_horas_{uf}` da mesma fonte do cron de suspensão — qualquer mudança da regra de 48h/72h deve continuar valendo nos dois lados.

## Fora de escopo

- Não mexer no `cron-suspender-cobertura-inativacao` nem na regra de suspensão pós-aprovação.
- Não mexer em agendamentos internos (Monitoramento/Coordenação) — só no link público.
- Não tocar em vagas por período (`useVagasPeriodo`), apenas no gerador de datas.

## Validação

1. Subir; abrir link público de cotação com endereço RJ → calendário deve mostrar **só** datas dentro de 48h a partir de agora (geralmente hoje + amanhã, ou só amanhã se passou das 16h).
2. Trocar endereço para SP → reaparecem até 72h de janela.
3. UF não mapeado (ex.: MG) → 72h (default).
4. Bloquear data de amanhã em `datas_bloqueadas` no RJ pós-16h → mensagem "sem agenda disponível".
