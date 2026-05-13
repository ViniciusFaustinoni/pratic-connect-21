## Contexto

Hoje os limites que decidem se um veículo dispensa rastreador estão na tabela `configuracoes`, nas chaves:

- `operacional_fipe_minimo_rastreador` — limite para **carros** (default R$ 30.000)
- `operacional_fipe_minimo_rastreador_moto` — limite para **motos** (default R$ 9.000)

Eles são lidos por `useConfigFipeRastreador`, `useConfigFipeRastreadorMoto` e `useAvaliarAditivos`. **Não existe UI** para editar; só dá pra mudar via SQL. A página `/configuracoes/sistema` (`src/pages/configuracoes/Sistema.tsx`) hoje é mock estático (não persiste nada).

## O que será feito

Adicionar um novo card **"Rastreador — FIPE mínima para dispensa"** dentro de `src/pages/configuracoes/Sistema.tsx`, com dois campos numéricos (R$):

- **Carros** — atualiza `operacional_fipe_minimo_rastreador`
- **Motos** — atualiza `operacional_fipe_minimo_rastreador_moto`

Comportamento:
- Carrega valores atuais via `useConfiguracoesAll` (cache global já existente).
- Botão **Salvar** independente do card mock superior, usando `useAtualizarConfiguracao` (hook genérico já existente em `src/hooks/useDistribuicao.ts`) para `upsert` na tabela `configuracoes`.
- Toast de sucesso/erro e invalidação do cache de configurações para refletir imediatamente nos fluxos (cotação pública, monitoramento, etc).
- Visível apenas para perfis com permissão de configurações (já restringido pelo `ConfiguracoesLayout`).
- Texto explicativo curto: "Veículos com FIPE abaixo destes valores dispensam a instalação do rastreador (Diesel sempre exige)."

## Onde encontrar depois de pronto

**Configurações › Sistema** → card "Rastreador — FIPE mínima para dispensa".

## Detalhes técnicos

- Arquivo único alterado: `src/pages/configuracoes/Sistema.tsx`.
- Hooks reutilizados: `useConfiguracoesAll`, `useAtualizarConfiguracao`.
- Sem migração de banco (chaves já existem na tabela `configuracoes`).
- Sem mudanças em edge functions ou em qualquer lógica de negócio — só superfície de edição.

## Fora de escopo

- Não mexer no card "Preferências" mock (itens por página, formato data, etc).
- Não tocar nas regras de negócio que consomem esses valores.
