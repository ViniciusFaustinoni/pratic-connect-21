

## Ajuste — Realocação respeitando modo Atribuição Manual

### Comportamento atual
Ao realocar um serviço (drawer ou mapa), o sistema sempre define `instalador_responsavel_id` (na aba Rota) ou cria agendamento direto na base. Isso **bypassa** o fluxo de Atribuição Manual quando ele está ativo, tirando do coordenador a chance de escolher o instalador no mapa.

### Comportamento desejado
Quando `useConfigAtribuicaoManual().data === true` (modo manual ligado):

**Aba "Mover para Rota"**
- Esconder o seletor "Instalador" (a rota pode até ter instalador padrão, mas não vinculamos automaticamente).
- No update de `instalacoes`, **NÃO setar** `instalador_responsavel_id` — deixar `null`.
- Manter `rota_id`, `data_agendada`, `hora_agendada`, `status='agendada'`.
- Resultado: o serviço aparece na aba **Atribuição Manual** (`/monitoramento/vistorias-instalacoes-mon` → tab "Atribuição Manual") e no **Mapa** como pin sem dono, pronto para o coordenador atribuir.

**Aba "Mover para Base"**
- Manter como está (agendamento na base não passa por instalador de rota).
- Apenas garantir que `instalador_responsavel_id` continue `null` no `instalacoes`.

**Quando o modo manual está desligado**: comportamento atual preservado (instalador é setado normalmente).

### Mensagem de UI
No topo de cada aba do `RealocarInstalacaoDialog`, quando `manualAtiva === true`, exibir um aviso curto:
> "Modo Atribuição Manual ativo — o serviço entrará na fila de atribuição para você designar o instalador no mapa."

### Arquivos tocados
- **`src/components/instalacoes/RealocarInstalacaoDialog.tsx`** — ler `useConfigAtribuicaoManual`; ocultar seletor de instalador na aba Rota quando ativo; exibir aviso; não enviar `instaladorId` no payload.
- **`src/hooks/useRealocarInstalacao.ts`** — ao montar o `update` da aba Rota, só incluir `instalador_responsavel_id` quando o caller passar valor (já está condicional, mas confirmar que `null`/`undefined` não sobrescreve incorretamente). Sem mudança de assinatura.

Sem migração, sem nova policy, sem alteração no fluxo de Atribuição Manual existente.

### Validação
1. Ativar Atribuição Manual nas configurações.
2. Realocar Marcos Vinicius (QXV0H02) para uma rota → conferir que `instalador_responsavel_id` ficou `null` e o serviço aparece na aba "Atribuição Manual" e como pin sem dono no mapa.
3. Coordenador atribui o serviço a um instalador via mapa → fluxo manual normal segue.
4. Desativar Atribuição Manual e realocar outro serviço → instalador é vinculado automaticamente como antes.
5. Realocar para Base com manual ativo → agendamento criado normalmente, `instalacoes.instalador_responsavel_id` permanece `null`.

