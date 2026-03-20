

# Plano: Isenção de Carência de Vidros em Migração Aprovada no Fluxo de Cotação

## Estado Atual

**O que já existe:**
- `contrato-gerar/index.ts` (linhas 641-700): calcula carência de vidros para TODOS os contratos, mas **nunca verifica** se a cotação tem migração aprovada. Variáveis `carenciaVidrosIsenta` e `carenciaVidrosMotivoIsencao` são declaradas mas sempre ficam `false`/`null`.
- `useSolicitacoesMigracaoAdmin.ts`: quando migração é aprovada pelo caminho direto (sem cotação), já grava `carencia_vidros_isenta: true` no contrato existente. Este caminho está correto.
- Tabela `solicitacoes_migracao` tem coluna `cotacao_id` que vincula migração à cotação.
- Configuração `migracao_isentar_carencia` existe na tabela `configuracoes` e é usada no admin.

**O que falta:**
- `contrato-gerar` não consulta `solicitacoes_migracao` para verificar se a cotação tem migração aprovada.
- `contrato-gerar` não lê `migracao_isentar_carencia` da config.
- Resultado: contratos gerados via cotação com migração aprovada sempre têm carência ativa.

## Implementação

### Arquivo único: `supabase/functions/contrato-gerar/index.ts`

Após a linha 657 (onde `dataCarenciaVidrosFim` é calculado) e antes do insert do contrato, adicionar:

1. **Buscar migração aprovada vinculada à cotação:**
```
SELECT id, status FROM solicitacoes_migracao 
WHERE cotacao_id = :cotacao_id AND status = 'aprovada' LIMIT 1
```

2. **Se encontrou migração aprovada, ler config de isenção:**
```
SELECT valor FROM configuracoes WHERE chave = 'migracao_isentar_carencia'
```

3. **Se config ativa (`true`), aplicar isenção:**
- `carenciaVidrosIsenta = true`
- `carenciaVidrosMotivoIsencao = 'Migração aprovada'`
- `dataCarenciaVidrosInicio = null`
- `dataCarenciaVidrosFim = null`
- Também isentar carência geral: `dataCarenciaInicio = null`, `dataCarenciaFim = null`
- Setar `carencia_isenta = true`, `carencia_motivo_isencao = 'Migração aprovada'` (mesmo padrão do admin)

4. **Se config desativada, manter carência padrão** (comportamento atual, sem alteração).

5. **Adicionar fallback por CPF**: Se a cotação não tem `cotacao_id` direto na `solicitacoes_migracao`, buscar também por CPF do cliente (mesmo padrão usado no admin para migrações sem cotação vinculada).

### Resultado
- Contratos de migração aprovada via cotação terão isenção automática de carência geral e de vidros
- Isenção controlada pela config `migracao_isentar_carencia` — nunca hardcoded
- Motivo registrado para auditoria
- Ambos os caminhos (cotação e direto) se comportam identicamente

