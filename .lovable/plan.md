
Objetivo: eliminar o 400 da `asaas-cobranca-adesao` e fazer o usuário ver a causa real quando o Asaas recusar o CPF/CNPJ.

Diagnóstico
- O erro atual não é de autenticação da edge function; a função está sendo chamada e retorna 400.
- Os logs da própria função mostram a causa real: `O CPF/CNPJ informado é inválido.`
- O contrato `82ca53f6-3fb2-4fd4-8c92-18919bdda31d` está enviando CPF `126.936.497-37` / `12693649737`.
- A edge function já sanitiza o documento, então o problema agora não é “máscara” nem “token”: é validação/documento rejeitado pelo Asaas.
- No frontend público, o formulário de dados pessoais ainda aceita CPF por regex/formato apenas, sem validar dígitos verificadores. Isso permite chegar até o pagamento com CPF formalmente bem formatado, mas inválido.

Implementação proposta

1. Fortalecer validação no frontend público
- Arquivo: `src/components/cotacao-publica/FormularioDadosPessoais.tsx`
- Trocar a validação atual por validação real de CPF usando a função já existente em `src/lib/validations/index.ts`.
- Resultado: impedir avanço para pagamento quando o CPF estiver só “bem formatado”, mas inválido.

2. Melhorar tratamento de erro HTTP da edge function
- Arquivos:
  - `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx`
  - `src/components/associado/PagamentoAdesao.tsx`
- Hoje, quando a edge function responde 400, o app mostra só `Edge Function returned a non-2xx status code`.
- Ajustar o catch para detectar `FunctionsHttpError`, ler `await error.context.json()`, e exibir a mensagem real retornada pela função.
- Resultado esperado: o usuário verá algo como `CPF/CNPJ inválido` ou outra mensagem amigável, em vez de erro genérico.

3. Endurecer validação no servidor antes do Asaas
- Arquivo: `supabase/functions/asaas-cobranca-adesao/index.ts`
- Além de sanitizar/comprimento, validar de fato CPF/CNPJ no servidor:
  - CPF: validar dígitos verificadores
  - CNPJ: validar dígitos verificadores
- Se inválido:
  - retornar `400` com mensagem clara, sem tentar chamar o Asaas
- Benefício:
  - evita roundtrip desnecessário com API externa
  - dá erro previsível e controlado
  - protege outros pontos que chamem a mesma função

4. Padronizar origem do documento enviado
- Revisar o payload montado em:
  - `EtapaPagamentoCotacao.tsx`
  - `PagamentoAdesao.tsx`
- Garantir uso de `.trim()` e fallback seguro para não enviar `undefined`/string vazia.
- Se o documento estiver ausente, retornar erro claro antes de invocar a função.

5. Mensagem de UX no fluxo de pagamento
- Na etapa pública de pagamento, trocar o estado de erro genérico por mensagem orientativa:
  - “Não foi possível gerar a cobrança porque o CPF/CNPJ informado é inválido. Volte e corrija os dados.”
- Manter botão de tentar novamente, mas com contexto correto.

Detalhes técnicos
- Reaproveitar `validateCPF` / `validateCNPJ` de `src/lib/validations/index.ts` no frontend e espelhar a mesma regra na edge function.
- No catch de `supabase.functions.invoke`, usar o padrão já existente em `CriarContaAssociadoForm.tsx`.
- Não precisa migration nem mudança de tabela.
- O `verify_jwt = false` já está correto para `asaas-cobranca-adesao`; não é a causa aqui.

Resultado esperado
- O usuário não consegue chegar ao pagamento com CPF inválido.
- Se ainda houver documento inválido vindo de registros antigos, a edge function barra localmente com mensagem clara.
- O frontend passa a mostrar a causa real do 400, em vez de `non-2xx status code`.

Validação após implementação
1. Testar com um CPF inválido formatado corretamente e confirmar que o formulário bloqueia antes do pagamento.
2. Testar com registro antigo já salvo com CPF inválido e confirmar que a mensagem real aparece ao tentar gerar cobrança.
3. Testar com CPF válido e confirmar geração normal da cobrança no Asaas.
