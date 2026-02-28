
# Unificar Tipo de Vistoriador — Alocacao Diaria Rota/Base

## Problema Atual

Hoje existem **duas roles separadas** no sistema:
- `instalador_vistoriador` (campo/rota)
- `vistoriador_base` (base fixa)

Isso e fixo — o profissional e cadastrado como um OU outro. Porem na realidade, o mesmo profissional pode estar na rua num dia e na base no outro. O coordenador precisa poder definir isso diariamente.

## Solucao

Unificar em uma unica role `instalador_vistoriador` e criar uma **tabela de alocacao diaria** que o coordenador preenche, definindo onde cada profissional trabalha naquele dia.

## Alteracoes

### 1. Nova tabela `alocacoes_diarias`

Registra onde cada profissional esta alocado por dia, com historico automatico.

```text
alocacoes_diarias
- id (uuid, PK)
- profissional_id (uuid, FK profiles.id)
- data (date)
- tipo_alocacao ('rota' | 'base')
- definido_por (uuid, FK profiles.id) -- coordenador
- observacoes (text, nullable)
- created_at, updated_at
- UNIQUE(profissional_id, data)
```

RLS: leitura para authenticated, escrita para coordenadores/diretores.

### 2. Migrar role `vistoriador_base` para `instalador_vistoriador`

- Todos os usuarios com role `vistoriador_base` recebem role `instalador_vistoriador` via SQL
- Remover registros antigos de `vistoriador_base` do `user_roles`
- Manter o enum no banco por compatibilidade (nao e possivel remover valores de enum no Postgres facilmente)

### 3. UI do Coordenador — Definir Alocacao do Dia

Na pagina **Monitoramento > Equipe**, adicionar um painel/secao "Escala do Dia" onde o coordenador:
- Ve a lista de profissionais ativos
- Para cada um, seleciona "Rota" ou "Base" (toggle/select)
- Salva as alocacoes de uma vez
- Pode ver historico de alocacoes anteriores

### 4. Atualizar logica de `isVistoriadorBase` para consultar alocacao do dia

Em vez de checar a role, consultar `alocacoes_diarias` para o dia atual:
- Se `tipo_alocacao = 'base'` → comportamento de vistoriador base (sem mapa, sem GPS obrigatorio)
- Se `tipo_alocacao = 'rota'` ou sem registro → comportamento de campo (mapa, GPS, rotas)

**Arquivos afetados:**
- `src/hooks/usePermissions.ts` — `isVistoriadorBase` passa a consultar alocacao
- `src/components/instalador/InstaladorLayout.tsx` — usar alocacao ao inves de role
- `src/components/instalador/InstaladorGuard.tsx` — aceitar apenas `instalador_vistoriador`
- `src/pages/instalador/InstaladorHome.tsx` — usar alocacao
- `src/hooks/useRouteGuard.ts` — ajustar bloqueio de mapa

### 5. Criar hook `useAlocacaoDiaria`

Novo hook que:
- Consulta `alocacoes_diarias` para o profissional logado no dia atual
- Retorna `tipoAlocacao: 'rota' | 'base' | null`
- Usado pelo InstaladorLayout, InstaladorHome e usePermissions

### 6. Atualizar jornada de trabalho

No `useJornadaTrabalho.ts` e `useIniciarServico.ts`:
- Se alocacao do dia = 'base': nao exigir GPS para iniciar turno
- Se alocacao do dia = 'rota': manter exigencia de GPS

### 7. Remover referencia a `vistoriador_base` nos formularios

- `ProfissionalModal.tsx` — remover campo `tipoVistoriador` (todos sao `instalador_vistoriador`)
- `UsuarioForm.tsx` — manter role `vistoriador_base` apenas para compatibilidade visual, mas direcionar para `instalador_vistoriador`
- `NovoFuncionarioModal.tsx` — remover opcao separada
- `ImportarUsuariosDialog.tsx` — remover opcao VB separada

### 8. Atualizar atribuicao de tarefas

- `AtribuirVistoriadorModal.tsx` — buscar apenas `instalador_vistoriador`, filtrar por alocacao do dia se relevante
- `useEquipe.ts` — buscar apenas `instalador_vistoriador`

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| Nova migration SQL | Criar `alocacoes_diarias` + migrar roles |
| `src/hooks/useAlocacaoDiaria.ts` | **NOVO** — hook de alocacao do dia |
| `src/pages/monitoramento/Equipe.tsx` | Adicionar secao "Escala do Dia" |
| `src/components/equipe/EscalaDiaPanel.tsx` | **NOVO** — painel de definicao de escala |
| `src/hooks/usePermissions.ts` | `isVistoriadorBase` usa alocacao |
| `src/components/instalador/InstaladorLayout.tsx` | Usar alocacao |
| `src/components/instalador/InstaladorGuard.tsx` | Aceitar apenas `instalador_vistoriador` |
| `src/pages/instalador/InstaladorHome.tsx` | Usar alocacao |
| `src/hooks/useRouteGuard.ts` | Ajustar bloqueio mapa |
| `src/hooks/useIniciarServico.ts` | GPS condicional por alocacao |
| `src/components/monitoramento/ProfissionalModal.tsx` | Remover tipoVistoriador |
| `src/hooks/useEquipe.ts` | Buscar apenas `instalador_vistoriador` |
| `src/components/monitoramento/AtribuirVistoriadorModal.tsx` | Ajustar query de roles |

## Fluxo Resultante

```text
Coordenador abre Monitoramento > Equipe
  |
  v
Secao "Escala do Dia" mostra lista de profissionais
  |
  v
Para cada um, define: [Rota] ou [Base]
  |
  v
Salva → grava em alocacoes_diarias (profissional_id, data, tipo)
  |
  v
Profissional abre App:
  - tipo = 'rota' → ve mapa, GPS obrigatorio, recebe rotas
  - tipo = 'base' → sem mapa, sem GPS, recebe tarefas de base
  |
  v
Historico fica salvo por data (auditoria)
```
