## Objetivo
Corrigir a falha persistente ao vincular cotação na troca de titularidade sem alterar a regra de negócio do fluxo.

## Veredito atual
- O recurso para **excluir cotação órfã já existe** e será mantido.
- A evidência aponta para **falha de transporte no cliente/Preview**, não para rejeição da regra de negócio da edge function:
  - o navegador mostra `FunctionsFetchError: Failed to send a request to the Edge Function`;
  - **não há logs** recentes de entrada na edge `vincular-cotacao-troca` para a tentativa com erro;
  - logo em seguida há log normal da edge `delete-cotacao`, excluindo a cotação `652b68d6-2f18-4488-834c-29cb2847a4cb`.
- Isso indica que o rollback está chegando ao backend, mas a chamada de vínculo via `supabase.functions.invoke()` está falhando **antes de atingir a edge**.

## O que vou implementar
### 1) Trocar a chamada crítica de vínculo para fetch direto autenticado
- Substituir no fluxo de troca a chamada `supabase.functions.invoke('vincular-cotacao-troca')` por `fetch` direto em `https://<project>.supabase.co/functions/v1/vincular-cotacao-troca`.
- Enviar `Authorization: Bearer <session.access_token>` e `Content-Type: application/json`.
- Tratar explicitamente:
  - falha HTTP com payload JSON da edge;
  - resposta não-JSON;
  - timeout/AbortError;
  - ausência de sessão autenticada.

### 2) Unificar o transporte das operações críticas do fluxo
- Aplicar o mesmo padrão seguro ao rollback automático com `delete-cotacao`, para evitar mistura de caminhos (`invoke` para uma função e `fetch` para outra).
- Se o vínculo falhar, continuar descartando a cotação automaticamente.

### 3) Melhorar a observabilidade do erro
- Registrar no frontend, com contexto claro:
  - `solicitacao_id`
  - `cotacao_id`
  - URL chamada
  - status HTTP
  - corpo retornado
  - tipo da falha (`transporte`, `negócio`, `rollback`)
- Ajustar a mensagem ao operador quando for falha de transporte, diferenciando de casos como `JA_VINCULADA`, `COTACAO_NAO_PERTENCE` e `TERMO_NAO_ASSINADO`.

### 4) Validar nos dois ambientes relevantes
- Testar no **Preview** para verificar se o erro deixou de ocorrer.
- Testar no **publicado/custom domain** para confirmar que o fluxo também funciona fora do proxy do Preview.
- Confirmar que, em caso de falha real, a cotação não fica órfã.

## Arquivos previstos
- `src/components/cotacoes/CotacaoFormDialog.tsx`
- possivelmente um helper utilitário pequeno para chamada autenticada de edge function no frontend, se fizer sentido reaproveitar

## Sem mudanças de banco
- Não há sinal de necessidade de migration ou ajuste de RLS para esta correção.
- A edge `vincular-cotacao-troca` já está adequada para a regra atual; o problema está no caminho de chamada.

## Detalhes técnicos
```text
Fluxo corrigido:
cria cotação -> fetch direto /functions/v1/vincular-cotacao-troca
  -> sucesso: navega normalmente
  -> falha: classifica erro -> rollback via fetch direto /functions/v1/delete-cotacao
```

## Resultado esperado
- O vínculo da troca deixa de falhar por `FunctionsFetchError` nesse ponto crítico.
- Quando houver erro real de negócio, a mensagem fica precisa.
- Quando houver falha, a cotação continua sendo limpa automaticamente, sem sobras órfãs.