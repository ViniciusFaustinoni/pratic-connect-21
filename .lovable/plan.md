# Correção: erro ao realocar serviço para a base

## Causa raiz

O dialog **Realocar serviço** chama `useRealocarInstalacao.realocarParaBase`, que insere em `agendamentos_base` com:

```ts
instalacao_id: params.instalacaoId
```

Mas o ID que chega do modal de Serviços de Campo (`ServicoDetailModal`) é o `servicos.id` — não o `instalacoes.id`.

A constraint do banco é clara:

```
agendamentos_base_instalacao_id_fkey
FOREIGN KEY (instalacao_id) REFERENCES instalacoes(id)
```

→ Postgres rejeita o insert com o erro de foreign key visto na tela.

O fluxo "realocar para rota" não quebra porque ele só faz UPDATE em `servicos` (não toca em `agendamentos_base`).

## Correção

Em `src/hooks/useRealocarInstalacao.ts`, dentro de `realocarParaBase`:

1. Ao buscar o serviço, incluir o campo `instalacao_origem_id`:
   ```ts
   .select(`id, status, associado_id, instalacao_origem_id, associados:..., veiculos:...`)
   ```

2. Resolver o ID real de `instalacoes`:
   - Se `serv.instalacao_origem_id` existir → usar esse valor.
   - Senão → fazer fallback consultando `instalacoes` por `servico_id` (ou pelo `associado_id` + `veiculo_id` em aberto), e se ainda assim não houver vínculo, lançar erro amigável: "Este serviço não possui instalação vinculada — não é possível realocá-lo para uma base."

3. Usar o ID resolvido tanto no UPDATE de cancelamento dos `agendamentos_base` ativos (linha ~176) quanto no INSERT (linha ~183):
   ```ts
   .eq('instalacao_id', instalacaoIdReal)
   instalacao_id: instalacaoIdReal,
   ```

4. Manter o UPDATE de `servicos` usando o `params.instalacaoId` original (que é o `servicos.id`) — esse já está correto.

## Arquivos alterados

- `src/hooks/useRealocarInstalacao.ts` — única mudança necessária.

## Validação após implementar

- Reproduzir o fluxo: Serviços de Campo → abrir serviço de instalação → Realocar → aba Base → confirmar.
- Esperado: toast "Instalação realocada para a base!" e novo registro em `agendamentos_base` com `instalacao_id` válido.
- Verificar que o caso de serviço sem `instalacao_origem_id` mostra mensagem amigável (não o erro técnico de FK).
