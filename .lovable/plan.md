
# Correção do Veículo e Envio ao SGA

## Dados Extraídos do CRLV Enviado

| Campo | Valor Extraído |
|-------|----------------|
| **CHASSI** | `9BRBD48E6E2617010` |
| **RENAVAM** | `00543591115` |
| **MOTOR** | `M155966` |
| **PLACA** | `LTB4J74` (já correto no sistema) |

## Situação Atual do Veículo

| Campo | Valor no Sistema | Status |
|-------|------------------|--------|
| CHASSI | `null` | ❌ Não preenchido |
| RENAVAM | `null` | ❌ Não preenchido |
| status_sga | `erro_sincronizacao` | ⚠️ Falhou anteriormente |

---

## Ações a Executar

### 1. Atualizar Veículo no Banco
Executar UPDATE para preencher os dados faltantes:

```sql
UPDATE veiculos 
SET 
  chassi = '9BRBD48E6E2617010',
  renavam = '00543591115',
  status_sga = 'pendente'
WHERE id = 'f6c176c6-15ef-4868-9178-573d0d4961a5';
```

### 2. Chamar Edge Function para Enviar Apenas o Veículo
Como o associado já existe no SGA (codigo_associado: **28780**), será necessário:

1. Chamar a edge function `sga-hinova-sync` com modo especial para enviar apenas o veículo
2. OU usar diretamente o endpoint `/veiculo/cadastrar` da API Hinova

---

## Detalhes Técnicos

### Veículo ID
`f6c176c6-15ef-4868-9178-573d0d4961a5`

### Associado no SGA
O associado **MARCUS VINICIUS FAUSTINONI DE FREITAS** já está cadastrado no SGA com código **28780**.

### Payload para API Hinova `/veiculo/cadastrar`

```json
{
  "codigo_associado": 28780,
  "placa": "LTB4J74",
  "chassi": "9BRBD48E6E2617010",
  "renavam": "00543591115",
  "numero_motor": "M155966",
  "ano_fabricacao": 2013,
  "ano_modelo": 2014,
  "codigo_tipo_veiculo": 1,
  "codigo_combustivel": 3,
  "codigo_cor": 6,
  "dia_vencimento": 10,
  "kilometragem": 0,
  "codigo_voluntario": [configurado]
}
```

---

## Arquivos a Modificar

| Tipo | Ação |
|------|------|
| Banco de dados | UPDATE do veículo com chassi e renavam |
| Edge Function `sga-hinova-sync` | Verificar se precisa ajuste para reenvio de veículo quando associado já existe |

---

## Fluxo de Reenvio

```
1. Atualizar veículo no banco
         │
         ▼
2. Verificar se associado já tem codigo_hinova
         │
         ▼
3. Se sim, usar codigo_associado existente
         │
         ▼
4. Chamar API Hinova /veiculo/cadastrar
         │
         ▼
5. Salvar codigo_veiculo_hinova no banco
         │
         ▼
6. Marcar sincronizado_hinova = true ✓
```
