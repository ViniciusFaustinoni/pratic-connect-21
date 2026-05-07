# Plano — Saída correta de Propostas Pendentes por tipo de vistoria

## Regra de negócio (do seu texto)

Propostas Pendentes só lista quem precisa de ação do **Cadastro**.

| Cenário | Entra em Propostas Pendentes | Sai de Propostas Pendentes | Vira Associado |
|---|---|---|---|
| **Com autovistoria** | Após finalizar link público (contrato `assinado`) | **Quando Cadastro aprovar** | No mesmo momento — vai para `/cadastro/associados` com status `aguardando_instalacao` (agendamento já feito, aguarda só execução do serviço de campo) |
| **Sem autovistoria** (presencial / vistoria-base) | Após finalizar link público (sem R&F ainda — ainda não é associado) | **Quando a instalação do rastreador for concluída** | Após conclusão da instalação. Entre a aprovação do Cadastro e a conclusão, permanece na lista com badge **"Pendente Vistoria Inicial"** |

SGA continua como hoje:
- Com autovistoria: SGA enviado após aprovação do Cadastro (sempre código PENDENTE).
- Sem autovistoria: SGA enviado após aprovação do Cadastro **e** Monitoramento (sempre código PENDENTE).
- Promoção para ATIVO no SGA segue manual (regra atual da memory `Core`).

## Diagnóstico (estado atual)

`src/hooks/usePropostasPendentes.ts` filtra `contratos.status='assinado'`.
Em `supabase/functions/aprovar-proposta/index.ts`, quando `deveAguardarInstalacao=true` (R&F + precisa rastreador + sem instalação concluída), o contrato fica em `assinado` indefinidamente — **inclui autovistorias já aprovadas pelo Cadastro**, que deveriam sair da fila. Hoje o que define "saiu/não saiu" é só a necessidade de rastreador, não o `tipo_vistoria`. Por isso JHONY (autovistoria, R&F, agendado, cadastro aprovou) continua aparecendo em Propostas Pendentes.

## Solução

### 1. Migração SQL (`supabase/migrations/<novo>.sql`)
- `ALTER TABLE contratos ADD COLUMN cadastro_aprovado boolean NOT NULL DEFAULT false`.
- Backfill: `UPDATE contratos SET cadastro_aprovado=true WHERE aprovado_em IS NOT NULL`.
- Índice parcial: `CREATE INDEX ON contratos (status) WHERE cadastro_aprovado=false`.

Sem alteração em enum / RLS / outros consumidores.

### 2. Edge `supabase/functions/aprovar-proposta/index.ts`
- No update de `contratos` (linhas 118–124 e bloco final 463–467), incluir `cadastro_aprovado: true`.
- Carregar `cotacoes.tipo_vistoria` (já é fetched indiretamente; usar no decision tree).
- Bloco `if (deveAguardarInstalacao)` passa a ramificar:
  - **Autovistoria**: `contratos.status='assinado'` + `cadastro_aprovado=true` + `associados.status='aguardando_instalacao'`. (Sai da lista, vira "associado em aguardando_instalacao".)
  - **Não-autovistoria** (presencial/base): mesmo update + `cadastro_aprovado=true`. Permanece na lista (badge "Pendente Vistoria Inicial") porque o filtro também inclui contratos `cadastro_aprovado=true` quando `tipo_vistoria != 'autovistoria'` e instalação não concluída.
- Sem mudar a lógica do SGA (continua o mesmo enqueue: `pendente` aqui; `ativo` só na ativação completa via `ativar-associado`).

### 3. Hook `src/hooks/usePropostasPendentes.ts`
- Adicionar `cadastro_aprovado` no `select` de contratos.
- Adicionar `tipo_vistoria` ao `select` da `cotacoes` (já existe, confirmar).
- Filtro derivado pós-fetch:
  - **Mantém** se: `cadastro_aprovado=false` (caso clássico — aguardando análise do cadastro), **OU** (`cadastro_aprovado=true` AND `tipo_vistoria != 'autovistoria'` AND instalação não está `concluida`).
  - **Remove** se: `cadastro_aprovado=true` AND `tipo_vistoria='autovistoria'` (já é tarefa do campo).
  - **Remove** se: instalação `concluida` (já vira `ativo` via `ativar-associado`).
- Tipo `PropostaPendente` ganha `cadastro_aprovado: boolean`.

### 4. UI `src/pages/cadastro/PropostasPendentes.tsx`
- Em `getStatusBadge`, adicionar (com prioridade alta após o early return de `Aguard. Doc`):
  - `cadastro_aprovado=true` AND `tipo_vistoria != 'autovistoria'` AND instalação não concluída → badge **"Pendente Vistoria Inicial"** (roxo, `bg-purple-500/15 text-purple-500`).
- Manter os demais badges atuais.

### 5. Header `src/components/cadastro/proposta/PropostaHeroHeader.tsx`
- Mesmo critério acima → chip "Pendente Vistoria Inicial" no header da proposta.

### 6. Memory
Adicionar memory `mem://logic/operations/propostas-pendentes-saida-por-vistoria` resumindo a regra (entrada/saída por tipo_vistoria + flag `cadastro_aprovado`) e atualizar `mem://index.md`.

## Arquivos a editar
- `supabase/migrations/<novo>.sql` (coluna + backfill + índice)
- `supabase/functions/aprovar-proposta/index.ts` (set `cadastro_aprovado=true`)
- `src/hooks/usePropostasPendentes.ts` (select + filtro + tipo)
- `src/pages/cadastro/PropostasPendentes.tsx` (badge "Pendente Vistoria Inicial")
- `src/components/cadastro/proposta/PropostaHeroHeader.tsx` (chip)
- `mem://index.md` + nova memory

## Validação pós-deploy
1. **JHONY** (autovistoria, R&F, agendamento ok, cadastro aprovou) → some de Propostas Pendentes; aparece em `/cadastro/associados` como `aguardando_instalacao`.
2. **Caso presencial** com cadastro aprovado e instalação não concluída → permanece na lista com badge **"Pendente Vistoria Inicial"**.
3. Após instalação concluir → `ativar-associado` promove tudo para `ativo`, some da lista, vira Associado.
4. SGA: 1º envio `pendente` na aprovação do cadastro (autovistoria) ou após cadastro+monitoramento (não-autovistoria); promoção `ativo` segue manual.

Posso seguir?
