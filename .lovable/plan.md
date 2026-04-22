

## Corrigir erro de embed PostgREST no realojamento de serviço (rota e base)

### Causa

Na imagem, o toast mostra:
> Erro ao realocar: Could not embed because more than one relationship was found for 'servicos' and 'associados'

O hook `src/hooks/useRealocarInstalacao.ts` faz dois `select` que usam embeds **sem qualificar o foreign key**:

```ts
.select('id, status, associado_id, associados(nome, telefone), veiculos(...)')
```

A tabela `servicos` tem **duas FKs para `veiculos`** (`servicos_veiculo_id_fkey` e `servicos_novo_veiculo_id_fkey`) e várias rotas inversas via `associados`, fazendo o PostgREST recusar embeds genéricos. Outros hooks da base já resolvem isso usando `!nome_da_fk` (ex.: `useImprevistos`, `useRetiradaRastreador`, `useVistoriasEvento`). O `useRealocarInstalacao` é o único ponto fora do padrão — por isso "Realocar para esta base" e "Realocar para rota" quebram, enquanto Reagendar/Atribuir Técnico (que usam outros hooks) funcionam.

### Correção

**Único arquivo:** `src/hooks/useRealocarInstalacao.ts`

Trocar os dois `select` (linhas 81 e 136) para qualificar explicitamente as FKs:

```ts
.select(`
  id, status, associado_id,
  associados:associados!servicos_associado_id_fkey(nome, telefone),
  veiculos:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo, ano_modelo)
`)
```

Manter os aliases `associados` e `veiculos` para não precisar mexer em nenhum dos `(serv as any).associados.*` / `.veiculos.*` que vêm depois — só o lado do PostgREST muda.

Isso resolve **ambos** os fluxos (`realocarParaRota` e `realocarParaBase`) com uma única edição cirúrgica. Sem mudança de schema, sem mudança de UI, sem efeito colateral em outras telas.

### Critérios de aceitação

1. Coordenador de monitoramento consegue clicar em "Realocar para esta base" e "Realocar para esta rota" no mapa sem ver o erro `more than one relationship was found`.
2. Toast de sucesso "Instalação realocada para a base!" / "Instalação realocada para a rota!" aparece e o serviço some da fila de pendentes.
3. Notificação WhatsApp ao associado (quando o checkbox está marcado) continua usando `associados.nome` e `associados.telefone` corretamente.
4. Histórico em `associados_historico` é gravado normalmente (não depende do embed).

### Fora de escopo

- Mexer em qualquer outro hook (todos os demais já estão qualificados).
- Refatorar a tela `MapaVistoriasContent.tsx` ou o `RealocarInstalacaoDialog.tsx` — o bug é puramente no hook.
- Investigar a tab "Rota" (mesma correção a cobre, pois os dois mutations dividem o mesmo `select`).

