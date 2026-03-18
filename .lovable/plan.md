

## Plano: Corrigir erro "CPF/CNPJ inválido" na cobrança de adesão

### Diagnóstico

Os logs mostram que a API do Asaas rejeita o CPF com erro `"O CPF/CNPJ informado é inválido"`. O CPF chega do frontend já sem máscara (`replace(/\D/g, '')`), mas a edge function não faz nenhuma validação ou sanitização adicional antes de enviar ao Asaas. CPFs com formato incorreto (dígitos faltando, zeros extras, etc.) passam direto.

### Arquivo alterado
`supabase/functions/asaas-cobranca-adesao/index.ts`

### Alterações

1. **Sanitizar CPF na edge function**: Após receber `cliente.cpfCnpj`, aplicar `.replace(/\D/g, '')` novamente no servidor (defesa em profundidade) e fazer `.padStart(11, '0')` para CPFs com zeros à esquerda perdidos.

2. **Validar formato antes de chamar Asaas**: Verificar se o CPF tem 11 dígitos (CPF) ou 14 dígitos (CNPJ). Se não tiver, retornar erro 400 com mensagem clara ao invés de deixar o Asaas rejeitar.

3. **Logar o CPF sanitizado** (mascarado para segurança: `***.***.XXX-XX`) para facilitar diagnóstico futuro.

4. **Usar CPF sanitizado na busca** (linha 204): O endpoint `GET /customers?cpfCnpj=` também precisa receber o CPF limpo.

### Detalhes técnicos

Após a linha 84 (`await req.json()`), adicionar:

```typescript
// Sanitizar CPF/CNPJ
let cpfCnpj = (cliente.cpfCnpj || '').replace(/\D/g, '');

// Pad para CPFs que perderam zeros à esquerda
if (cpfCnpj.length > 0 && cpfCnpj.length < 11) {
  cpfCnpj = cpfCnpj.padStart(11, '0');
}

// Validar tamanho
if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
  return new Response(
    JSON.stringify({ success: false, error: `CPF/CNPJ inválido (${cpfCnpj.length} dígitos)` }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

cliente.cpfCnpj = cpfCnpj;
console.log(`[asaas-cobranca-adesao] CPF sanitizado: ***${cpfCnpj.slice(-4)}`);
```

### O que não muda
- Frontend (`EtapaPagamentoCotacao.tsx`) continua igual
- Fluxo de cobrança do admin (`PagamentoAdesao.tsx`) não é alterado
- Nenhuma tabela ou migration necessária

