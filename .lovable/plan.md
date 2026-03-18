

## Plano: Remover validação local de CPF que bloqueia geração de PIX

### Causa raiz
A Edge Function `asaas-cobranca-adesao` possui uma validação local de dígitos verificadores do CPF (linhas 136-151) que foi adicionada anteriormente. Se o CPF armazenado no banco de dados tiver dígitos verificadores incorretos, a função **bloqueia completamente** a criação da cobrança antes mesmo de tentar chamar a API do Asaas.

O problema é que isso impede qualquer pagamento para associados cujo CPF cadastrado tenha inconsistência nos dígitos verificadores — situação comum em dados migrados ou digitados incorretamente.

### Solução
Remover a validação hard-block local e deixar o Asaas validar o CPF no seu lado. Se o Asaas rejeitar, o erro da API será propagado. Manter apenas a sanitização (remoção de caracteres não numéricos e padding) que já existe e funciona.

### Alteração

**`supabase/functions/asaas-cobranca-adesao/index.ts`**
- Remover o bloco de validação de dígitos verificadores (linhas 136-151) que retorna erro 400
- Manter um `console.warn` caso o CPF não passe na validação, para rastreabilidade, mas sem bloquear o fluxo
- Manter toda a sanitização existente (`.replace(/\D/g, '')`, padding, validação de comprimento)

### Resultado
A geração de PIX/cobrança de adesão não será mais bloqueada por CPFs com dígitos verificadores incorretos. O Asaas fará sua própria validação e, se aceitar o CPF, o pagamento será processado normalmente.

