

## Plano: Eliminar serviços duplicados no mapa

### Problema raiz

A view `view_vistorias_mapa` faz `UNION ALL` de 3 fontes: `vistorias`, `instalacoes` e `servicos`. Quando um registro legado (`instalacoes`) tem um `servico` vinculado via `instalacao_origem_id`, E existe também um segundo `servico` standalone (encaixe) para o mesmo veículo/associado/data, ambos aparecem na view — gerando duplicata visual.

No caso atual:
- `instalacoes.13e5722e` → vinculado ao `servicos.eaaba0bf` (com profissional atribuído)
- `servicos.48f28d2a` → standalone encaixe, sem profissional, mesmo veículo/data

Ambos aparecem porque a view não tem lógica de deduplicação.

### Correção (2 frentes)

**1. View `view_vistorias_mapa` — Deduplicar nos blocos legados (migration)**

Nos blocos de `instalacoes` e `vistorias`, adicionar filtro para excluir registros legados quando já existe um serviço canonical standalone (`servicos` sem `origem_id`) para o mesmo `veiculo_id`, `tipo` e `data_agendada`:

```sql
-- No bloco de instalacoes, adicionar ao WHERE:
AND NOT EXISTS (
  SELECT 1 FROM servicos s2
  WHERE s2.veiculo_id = i.veiculo_id
    AND s2.tipo = 'instalacao'
    AND s2.data_agendada = i.data_agendada
    AND s2.instalacao_origem_id IS NULL
    AND s2.vistoria_origem_id IS NULL
    AND s2.status NOT IN ('cancelada', 'concluida')
)
```

Mesma lógica no bloco de `vistorias`.

**2. Prevenção futura — Validação ao criar encaixe**

Nos hooks que criam serviços de encaixe (ex: `useCriarRetirada`, `useVistoriaManutencao`, `agendar-vistoria-evento`), verificar se já existe um serviço ativo para o mesmo veículo+tipo+data antes de inserir. Se existir, bloquear ou avisar.

### Arquivos alterados
- Nova migration SQL para recriar `view_vistorias_mapa` com filtro NOT EXISTS
- (Opcional) Hooks de criação de encaixe para prevenção

### Resultado
Serviços duplicados para o mesmo veículo/data não aparecerão mais na lista lateral nem no mapa.

