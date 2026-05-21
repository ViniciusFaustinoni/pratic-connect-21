## Contaminação confirmada — fix nos demais caminhos terminais da Troca

O bug do `cancelar-troca-titularidade` (link público sobrevivia ao cancelamento) **existe nos outros pontos terminais do fluxo**, que não foram tocados na correção anterior. Hoje só não estourou em produção porque só há 1 troca terminal (Vinicius — já saneada manualmente).

### Pontos contaminados

**1. `supabase/functions/reprovar-troca-titularidade/index.ts`**
Reprovação por Cadastro ou Monitoramento hoje **só** muda `status` da solicitação e dispara WhatsApp. Falta tudo o que tornamos canônico em `cancelar-troca`:
- não limpa `veiculos.em_troca_titularidade=false` → veículo fica preso "em troca"
- não cancela a cotação derivada (`origem_troca_titularidade=true`) nem rotaciona `token_publico` → novo titular ainda acessa o link
- grava `reprovado_por = user.id` (auth) em vez de `profiles.id` — mesmo bug de FK que corrigimos no cancelar

**2. `supabase/functions/cron-expirar-trocas-titularidade/index.ts`**
Quando expira por meia-noite:
- atualiza cotação para `status='recusada'` (campo errado — não bate com o set canônico `cancelada/expirada`) e **não** seta `status_contratacao`
- **não rotaciona `token_publico`** → link continua acessível até o guard de frontend renderizar a tela de expirada (defesa em profundidade quebrada)
- já limpa `em_troca_titularidade` (esse ponto está OK)

**3. Frontend `CotacaoContratacao.tsx`**
Guard que adicionei cobre `cancelada/expirada/reprovada_cadastro/reprovada_monitoramento` — não precisa mexer. Mas a UX de "cotação recusada" do cron precisa de status alinhado.

### Mudanças propostas

**`reprovar-troca-titularidade/index.ts`**
- Resolver `profiles.id` via `user.id` (mesma lógica do cancelar) e gravar em `reprovado_por`.
- Após update da solicitação, em best-effort:
  - `veiculos.update({em_troca_titularidade:false}).eq('id', sol.veiculo_id)`
  - Se houver `sol.cotacao_id`: `cotacoes.update({status:'cancelada', status_contratacao:'cancelada', cancelada_em, cancelada_por:profileId, motivo_cancelamento:'Troca reprovada (${etapa}): ${motivo}', token_publico: novoTokenRandom}).eq('id', sol.cotacao_id).eq('origem_troca_titularidade', true)`

**`cron-expirar-trocas-titularidade/index.ts`**
- Trocar o update da cotação de `status:'recusada'` para `{status:'cancelada', status_contratacao:'cancelada', cancelada_em:agora, motivo_cancelamento:'Prazo de assinatura expirado (meia-noite BRT)', token_publico: novoTokenRandom}` mantendo o filtro `eq('origem_troca_titularidade', true)`.

**Banco**
- Nenhuma migração: única troca terminal em produção (Vinicius) já está saneada (`em_troca_titularidade=false`, cotação cancelada, token rotacionado).

### Validação
- Não há solicitações terminais com flag/cotação penduradas (consulta confirmou).
- Após o deploy, qualquer reprovação ou expiração futura passa a deixar o sistema no mesmo estado canônico que o cancelamento manual já produz.

Esse é o conserto cirúrgico — sem mexer em fluxo, UI ou regra de negócio, apenas propaga o saneamento que já fizemos no cancelar para os dois outros caminhos terminais.