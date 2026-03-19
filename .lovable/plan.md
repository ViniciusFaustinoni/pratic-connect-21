

# Pós-Aprovação da Troca de Titularidade — Automação Completa

## Resumo

Implementar toda a lógica de pós-aprovação na edge function `aprovar-solicitacao-ia`, cobrindo criação/reuso de associado, transferência de veículo, criação de contrato, encerramento do contrato anterior, cobrança da taxa via ASAAS, e o gatilho automático para o Cenário B quando a vistoria for concluída.

## Arquitetura atual

- **Cenário A**: Atualmente só grava log de auditoria e envia WhatsApp.
- **Cenário B**: Cria um registro em `servicos` com `origem: "troca_titularidade"` e envia WhatsApp.
- **`processar-vistoria`**: Opera sobre a tabela `vistorias` (não `servicos`), sem nenhuma lógica de troca de titularidade.
- **`contratos`**: Tem campos `tipo_entrada`, `origem_troca_titularidade_id`, `carencia_isenta`, `carencia_motivo_isencao`, `vendedor_id`.
- **Configurações**: `taxa_troca_titularidade` (R$ 50), `carencia_dias_padrao` (120 dias).
- **ASAAS**: `asaas-clientes` (action: `sincronizar`) cria/atualiza cliente automaticamente a partir de `associado_id`. `asaas-cobrancas` (action: `criar`) cria cobrança a partir de `associado_id` + `dados`.

## Alterações

### 1. Nova edge function `efetivar-troca-titularidade`

Função dedicada que executa a sequência completa de pós-aprovação. Será chamada pelo Cenário A (diretamente) e pelo Cenário B (após vistoria aprovada).

**Entrada**: `{ solicitacao_id }`

**Sequência**:

1. **Buscar solicitação** — ler `chat_solicitacoes_ia` com `dados` e `dados_novo_titular`
2. **Buscar/Criar associado do novo titular** — buscar por CPF na tabela `associados`. Se existir e estiver ativo, reutilizar. Se não existir, criar com status `ativo`, usando nome, CPF, email, telefone de `dados_novo_titular`.
3. **Buscar veículo e contrato anterior** — identificar o veículo da solicitação e o contrato ativo do titular anterior.
4. **Ler configurações** — `taxa_troca_titularidade`, `carencia_dias_padrao` e `carencia_troca_titularidade_dispensada` (nova config para dispensar carência no Cenário A).
5. **Transferir veículo** — `UPDATE veiculos SET associado_id = novoAssociadoId WHERE id = veiculoId`. Manter rastreador, FIPE, todos os dados técnicos intactos.
6. **Criar contrato do novo titular** — inserir em `contratos` com:
   - `tipo_entrada: 'troca_titularidade'`
   - `origem_troca_titularidade_id: solicitacao_id`
   - `associado_id: novoAssociadoId`
   - `veiculo_id: veiculoId`
   - Copiar `plano_id`, `valor_mensal`, `cota_participacao` do contrato anterior
   - `vendedor_id`: buscar do contrato anterior ou do campo `criado_por` da solicitação
   - Carência: se Cenário A, dispensar (`carencia_isenta: true`); se Cenário B, aplicar `carencia_dias_padrao`
   - `status: 'ativo'`
7. **Encerrar contrato anterior** — `UPDATE contratos SET status = 'cancelado', data_cancelamento = now() WHERE id = contratoAnteriorId` (somente se o novo contrato foi criado com sucesso).
8. **Sincronizar/Criar cliente ASAAS** — chamar `asaas-clientes` com `action: 'sincronizar'` para o novo associado.
9. **Gerar cobrança da taxa** — chamar `asaas-cobrancas` com `action: 'criar'`, `associado_id` do novo titular, valor da config `taxa_troca_titularidade`, tipo `taxa_troca_titularidade`.
10. **Atualizar solicitação** — salvar `cenario` e `novo_associado_id` nos `dados` da solicitação para a ficha exibir.
11. **Registrar histórico** — em `associados_historico` para ambos os associados (antigo e novo).
12. **Log de auditoria** — registrar toda a operação com IDs de contrato antigo/novo.

### 2. Modificar `aprovar-solicitacao-ia` — Cenário A

No bloco do Cenário A (linha ~660), após o log de auditoria existente, chamar `efetivar-troca-titularidade` via `fetch` interno:

```
await fetch(`${SUPABASE_URL}/functions/v1/efetivar-troca-titularidade`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ solicitacao_id }),
});
```

### 3. Modificar `aprovar-solicitacao-ia` — Cenário B

Cenário B continua criando o serviço de vistoria como hoje. Adicionar o `solicitacao_id` como referência no registro do serviço (campo `observacoes` já contém dados, mas precisamos de um campo estruturado).

### 4. Modificar `processar-vistoria` — Gatilho do Cenário B

No bloco de vistoria aprovada, após as lógicas atuais, adicionar verificação:

- Buscar se existe um registro em `servicos` com `origem = 'troca_titularidade'` vinculado ao mesmo `associado_id` + `veiculo_id` e `status = 'pendente'`
- Se encontrado, buscar a `solicitacao_id` correspondente em `chat_solicitacoes_ia`
- Chamar `efetivar-troca-titularidade` com essa `solicitacao_id`
- Atualizar o serviço como `concluido`

### 5. Migration: coluna `solicitacao_id` na tabela `servicos`

Adicionar `solicitacao_id UUID REFERENCES chat_solicitacoes_ia(id)` na tabela `servicos` para vincular estruturalmente a vistoria do Cenário B à solicitação original. Isso elimina a necessidade de buscar por associado_id+veiculo_id.

### 6. Configuração nova (opcional)

Adicionar chave `carencia_troca_titularidade_cenario_a` na tabela `configuracoes` com valor `0` (sem carência no cenário A). Se não existir, usar fallback `0`. O Cenário B usa `carencia_dias_padrao` (120 dias).

## Fluxo visual

```text
APROVAÇÃO
    ├── Cenário A (vistoria dispensada)
    │   └── efetivar-troca-titularidade
    │       ├── Buscar/Criar associado
    │       ├── Transferir veículo
    │       ├── Criar contrato (carência dispensada)
    │       ├── Encerrar contrato anterior
    │       ├── Sincronizar ASAAS + cobrar taxa
    │       └── Registrar histórico + auditoria
    │
    └── Cenário B (vistoria obrigatória)
        └── Criar serviço de vistoria (com solicitacao_id)
            │
            └── [Quando vistoria for aprovada]
                └── processar-vistoria detecta origem
                    └── efetivar-troca-titularidade
                        ├── (mesma sequência do Cenário A)
                        └── Carência: carencia_dias_padrao
```

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/efetivar-troca-titularidade/index.ts` | **NOVO** — Lógica centralizada de efetivação |
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Chamar `efetivar-troca-titularidade` no Cenário A; salvar `solicitacao_id` no serviço do Cenário B |
| `supabase/functions/processar-vistoria/index.ts` | Detectar vistoria de troca de titularidade e disparar efetivação |
| Migration SQL | Adicionar `solicitacao_id` em `servicos`; adicionar config `carencia_troca_titularidade_cenario_a` |

## O que NÃO muda

- Lógica de determinação Cenário A/B (já funciona)
- WhatsApp de notificação (já funciona)
- Pontuação do consultor (já funciona, será mantida)
- Estrutura das tabelas `contratos`, `associados`, `veiculos` (apenas dados)

