

## Diagnóstico: Por que o retry não resolve o problema do Marcus Vinicius

### O que está acontecendo (cadeia de falha)

```text
Retry #1,2,3 → sga-hinova-sync
  ↓
Lê associados.codigo_hinova = 29403 (gravado por recovery anterior)
  ↓
Pula toda busca por CPF (linha 668-670: "já tem código, não precisa buscar")
  ↓
Envia POST /veiculo/cadastrar com codigo_associado: 29403
  ↓
Hinova rejeita: "O associado de código 29403 NÃO está cadastrado no sistema"
  ↓
Função interpreta como "placa duplicada" (status 406) → não recupera veículo
  ↓
Volta para fila → próximo retry em 10min → MESMO erro infinitamente
```

### 3 problemas raiz identificados

1. **Código inválido persistido**: O `codigo_associado: 29403` foi recuperado via "logs_identidade" de um cadastro anterior, mas pertence a um `codigo_conta` diferente (conta 1 vs conta 2). Uma vez gravado em `associados.codigo_hinova`, toda retry o reutiliza sem validar.

2. **Sem invalidação**: Quando Hinova diz "associado de código X não está cadastrado", a função trata como erro genérico de veículo, mas NUNCA limpa o `codigo_hinova` inválido para tentar recadastrar o associado.

3. **`codigo_conta` instável**: Os Hinova secrets NÃO estão configurados (`hinova: configurado: false`). A função infere `codigo_conta` do histórico de logs, que pode retornar valores inconsistentes (1 numa tentativa, 2 noutra).

### Plano de correção

**Arquivo: `supabase/functions/sga-hinova-sync/index.ts`**

1. **Detectar "associado não cadastrado" no passo de veículo** (linhas ~1173-1190):
   - Se o erro do `cadastrar_veiculo` contém "associado de código X não está cadastrado":
     - Limpar `associados.codigo_hinova` e `sincronizado_hinova` no banco
     - Atualizar a fila com `etapa_parou: 'associado'` (para o retry recomeçar do zero)
     - Logar ação `invalidar_codigo_associado` para rastreabilidade

2. **Validar `codigo_conta` compatível ao reusar código do banco** (linha ~668):
   - Antes de aceitar `associado.codigo_hinova`, verificar se o último log de sucesso daquele código usou o MESMO `codigo_conta` atual
   - Se incompatível, descartar e refazer a busca por CPF

3. **Na recovery por logs_identidade** (linhas ~928-929):
   - Tornar a validação de `codigo_conta` obrigatória (não opcional)
   - Se `codigoContaResolvido` mudou desde o log original, rejeitar o match

### Resultado esperado

- Retry #4 detecta que `29403` é inválido → limpa → refaz cadastro do associado com `codigo_conta` correto → registra veículo com sucesso
- Futuros casos com código inválido se auto-corrigem em vez de loop infinito

