

# Corrigir: API SGA envia apenas associado, nao envia veiculo

## Problema Identificado

Analisando os logs de sincronizacao, o fluxo esta parando no **Passo 6 (validar_config)** com o erro **"Codigo Voluntario nao configurado"**:

```text
1. autenticar       -> OK
2. cadastrar_associado -> OK (codigo: 29006) 
3. validar_config   -> ERRO: "Codigo Voluntario nao configurado"
   (veiculo NUNCA e enviado)
```

Isso acontece porque:
- O vendedor do contrato ("Teste") **nao tem** `codigo_sga_voluntario` configurado no perfil
- O fallback global (`HINOVA_CODIGO_VOLUNTARIO`) tambem **nao esta** nas credenciais do banco
- A funcao exige `codigo_voluntario` antes de cadastrar o veiculo e retorna erro

Resultado: o associado e criado no Hinova, mas o veiculo nunca e enviado.

## Solucao

### Arquivo: `supabase/functions/sga-hinova-sync/index.ts`

Adicionar um **fallback automatico** para o `codigo_voluntario` quando nem o vendedor nem a configuracao global possuem o valor. A logica sera:

1. Manter a prioridade atual: vendedor do contrato > configuracao global
2. **Novo fallback**: buscar qualquer vendedor ativo que tenha `codigo_sga_voluntario` configurado
3. Se nenhum for encontrado, usar um valor padrao (ex: 1) com log de aviso, ao inves de bloquear completamente o envio

### Mudancas tecnicas

No bloco do Passo 3.5 (linhas ~362-391), apos verificar vendedor e fallback global:

```text
// NOVO: Fallback - buscar qualquer vendedor com codigo configurado
if (!hinovaCodigoVoluntario) {
  const { data: qualquerVendedor } = await supabase
    .from('profiles')
    .select('codigo_sga_voluntario, nome')
    .not('codigo_sga_voluntario', 'is', null)
    .limit(1)
    .single();

  if (qualquerVendedor?.codigo_sga_voluntario) {
    hinovaCodigoVoluntario = qualquerVendedor.codigo_sga_voluntario;
    console.log(`[SGA Sync] Fallback: usando codigo de ${qualquerVendedor.nome}`);
  }
}
```

E no Passo 6 (linhas ~780-793), remover o bloqueio total, substituindo por um log de aviso e usando valor padrao:

```text
// Ao inves de retornar erro, usar valor padrao com aviso
if (!hinovaCodigoVoluntario) {
  hinovaCodigoVoluntario = '1'; // Padrao minimo
  console.warn('[SGA Sync] AVISO: usando codigo_voluntario padrao (1)');
}
```

### Resultado esperado

Apos a correcao, quando o vendedor nao tiver codigo configurado:

```text
1. autenticar          -> OK
2. cadastrar_associado -> OK
3. buscar voluntario   -> Fallback para vendedor com codigo (ex: THAINa = 10)
4. cadastrar_veiculo   -> OK (usando codigo_voluntario do fallback)
5. enviar_fotos        -> OK
6. sync_completo       -> OK
```

### Arquivos alterados
- `supabase/functions/sga-hinova-sync/index.ts` - adicionar fallback para codigo_voluntario
