

# Plano: Aba "Prestadores Parceiros" no Monitoramento

## Resumo

Criar pagina "Prestadores Parceiros" no modulo de Monitoramento (nao na Diretoria), acessivel apenas a Diretor, Admin Master e Coordenador de Monitoramento. Inclui lista com metricas, historico, e card resumo no dashboard do coordenador.

---

## PARTE 1 — Nova pagina `src/pages/monitoramento/PrestadoresParceiros.tsx`

Pagina completa com:

- **Lista de prestadores** da `prestadores_assistencia`:
  - Nome, WhatsApp, status (toggle inline)
  - Municipios de atuacao (badges dos municipios tipo `prestador` da `municipios_atendimento`)
  - Metricas agregadas da `instalacao_prestador_links`: total recebidas, concluidas, taxa de conclusao (%)
  - Botao "Editar" → abre `NovoPrestadorModal` existente
  - Botao "Ver historico" → expande inline ultimos 10 registros de `instalacao_prestador_links`
- **Botao "+ Novo Prestador"** → abre `NovoPrestadorModal` em modo criacao
- **Busca** por nome e **filtro** por status

Protecao de acesso via `PermissionGate` ou check no hook: apenas perfis `diretor`, `admin_master`, `coordenador_monitoramento`.

## PARTE 2 — Rota no App.tsx

Adicionar rota `/monitoramento/prestadores-parceiros` apontando para `PrestadoresParceiros`.

## PARTE 3 — Link de acesso

Adicionar link na sidebar/navegacao do modulo de Monitoramento (ou nos `acoesRapidas` do `DashboardCoordenador`). Visivel apenas para os 3 perfis permitidos.

## PARTE 4 — Card "Prestadores Ativos" no DashboardCoordenador

**Novo componente**: `src/components/monitoramento/PrestadoresAtivos.tsx`

Card com:
- Prestadores com link ativo (status `aguardando` ou `em_execucao`, nao expirado)
- Quantidade de instalacoes aguardando vs em execucao
- Lista resumida: nome, municipio, status badge, tempo desde envio

Renderizar no `DashboardCoordenador.tsx` apos `VistoriadoresEmAlerta`.

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/PrestadoresParceiros.tsx` | **Novo** — lista + metricas + historico |
| `src/components/monitoramento/PrestadoresAtivos.tsx` | **Novo** — card dashboard |
| `src/pages/monitoramento/DashboardCoordenador.tsx` | Renderizar PrestadoresAtivos + acao rapida |
| `src/App.tsx` | Rota `/monitoramento/prestadores-parceiros` |

Nenhuma migration necessaria — usa tabelas existentes.

