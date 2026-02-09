
# Substituicao de Veiculo — Tabela, Types e Hook

## Resumo

Criar a infraestrutura completa para o fluxo de substituicao de veiculo: tabela no banco, colunas auxiliares em veiculos, tipos TypeScript e hook com 8 funcoes.

---

## Passo 1 — Migration: Tabela substituicoes_veiculo + colunas em veiculos

Uma unica migration SQL com:

1. `CREATE TABLE substituicoes_veiculo` com todas as 40+ colunas conforme especificado (status, snapshot veiculo antigo/novo, financeiro, evento bloqueante, carencia, aprovacao, consultor, autentique, metadata)
2. 3 indices (associado_id, status, veiculo_antigo_id)
3. RLS habilitada com 2 policies:
   - `funcionario_full_access`: full access para usuarios com tipo = 'funcionario'
   - `associado_select_proprio`: SELECT apenas para o proprio associado (via cadeia usuarios -> associados)
4. `ALTER TABLE veiculos` adicionando 5 colunas: `principal`, `substituido_por`, `data_inativacao`, `motivo_inativacao`, `substituicao_id`
5. `UPDATE veiculos SET principal = true WHERE ativo = true AND principal IS NULL` para marcar veiculos ativos existentes

---

## Passo 2 — Types: src/types/substituicao.ts

Novo arquivo com:

- `StatusSubstituicao` — union type com 9 valores (iniciada, aguardando_retirada, aguardando_vistoria, aguardando_financeiro, aguardando_aprovacao, aprovada, rejeitada, efetivada, cancelada_pelo_associado)
- `ResolucaoEvento` — 3 valores
- `TipoEventoBloqueante` — 4 valores
- `SubstituicaoVeiculo` — interface completa mapeando todas as colunas da tabela
- `DadosNovoVeiculo` — interface para dados de entrada do novo veiculo (placa, marca, modelo, FIPE, coberturas)
- Labels e cores para badges de status

---

## Passo 3 — Hook: src/hooks/useSubstituicaoVeiculo.ts

Hook com 8 funcoes, seguindo o padrao de useAssociados/useVeiculos (react-query):

1. **useSubstituicoes(associado_id?)** — query para listar substituicoes, com join em associados e veiculos
2. **useSubstituicao(id)** — query para buscar uma substituicao especifica com relacoes
3. **useIniciarSubstituicao()** — mutation que cria registro com status 'iniciada', salvando snapshot do veiculo antigo (placa, modelo, fipe, mensalidade, cota)
4. **useAtualizarSubstituicao()** — mutation generica para update de campos
5. **useAprovarSubstituicao()** — mutation que seta aprovado_por, aprovado_em, status = 'aprovada'
6. **useRejeitarSubstituicao()** — mutation que seta motivo_rejeicao, rejeitado_por, rejeitado_em, status = 'rejeitada'
7. **useEfetivarSubstituicao()** — mutation complexa que executa a efetivacao (marcar veiculo antigo como inativo com substituido_por, criar/vincular veiculo novo como principal, atualizar status para 'efetivada')
8. **useVerificarElegibilidade(associado_id)** — query que verifica:
   - Adimplencia: busca cobrancas com status em aberto (PENDING/OVERDUE) na tabela asaas_cobrancas ou cobrancas
   - Rastreador: le pendencia_rastreador do associado
   - Evento ativo: busca sinistros do veiculo do associado com status diferente de 'concluido' e 'negado'
   - Retorna { adimplente, rastreador_devolvido, evento_ativo: { tem, tipo, evento_id }, elegivel }

Cada mutation invalida queries `['substituicoes']` e relevantes apos sucesso.

---

## Passo 4 — Registrar no config.toml

Nenhuma edge function nova neste passo. Tabela usa acesso direto via supabase client.

---

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Nova tabela + ALTER veiculos |
| `src/types/substituicao.ts` | Novo |
| `src/hooks/useSubstituicaoVeiculo.ts` | Novo |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente pela migration |

## O que NAO sera alterado

- Nenhum componente frontend existente
- Nenhum hook existente
- Nenhuma edge function existente
- useFipe, useFipeLookup — intactos
- CancelarAssociadoDialog, ExcluirAssociadoDialog — intactos

## Detalhes tecnicos

### Elegibilidade

A query de elegibilidade faz 3 consultas paralelas (Promise.all):
1. `asaas_cobrancas` ou `cobrancas` com status em aberto para o associado
2. `associados` para ler `pendencia_rastreador`
3. `sinistros` com `veiculo_id` do veiculo ativo do associado e status NOT IN ('concluido', 'negado', 'encerrado')

O resultado `elegivel` e true apenas se: adimplente AND !pendencia_rastreador AND (!evento_ativo.tem OR evento_ativo.tipo === 'terceiros_paralelo')

### Efetivacao (useEfetivarSubstituicao)

A mutation de efetivacao faz:
1. Marcar veiculo antigo: `ativo = false, principal = false, substituido_por = veiculo_novo_id, data_inativacao = now(), motivo_inativacao = 'substituicao', substituicao_id = id`
2. Marcar veiculo novo: `ativo = true, principal = true, substituicao_id = id`
3. Atualizar substituicao: `status = 'efetivada', updated_at = now()`
4. Registrar em `associados_historico`
5. Invalidar queries de veiculos e substituicoes

### RLS

A policy de associado usa subquery encadeada: `associado_id = (SELECT id FROM associados WHERE user_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid()))`. Isso garante que o associado so ve suas proprias substituicoes.
