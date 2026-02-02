
# Plano: Corrigir Sincronização SGA - Endpoint de Consulta por CPF Inválido

## Diagnóstico Completo

### O Problema
Quando o analista conclui a aprovação, o sistema tenta enviar o veículo para o SGA Hinova, mas falha porque:

1. **O associado já existe no SGA** (código 28779) - foi cadastrado anteriormente
2. **O endpoint de busca por CPF está incorreto**:
   - Endpoint usado: `/associado/consultar/cpf/{cpf}`
   - Resposta da API: `"Endpoint não encontrado"`

### Fluxo Atual (com erro)
```text
1. Aprovar proposta
2. Tentar cadastrar associado no SGA
   └─► Erro: "CPF já existe" (correto, ele já foi cadastrado antes)
3. Tentar buscar codigo_associado pelo CPF
   └─► Erro: "Endpoint não encontrado" (endpoint incorreto!)
4. FALHA - não consegue continuar
```

### Logs Encontrados

| Etapa | Status | Resposta |
|-------|--------|----------|
| Autenticar | Sucesso | OK |
| Cadastrar Associado | Erro | CPF já existe |
| Buscar CPF existente | Erro | **Endpoint não encontrado** |

---

## Solução Proposta

### Parte 1: Usar Código Armazenado Localmente (Fallback)

Antes de tentar buscar na API, verificar se temos o código armazenado no banco de sincronizações anteriores.

### Parte 2: Corrigir Endpoint de Consulta

A API Hinova SGA v2 usa endpoints diferentes. Vou implementar uma estratégia de fallback com múltiplos endpoints possíveis:

1. `POST /associado/consultar` com body `{ cpf: "xxx" }` (método mais comum em APIs REST)
2. `GET /associado?cpf=xxx` (query parameter)
3. `GET /associados/cpf/{cpf}` (rota alternativa)

### Parte 3: Recuperar Código de Logs Anteriores

Se todos os endpoints falharem, buscar o código do associado em logs de sincronização anteriores bem-sucedidas.

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/sga-hinova-sync/index.ts` | **MODIFICAR** | Corrigir lógica de busca por CPF existente |

---

## Detalhes Técnicos

### Nova Lógica de Busca (fallback múltiplo)

```typescript
// ESTRATÉGIA 1: Buscar código em logs anteriores
const { data: logAnterior } = await supabase
  .from('sga_sync_logs')
  .select('response_payload')
  .eq('action', 'cadastrar_associado')
  .eq('status', 'success')
  .ilike('request_payload::text', `%${cleanCPF(associado.cpf)}%`)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (logAnterior?.response_payload?.codigo_associado) {
  codigoAssociadoHinova = logAnterior.response_payload.codigo_associado;
  console.log(`[SGA Sync] Código recuperado de log anterior: ${codigoAssociadoHinova}`);
} else {
  // ESTRATÉGIA 2: Tentar endpoint POST /associado/consultar
  const buscaResponse = await fetchWithRetry(
    `${hinovaApiUrl}/associado/consultar`,
    {
      method: 'POST',
      headers: operationHeaders,
      body: JSON.stringify({ cpf: buscaCpf })
    }
  );
  
  // Se POST falhar, tentar GET com query param
  if (!buscaResponse.ok) {
    const buscaResponse2 = await fetchWithRetry(
      `${hinovaApiUrl}/associado?cpf=${buscaCpf}`,
      { method: 'GET', headers: operationHeaders }
    );
    // ...
  }
}
```

### Correção Imediata para Caso Atual

Para desbloquear o Marcus Vinicius imediatamente, executar:

```sql
-- Atualizar associado com código já existente no SGA
UPDATE associados 
SET codigo_hinova = 28779,
    sincronizado_hinova = true,
    sincronizado_hinova_em = NOW()
WHERE id = '3bab27b4-24de-48cd-8d75-758629509825';

-- Resetar status do veículo para tentar novamente
UPDATE veiculos 
SET status_sga = 'pendente'
WHERE id = '9dba80a3-a344-4290-9643-b00689d01d7d';
```

---

## Fluxo Corrigido

```text
1. Aprovar proposta
2. Verificar se associado tem codigo_hinova local
   └─► SIM: Usar código existente → Pular para etapa 5
   └─► NÃO: Continuar
3. Tentar cadastrar associado no SGA
   └─► Sucesso: Salvar código → Continuar etapa 5
   └─► Erro CPF existe: Continuar etapa 4
4. Recuperar código do CPF existente
   4a. Buscar em logs anteriores
   4b. Tentar POST /associado/consultar
   4c. Tentar GET /associado?cpf=xxx
   └─► Sucesso: Salvar código → Continuar
5. Validar RENAVAM/CHASSI
6. Cadastrar veículo no SGA
7. Enviar fotos
8. Finalizar com sucesso
```

---

## Benefícios

1. **Recuperação automática** de códigos já cadastrados
2. **Múltiplas estratégias de fallback** para APIs inconsistentes
3. **Uso de logs históricos** como fonte de verdade
4. **Não depende de endpoint específico** que pode não existir

---

## Ação Imediata

Executar SQL para corrigir o caso atual do Marcus Vinicius e permitir que a sincronização continue.
