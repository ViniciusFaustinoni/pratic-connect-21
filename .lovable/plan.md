

# Correção: SGA Hinova não popula dados (associado nem veículo)

## Causa raiz identificada

Os logs mostram uma contradição na API Hinova:

1. **Busca por CPF** → 406 (não encontrado)
2. **Cadastrar associado** → 406 (CPF já existe)
3. **Recovery busca** → 406 de novo (mesmo endpoint, mesmo resultado)

O problema está no **formato do CPF na busca**. O código usa `formatCPF` (com pontuação: `123.456.789-00`) no endpoint de busca, mas `cleanCPF` (só números: `12345678900`) no cadastro. A API Hinova provavelmente espera CPF sem formatação na URL de busca.

Além disso, o código não loga o corpo da resposta 406, dificultando diagnóstico futuro.

## Alterações em `supabase/functions/sga-hinova-sync/index.ts`

### 1. Busca inicial por CPF — usar CPF limpo (sem pontuação)

Linhas ~573-576: Trocar `formatCPF` por `cleanCPF` na URL de busca:
```typescript
// ANTES
const cpfFormatado = formatCPF(associado.cpf);
const buscaBackupResponse = await fetchWithRetry(
  `${hinovaApiUrl}/associado/buscar/${encodeURIComponent(cpfFormatado)}/cpf`,

// DEPOIS
const cpfLimpo = cleanCPF(associado.cpf);
const buscaBackupResponse = await fetchWithRetry(
  `${hinovaApiUrl}/associado/buscar/${cpfLimpo}/cpf`,
```

### 2. Recovery busca após CPF duplicado — mesma correção

Linhas ~750-753: Trocar `formatCPF` por `cleanCPF`:
```typescript
// ANTES
const cpfFormatado = formatCPF(associado.cpf);
// DEPOIS
const cpfLimpo = cleanCPF(associado.cpf);
```

### 3. Busca de veículo via associado (recovery) — mesma correção

Linhas ~947-949: Trocar `formatCPF` por `cleanCPF`.

### 4. Adicionar log do corpo da resposta 406

Após `safeJsonParse` nas chamadas de cadastro (associado e veículo), logar o corpo completo quando status != 200:
```typescript
if (!associadoResponse.ok) {
  console.log(`[SGA Sync] Resposta cadastrar_associado (${associadoResponse.status}):`, JSON.stringify(associadoData));
}
```
Idem para `veiculoResponse`.

### 5. Fallback: tentar busca com CPF formatado se limpo falhar

Na busca inicial e na recovery, se a busca com CPF limpo retornar 406, tentar com CPF formatado como fallback:
```typescript
if (!buscaBackupResponse.ok) {
  // Fallback: tentar com CPF formatado
  const cpfFormatado = formatCPF(associado.cpf);
  buscaBackupResponse = await fetchWithRetry(
    `${hinovaApiUrl}/associado/buscar/${encodeURIComponent(cpfFormatado)}/cpf`,
    { method: 'GET', headers: operationHeaders }
  );
}
```

## Resultado esperado
- Busca por CPF encontra o associado existente no Hinova
- Cadastro procede normalmente (novo) ou recupera código (existente)
- Veículo é cadastrado em seguida
- Logs detalhados facilitam diagnóstico de erros futuros

