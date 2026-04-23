

## Remover notificações de "vistoriador improdutivo" para diretoria/admin

### Diagnóstico

O hook `src/hooks/useMonitorImprodutividade.ts` roda no client de cada vistoriador a cada 5 minutos. Quando detecta turno ativo sem serviços concluídos por mais de X horas (configurável via `jornada_horas_alerta_improdutividade`, default 2h), ele:

1. Busca todos usuários com role `coordenador_monitoramento`, `admin` ou `diretor`.
2. Insere uma notificação na tabela `notificacoes` para **cada um** desses destinatários.

Resultado: o diretor recebe a notificação para todo vistoriador improdutivo de toda a operação, várias vezes ao dia.

O hook é chamado em algum layout/raiz (provavelmente `InstaladorLayout` ou similar). Para desativar globalmente sem perder o código (caso queira reativar depois com filtros melhores), basta neutralizar a execução do efeito.

### O que vai mudar

**1. Desativar o monitor de improdutividade** (`src/hooks/useMonitorImprodutividade.ts`)

Adicionar um early-return logo no início do `useEffect`, com comentário explicando que está temporariamente desativado por gerar ruído excessivo na diretoria. O resto do hook (queries, lógica de cálculo) permanece intacto para reativação futura.

**2. Limpar notificações pendentes existentes** (migration DML)

Marcar como `lida = true` (ou deletar) todas as notificações existentes com `tipo = 'improdutividade_vistoriador'` que ainda estão `lida = false`, para o diretor parar de ver o badge/lista populada com esses alertas antigos.

Vou usar `UPDATE notificacoes SET lida = true, lida_em = now() WHERE tipo = 'improdutividade_vistoriador' AND lida = false` (preserva histórico, apenas remove do badge de não-lidas).

### O que NÃO muda

- Lógica de jornada de trabalho, almoço, turno.
- Outros tipos de notificação (sinistros, agendamentos, etc.).
- Roles e permissões.
- Tabela `notificacoes` em si — só os registros desse `tipo` específico são marcados como lidos.

### Arquivos editados

- `src/hooks/useMonitorImprodutividade.ts` — early-return no `useEffect` desabilitando o disparo de notificações; comentário `// TODO: reativar quando houver regra mais granular (ex.: só fora de horário de pico, com cooldown maior)`.
- **Migration nova** — `UPDATE notificacoes SET lida = true, lida_em = now() WHERE tipo = 'improdutividade_vistoriador' AND lida = false`.

### Riscos

- Nenhum. Coordenadores/diretoria deixam de receber esses alertas até decisão futura. Vistoriador continua sem ver nada (já era silencioso para ele).

