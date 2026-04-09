

## Plano: Modal de analise e aprovacao ao clicar em associado "Em Analise"

### Problema
Quando o analista de cadastro clica num associado com status "em_analise" na lista de Associados, abre o modal generico `AssociadoDetalhe`. O analista precisa de um fluxo direto de analise/aprovacao com acesso ao veiculo para autorizar.

### Abordagem
A pagina `/cadastro/propostas/:contratoId` (`PropostaAnalise`) ja tem todo o fluxo de aprovacao (documentos, vistoria, veiculo, botoes aprovar/reprovar/solicitar docs). Em vez de duplicar essa logica, a solucao e:

1. Quando o associado clicado tem status `em_analise`, buscar o contrato vinculado (`contratos.associado_id`) e navegar para `/cadastro/propostas/:contratoId`
2. Se nao houver contrato, abrir o `AssociadoDetalhe` normalmente (fallback)

### Alteracoes

**`src/pages/cadastro/Associados.tsx`**

1. Criar funcao `handleAssociadoClick(associado)`:
   - Se `associado.status === 'em_analise'` ou `pendente_vistoria` ou `documentacao_pendente`:
     - Buscar contrato: `supabase.from('contratos').select('id').eq('associado_id', associado.id).in('status', ['assinado','ativo']).order('created_at', {ascending: false}).limit(1).maybeSingle()`
     - Se encontrou contrato: `navigate('/cadastro/propostas/' + contrato.id)`
     - Se nao encontrou: `setDetalheAssociadoId(associado.id)` (fallback)
   - Senao: `setDetalheAssociadoId(associado.id)` (comportamento atual)

2. Substituir todos os `onClick={() => setDetalheAssociadoId(associado.id)}` nas TableCells por `onClick={() => handleAssociadoClick(associado)}`

3. Manter o dropdown "Ver detalhes" apontando para `setDetalheAssociadoId` (acesso direto ao detalhe continua disponivel)

### Resultado
- Analista clica em associado "Em Analise" → vai direto para a tela de analise da proposta com veiculo, documentos e botoes de aprovacao
- Associados ativos/outros status → abre o detalhe normal como antes
- Dropdown "Ver detalhes" continua abrindo o modal de detalhe para qualquer status

### Arquivo
- `src/pages/cadastro/Associados.tsx`

