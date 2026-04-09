

## Plano: Corrigir exclusao de associado na Base Antiga (FK sem CASCADE)

### Diagnostico
A funcao `limparSubstituicoes` tenta deletar registros de `substituicoes_veiculo` via client, mas a RLS (`is_funcionario(auth.uid())`) pode estar bloqueando silenciosamente (supabase retorna 0 rows sem erro). Resultado: os registros permanecem e a FK `substituicoes_veiculo_veiculo_novo_id_fkey` bloqueia o DELETE nos veiculos.

### Solucao
Alterar as FKs de `substituicoes_veiculo` para `ON DELETE CASCADE`. Assim, ao deletar um veiculo, o banco limpa automaticamente as substituicoes vinculadas — sem depender de RLS no client.

### Alteracao

**Migration SQL:**
```sql
ALTER TABLE substituicoes_veiculo
  DROP CONSTRAINT substituicoes_veiculo_veiculo_antigo_id_fkey,
  ADD CONSTRAINT substituicoes_veiculo_veiculo_antigo_id_fkey
    FOREIGN KEY (veiculo_antigo_id) REFERENCES veiculos(id) ON DELETE CASCADE;

ALTER TABLE substituicoes_veiculo
  DROP CONSTRAINT substituicoes_veiculo_veiculo_novo_id_fkey,
  ADD CONSTRAINT substituicoes_veiculo_veiculo_novo_id_fkey
    FOREIGN KEY (veiculo_novo_id) REFERENCES veiculos(id) ON DELETE CASCADE;
```

**`src/hooks/useDeleteBaseAntiga.ts`** — simplificar removendo `limparSubstituicoes` (agora desnecessaria, o CASCADE faz o trabalho). Manter apenas a checagem de outras FKs sem CASCADE que possam bloquear (como `contratos`, `ordens_servico`, `cobrancas` etc), limpando-as ou setando null antes de deletar os veiculos, ou adicionando CASCADE nessas tambem se fizer sentido para o contexto "Base Antiga".

Na pratica, para a Base Antiga (dados importados do SGA), provavelmente nao ha contratos, cobrancas ou ordens de servico vinculadas. Mas para seguranca, o hook pode tentar o delete e, se falhar, exibir a mensagem de erro com contexto.

### Resultado
- Exclusao de associados da Base Antiga funciona sem erro de FK
- Nao depende mais de RLS no client para limpar substituicoes
- Codigo do hook fica mais simples

### Arquivos
- Migration SQL (nova)
- `src/hooks/useDeleteBaseAntiga.ts`

