
## Diagnóstico — sim, há duplicidade funcional

Confirmado: existem hoje **dois caminhos sobrepostos** para o mesmo objetivo (destravar um serviço atribuído e mandá-lo para outro destino), implementados em momentos diferentes e em camadas diferentes.

### Como cada um funciona hoje

**1) Função antiga — "Realocar"** (`useRealocarInstalacao` + `RealocarInstalacaoDialog`)
- Usada no Mapa de Vistorias, no `InstalacaoDetailDrawer` e no `ServicoDetailModal` (botão "Realocar").
- Tudo no client (TypeScript). Faz `UPDATE` direto em `servicos`, `agendamentos_base` e registra no `associados_historico`.
- Tem **dois destinos**: Rota (com instalador opcional ou fila manual quando `rotaId=null`) e Base (oficina).
- Permite escolher data, período, instalador, rota nova, oficina, e enviar WhatsApp ao associado.
- **Não tem categoria** ("não compareceu", "técnico indisponível", etc.) e **não passa por RPC** — não há trava server-side de permissão; depende só de RLS.
- Não toca em `vistorias`, não limpa `iniciada_em` / `em_rota_em` / `confirmacao_whatsapp`.

**2) Função nova — "Devolver à fila / Reatribuir"** (RPCs `liberar_servico_para_reatribuicao` + `reatribuir_servico_admin`, `useDevolverServicoParaFila`/`useReatribuirServico`, `DevolverFilaDialog`, `DevolverFilaButton`, seção "Atribuídos travados/vencidos" no `AtribuicaoManualTab`)
- Tudo server-side via RPC `SECURITY DEFINER`, com checagem de role (diretor/admin/coord/analista monitoramento), exigência de motivo (≥5 chars) e categoria validada.
- Sincroniza atomicamente `servicos` + `instalacoes` + `vistorias` + `agendamentos_base` + `servicos_atribuicoes_log` + `associados_historico`.
- Limpa `iniciada_em`, `em_rota_em`, `confirmacao_whatsapp`, preserva `data_agendada_original`, registra log de auditoria estruturado.
- Destinos: **fila manual** (sem profissional) ou **profissional específico** (reatribuição direta). **Não cobre destino "Base/oficina"** nem permite escolher rota.
- Não envia WhatsApp ao associado.

### O que se sobrepõe e o que cada um tem de exclusivo

| Capacidade | Realocar (antigo) | Devolver/Reatribuir (novo) |
|---|---|---|
| Devolver à fila manual | sim (rota=null) | sim |
| Reatribuir a outro técnico | sim (instaladorId) | sim |
| Realocar para Rota específica | sim | não |
| Realocar para Base/Oficina | sim | não |
| Categoria do motivo | não | sim |
| Validação server-side de papel | não (só RLS) | sim (RPC) |
| Sincroniza `vistorias` | não | sim |
| Sincroniza `agendamentos_base` | sim (Base) | sim (sempre) |
| Limpa flags de execução (iniciada/em_rota/confirmação) | não | sim |
| Log estruturado em `servicos_atribuicoes_log` | não | sim |
| `associados_historico` | sim (`acao='realocada'`) | sim (`acao='devolvida_fila'` / `'reatribuida_manual'`) |
| WhatsApp ao associado | sim | não |
| Preserva `data_agendada_original` | não | sim |

**Conclusão:** os dois servem ao mesmo propósito-raiz (destravar/reatribuir/reagendar), mas com coberturas diferentes. A função nova é mais segura e atômica; a antiga é mais completa em destinos (rota/base) e tem WhatsApp. Hoje convivem três botões diferentes no `ServicoDetailModal` — "Realocar", "Devolver à fila" e "Liberar serviço" — o que confunde o operador.

---

## Plano — Unificar em um único fluxo

**Princípio:** uma única ação de operação chamada **"Realocar serviço"**, com a RPC como motor único, e o `RealocarInstalacaoDialog` como UI única (com 3 abas: Fila, Rota, Base). Tudo o que é hoje "Devolver à fila" / "Reatribuir" vira **a aba "Fila"** desse mesmo diálogo.

### 1. Banco — estender a RPC para cobrir Rota e Base

Trocar `liberar_servico_para_reatribuicao` por uma RPC mais genérica `realocar_servico` (mantendo a antiga como wrapper para compatibilidade), que aceita um destino:

```text
realocar_servico(
  _servico_id, _motivo, _categoria,
  _destino: 'fila' | 'rota' | 'base' | 'profissional',
  _nova_data, _novo_periodo,
  _rota_id        nullable,
  _profissional_id nullable,
  _oficina_id     nullable,
  _notificar_whatsapp boolean
) RETURNS jsonb
```

Comportamento por destino:
- `fila` → comportamento atual de `liberar_servico_para_reatribuicao` (profissional/rota = NULL).
- `profissional` → fila + atribui (substitui `reatribuir_servico_admin`).
- `rota` → fila + define `rota_id` + opcionalmente `profissional_id` (herdado da rota).
- `base` → fila + cria/atualiza `agendamentos_base` na oficina, marca `local_vistoria='base'`.

Tudo continua server-side com checagem de role, validação de motivo/categoria, sincronização de `instalacoes`/`vistorias`, fechamento do `agendamentos_base` antigo, log de auditoria e histórico do associado. Adicionar `tipo_atribuicao` correspondente ao destino.

A RPC retorna os dados necessários para o client disparar WhatsApp (telefone, nome, placa, dataFmt) — disparo continua client-side via `whatsapp-send-text`.

Manter as RPCs antigas (`liberar_servico_para_reatribuicao`, `reatribuir_servico_admin`) como **wrappers finos** que chamam `realocar_servico` com destino correto, para não quebrar nada já implantado.

### 2. Frontend — uma única UI

`RealocarInstalacaoDialog` passa a ter 3 abas:
- **Fila (manual)** — só motivo + categoria + data + período. (Substitui `DevolverFilaDialog`.)
- **Rota** — (já existe) motivo + data + rota + instalador + período.
- **Base** — (já existe) motivo + oficina + data + período.

Todas as 3 abas chamam **a mesma RPC** `realocar_servico` com `_destino` diferente. O hook `useRealocarInstalacao` é reescrito para apenas invocar a RPC e cuidar do toast/invalidação/WhatsApp opcional. A categoria fica visível também nas abas Rota e Base (default `reagendamento_operacional`).

### 3. Consolidar pontos de uso

No `ServicoDetailModal` e em todo lugar que hoje tem "Devolver à fila" / "Reatribuir" / "Realocar":
- Manter **um único botão "Realocar serviço"** que abre o diálogo unificado, já posicionado na aba certa conforme contexto:
  - Card de técnico no `AtribuicaoManualTab` → abre direto na aba **Fila** com a categoria pré-selecionada.
  - Seção "Atribuídos travados/vencidos" → idem.
  - Mapa / Drawer de instalação → abre na aba **Rota** (comportamento atual).
- Manter o botão **"Liberar serviço"** existente (que cancela de fato) como ação **separada e secundária**, porque tem outra semântica (cancelamento). Renomear para **"Cancelar serviço"** para deixar explícito.

### 4. Remover o que vira redundante

Após o diálogo unificado estar em produção:
- Remover `DevolverFilaDialog.tsx` e `DevolverFilaButton.tsx` (substituídos pela aba Fila).
- Remover os hooks `useDevolverServicoParaFila` e `useReatribuirServico` (consumidores migrados para `useRealocarInstalacao`).
- Manter os hooks `useServicosTravados` e `useConfigAtribuicaoManual` (não duplicam nada).
- Manter as RPCs antigas como wrappers (não removê-las para não quebrar contratos externos).

### 5. Histórico e auditoria

Padronizar `acao` no `associados_historico` por destino:
- `realocada_fila`, `realocada_profissional`, `realocada_rota`, `realocada_base`.

Atualizar o `TimelineHistorico.tsx` para mapear esses novos rótulos (já mapeia `devolvida_fila` e `reatribuida_manual` — adicionar os 4 acima e manter os antigos por compatibilidade).

---

## Detalhes técnicos (resumo)

- **Migração SQL**: criar `realocar_servico(...)` com toda a lógica unificada; reescrever `liberar_servico_para_reatribuicao` e `reatribuir_servico_admin` como wrappers que chamam `realocar_servico`.
- **Hook**: `useRealocarInstalacao` passa a ter `realocarParaFila`, `realocarParaRota`, `realocarParaBase`, `reatribuir` — todos chamando `supabase.rpc('realocar_servico', ...)`.
- **UI**: `RealocarInstalacaoDialog` ganha aba "Fila" e campo "Categoria" comum às 3 abas.
- **Pontos de uso atualizados**: `AtribuicaoManualTab`, `ServicoDetailModal`, `InstalacaoDetailDrawer`, `MapaVistoriasContent` — todos passam a abrir o mesmo diálogo, com `defaultTab` apropriada.
- **Componentes removidos**: `DevolverFilaDialog`, `DevolverFilaButton`.
- **Compatibilidade**: as RPCs antigas continuam funcionando (wrappers); nenhum fluxo de instalação/vistoria/manutenção é alterado em sua lógica de negócio — só é unificado o ponto de entrada.

---

## Resultado para o operador

Em vez de 3 botões com nomes parecidos e capacidades sobrepostas ("Realocar", "Devolver à fila", "Liberar serviço"), passa a existir:
- **Realocar serviço** → diálogo único com Fila / Rota / Base.
- **Cancelar serviço** → ação destrutiva separada (atual "Liberar serviço").

Quer que eu prossiga com a implementação deste plano?
