

## Duplicação de cotação: oferecer exclusão da original quando for o mesmo consultor

### Ajuste sobre o plano anterior

Mantém-se tudo que foi planejado (diálogo de confirmação, motivo, marcação de substituída, ignorar placa presa da original). A diferença está no comportamento quando **o consultor logado é o mesmo que criou a cotação original**.

### Nova lógica condicional no diálogo de duplicação

Ao abrir o `DuplicarCotacaoDialog`, detectar se `cotacao.vendedor_id === user.id`:

**Caso A — Mesmo consultor (autor da cotação)**
- Mostrar uma pergunta extra acima do botão de confirmação:
  > "Esta cotação foi criada por você. O que deseja fazer com a original?"
  
  Opções (radio):
  - 🗑️ **Excluir a cotação original** (recomendado para correções) — *padrão selecionado*
  - 📝 **Manter como substituída** (registro de auditoria preservado)
  
- Se escolher **Excluir**: a original é apagada de fato (`DELETE` em `cotacoes` pelo id), liberando a placa imediatamente. Sem rastro de "substituída por".
- Se escolher **Manter**: comportamento original do plano (status `recusada` + `substituida_por_cotacao_id` + `motivo_substituicao`).

**Caso B — Outro consultor (gestor corrigindo cotação alheia)**
- **Não oferecer** a opção de excluir.
- Sempre marcar como substituída (preserva auditoria entre consultores).
- Mantém o aviso "Esta cotação pertence a {nome}. A correção será atribuída a você."

### Regras de bloqueio da exclusão

A exclusão só é permitida quando a cotação original estiver em estado **seguro de descartar**:
- ✅ Status `rascunho` ou `enviada` (sem aceite formal)
- ❌ Status `aceita`, com contrato gerado, com agendamento, ou com pagamento → força modo "Manter como substituída" (radio da exclusão fica desabilitado com tooltip explicando)

A verificação roda no abrir do diálogo via consulta rápida: existe `contrato` ou `agendamento_base` apontando para a cotação? Se sim, bloqueia exclusão.

### Campo "Motivo"

- Continua **obrigatório** em ambos os casos (excluir ou manter).
- No caso de exclusão, o motivo vai para `system_logs` apenas (não há mais cotação para guardar o campo).

### Trilha de auditoria

- **Excluir**: registrar em `system_logs` com ação `excluir_cotacao_para_duplicacao`, payload `{ cotacao_excluida_id, numero, vendedor_id, motivo, nova_cotacao_id }`. Garante rastro mesmo sem a cotação física.
- **Manter substituída**: comportamento original (log + campos na cotação).

### Ajustes nos arquivos do plano anterior

**`src/components/cotacoes/DuplicarCotacaoDialog.tsx` (novo)**
- Adicionar prop derivada `isMesmoConsultor` e estado `acaoOriginal: 'excluir' | 'manter'`.
- Renderizar bloco de radio condicional.
- Consultar contratos/agendamentos para habilitar/desabilitar opção excluir.

**`src/hooks/useCotacoes.ts` → `useDuplicarCotacao`**
- Aceitar `{ cotacaoId, motivo, acaoOriginal: 'excluir' | 'manter' }`.
- Se `acaoOriginal === 'excluir'`: criar nova + `DELETE` da original + log.
- Se `acaoOriginal === 'manter'`: criar nova + `UPDATE` da original (status/substituida_por/motivo) + log.
- Se `acaoOriginal` for `excluir` mas existir contrato/agendamento, retornar erro orientando a recarregar (race condition).

**Sem mudanças** em `useVerificarPlaca.ts` (o `ignorarIds` continua útil, especialmente no modo "manter"; no modo "excluir" a placa é liberada naturalmente).

### Validação adicional

1. Vendedor A cria cotação errada → clica Duplicar → diálogo mostra "Excluir original" pré-selecionado → confirma → original some da lista, nova abre limpa, sem placa presa.
2. Vendedor A cria cotação, gera contrato → tenta duplicar → opção "Excluir" aparece desabilitada com tooltip "Cotação já gerou contrato — apenas substituição é permitida".
3. Gestor duplica cotação do Vendedor A → diálogo **não exibe** opção de excluir → segue fluxo de substituição.
4. Vendedor A escolhe "Manter como substituída" mesmo sendo o autor → original fica com badge "Substituída por COT-..." na lista.

