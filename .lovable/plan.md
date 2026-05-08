## Objetivo

Replicar a experiência da página **Cadastro › Fila SGA** (`/configuracoes/integracoes/sga-hinova`), mas voltada para **vínculos de rastreadores nas plataformas Softruck e Rede Veículos**, dentro de **Monitoramento › Rastreadores**.

A nova área terá os mesmos blocos: status de conexão, fila com retry, logs, pendentes (rastreadores que deveriam estar vinculados mas não estão), e health check — só que olhando o ecossistema Softruck + Rede, não a Hinova.

## Escopo da UI

Criar nova aba **"Plataformas"** (ou **"Fila Plataformas"**) na página `src/pages/monitoramento/Rastreadores.tsx`, ao lado de Visão Geral / Estoque / Histórico.

A aba terá sub-tabs internos por plataforma (`Softruck` | `Rede Veículos`), cada um com a estrutura:

```text
[ Conexão API ] [ Fila Pendente ] [ Falhas na Fila ] [ Rastreadores Pendentes ]

Tabs internas:
  - Fila            (itens com retry — pendente / falha / falha_permanente)
  - Logs            (rastreadores_api_logs filtrado por plataforma)
  - Pendentes       (rastreadores instalado sem plataforma_veiculo_id, ou sem user vinculado)
  - Health Check    (conexão + tempo de resposta)
```

Ações por linha (igual à Fila SGA): **Reprocessar** e **Descartar (falha permanente)**. Modal de detalhe ao clicar na linha mostrando request/response do último envio.

## Backend / dados

Hoje só temos `rastreadores_api_logs` (logs históricos), sem fila persistente com retry. Para ter paridade com Fila SGA, criar:

1. **Tabela `rastreadores_sync_queue`** (espelha `sga_sync_queue`):
   - `id, rastreador_id, veiculo_id, associado_id, plataforma ('softruck'|'rede'), operacao ('ativar_dispositivo'|'criar_usuario'|'vincular_user_veiculo'|...)`
   - `status ('pendente'|'processando'|'falha'|'falha_permanente'|'concluido')`
   - `tentativas, max_tentativas (default 5), etapa_parou, erro_ultimo, payload jsonb, response_ultimo jsonb`
   - `created_at, ultima_tentativa_em, proximo_reenvio_em, concluido_em`
   - RLS: leitura/escrita só para roles internas (Diretor, Coordenador Monitoramento, T.I.).
   - Índices em `(plataforma, status, proximo_reenvio_em)`.

2. **Tabela `rastreadores_sync_health_checks`** (espelha `sga_health_checks`):
   - `id, plataforma, conexao_ok, tempo_resposta_ms, fila_pendentes, fila_falhas, rastreadores_nao_vinculados, erro_mensagem, created_at`.

3. **Trigger / hooks de enfileiramento**: quando `useUpdateRastreadorStatus` cair em `instalado` para Softruck/Rede e a chamada direta à edge falhar, criar item em `rastreadores_sync_queue` em vez de só logar warn. Edge `softruck-ativar-dispositivo` / `rede-veiculos-ativar-cliente-completo` passam a sempre registrar resultado (sucesso → `concluido`, falha → `pendente` com `proximo_reenvio_em = now()+backoff`).

4. **Edge function nova `rastreadores-sync-worker`**:
   - `action: 'reprocess'` (id) → reexecuta o item da fila via edge da plataforma correta.
   - `action: 'enqueue'` (rastreador_id) → cria item idempotente.
   - `action: 'health_check'` (plataforma) → ping na API, grava em `rastreadores_sync_health_checks`.
   - Cron opcional (não habilitar agora, fora do escopo) para drenar `pendente`/`falha` com backoff.

5. **View `rastreadores_pendentes_vinculo`** para a aba Pendentes:
   - `rastreadores` com `status='instalado'`, `plataforma in ('softruck','rede')`, e (`plataforma_veiculo_id is null` OU `plataforma_user_id is null`).

## Frontend

- Novo hook `src/hooks/useRastreadoresSyncQueue.ts` espelhando `useSGAHealthCheck` (uma instância por plataforma via parâmetro).
- Novo componente `src/components/rastreadores/PlataformasSyncPanel.tsx` com sub-tabs Softruck/Rede e a UI descrita acima — reaproveita `IntegracaoHealthPanel` para o health check.
- Novo modal `RastreadorSyncQueueDetailModal.tsx` (espelho de `SGAQueueItemDetailModal`) mostrando `payload` e `response_ultimo`.
- Adicionar a aba em `Rastreadores.tsx` (visível para `canManagePlataformas`).

## Permissões

- Acesso à aba: mesma checagem `canManagePlataformas` já usada para Plataformas/Locais.
- RLS nas duas tabelas novas: somente roles internos com `canManagePlataformas`.

## Não-escopo (para evitar replicar o que já existe)

- Não duplicar logs: a aba **Logs** lê de `rastreadores_api_logs` (já existe), só filtrando por plataforma.
- Não duplicar conexão/credenciais: usa `IntegracaoHealthPanel` e `ConfigurarIntegracaoSheet` existentes.
- Não criar cron de drenagem agora — só infra de fila + reprocessar manual (igual à Fila SGA hoje).

## Entregáveis

1. Migração: tabelas `rastreadores_sync_queue`, `rastreadores_sync_health_checks`, view `rastreadores_pendentes_vinculo`, RLS, índices.
2. Edge `rastreadores-sync-worker` (reprocess / enqueue / health_check).
3. Ajuste em `softruck-ativar-dispositivo` e `rede-veiculos-ativar-cliente-completo` para gravar resultado na fila (idempotente).
4. Hook + componentes React + nova aba em `Rastreadores.tsx`.
5. Validação como Diretor (`admin@teste.com`) abrindo a aba e reprocessando o IMEI `863829079716880` para confirmar fluxo.

Confirma que posso prosseguir com este plano? Se quiser, posso reduzir o escopo (ex.: só Softruck primeiro, ou só a aba Pendentes + Reprocessar sem criar tabela de fila).
