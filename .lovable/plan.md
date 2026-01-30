# Plano: Correção do Sistema de Atribuição Automática de Tarefas

## ✅ IMPLEMENTAÇÃO CONCLUÍDA

### Resumo das Correções Aplicadas

| Item | Status | Descrição |
|------|--------|-----------|
| 1. Migração SQL | ✅ Concluído | Tabela `instalacoes_pendentes_criacao` criada |
| 2. `criar-instalacao-pos-pagamento` | ✅ Concluído | Tratamento explícito para autovistoria + logs detalhados |
| 3. `asaas-webhook` | ✅ Concluído | Retry com backoff (3 tentativas) + registro de falhas |
| 4. `cron-reconciliar-instalacoes` | ✅ Concluído | Novo cron job criado e deployado |
| 5. Instalações retroativas | ✅ Concluído | 4 contratos corrigidos |

---

## Contratos Corrigidos

| Cliente | Cotação ID | Status Final |
|---------|------------|--------------|
| MARCOS VINICIUS DATIVO MACHADO | 028562d5-... | ✅ Instalação agendada |
| THALES HENRIQUE SOILO | 16403742-... | ✅ Instalação criada |
| LEANDRO DA SILVA FERREIRA | 2dec2d91-... | ✅ Instalação criada |
| MARCUS VINICIUS FAUSTINONI | c34d6e95-... | ✅ Instalação em_rota (já atribuída) |

---

## Alterações Técnicas Realizadas

### 1. Edge Function `criar-instalacao-pos-pagamento`

**Arquivo**: `supabase/functions/criar-instalacao-pos-pagamento/index.ts`

Agora trata explicitamente:
- `tipo_vistoria = 'agendada'` → Usa campos `vistoria_*`
- `tipo_vistoria = 'autovistoria'` → Usa campos `vistoria_completa_*` para data/hora/endereço, mantendo coordenadas compartilhadas
- Logs detalhados para debug

### 2. Edge Function `asaas-webhook`

**Arquivo**: `supabase/functions/asaas-webhook/index.ts`

Melhorias:
- Retry com backoff exponencial (3 tentativas)
- Registro de falhas na tabela `instalacoes_pendentes_criacao`
- Logs mais detalhados

### 3. Nova Tabela `instalacoes_pendentes_criacao`

Campos:
- `cotacao_id`, `contrato_id` (referências)
- `motivo`, `tentativas`, `ultima_tentativa`, `erro_detalhes`
- `resolvido`, `resolvido_em`, `resolvido_por`

### 4. Novo Cron Job `cron-reconciliar-instalacoes`

**Arquivo**: `supabase/functions/cron-reconciliar-instalacoes/index.ts`

Funcionalidades:
- Busca contratos pagos sem instalação
- Tenta criar instalações faltantes
- Processa registros pendentes da tabela de rastreamento
- Marca como resolvido quando sucesso

---

## Validação

- ✅ 4 instalações criadas/corrigidas
- ✅ Atribuição automática funcionando (aguardando profissional disponível)
- ✅ Edge functions deployadas
- ✅ Tabela de rastreamento criada

---

## Próximos Passos Sugeridos

1. **Configurar cron schedule** para `cron-reconciliar-instalacoes` (ex: a cada 15 minutos)
2. **Monitorar** tabela `instalacoes_pendentes_criacao` para falhas recorrentes
