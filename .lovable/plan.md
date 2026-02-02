
# Plano: Corrigir Incompatibilidade de Criptografia entre Componentes

## Problema Identificado

Há uma **incompatibilidade crítica** entre os métodos de criptografia usados em dois arquivos diferentes:

| Arquivo | Formato de Criptografia | Derivação de Chave |
|---------|------------------------|---------------------|
| `integracoes-credenciais/index.ts` | Base64 separado (`encrypted`, `iv`) | PBKDF2 com salt fixo |
| `_shared/credenciais-hibridas.ts` | Hex concatenado (`IV:ciphertext`) | Chave direta (truncada/padding) |

**Resultado**: Quando o diretor salva credenciais via interface, elas são gravadas no banco usando o formato do `integracoes-credenciais`. Porém, quando o `rastreador-auth` tenta ler, usa o `_shared/credenciais-hibridas.ts` que espera um formato diferente → **falha na descriptografia**.

---

## Situação Atual

1. **Credenciais funcionando agora**: As credenciais estão funcionando porque estão configuradas como ENV (Supabase Secrets), não no banco
2. **Banco vazio para Softruck**: A query `SELECT * FROM integracoes_credenciais WHERE integracao = 'softruck'` retorna vazio
3. **Interface não persiste**: Quando o diretor tenta salvar pela interface, pode estar falhando silenciosamente ou as credenciais são salvas mas não podem ser lidas

---

## Solução: Unificar Método de Criptografia

Atualizar o `_shared/credenciais-hibridas.ts` para usar o **mesmo método** do `integracoes-credenciais/index.ts`:

### Mudanças no `_shared/credenciais-hibridas.ts`

```typescript
// ANTES (formato errado)
async function descriptografar(encryptedData: string, key: string) {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  // ...usa hex e chave direta
}

// DEPOIS (formato correto - igual ao integracoes-credenciais)
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('integracoes_credenciais_salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function descriptografar(encryptedBase64: string, ivBase64: string, secret: string) {
  const key = await deriveKey(secret);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return JSON.parse(new TextDecoder().decode(decrypted));
}
```

### Atualizar busca para incluir campo `iv`

```typescript
// ANTES
const { data: credencial } = await supabase
  .from('integracoes_credenciais')
  .select('credenciais_encrypted, configurado')
  .eq('integracao', 'softruck')
  .maybeSingle();

// DEPOIS
const { data: credencial } = await supabase
  .from('integracoes_credenciais')
  .select('credenciais_encrypted, iv, configurado')
  .eq('integracao', 'softruck')
  .maybeSingle();
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/_shared/credenciais-hibridas.ts` | Usar PBKDF2 + base64 (mesmo método do integracoes-credenciais) |

---

## Resultado Esperado

1. Diretor configura credenciais em **Configurações > Integrações > Softruck**
2. Credenciais são salvas no banco (criptografadas com PBKDF2 + AES-256-GCM)
3. Edge Functions (`rastreador-auth`, `rastreador-posicao`, etc.) conseguem ler e descriptografar
4. Se não houver credenciais no banco, continua usando ENV como fallback

---

## Detalhes Técnicos

### Estrutura do registro no banco
```json
{
  "integracao": "softruck",
  "credenciais_encrypted": "base64_do_ciphertext",
  "iv": "base64_do_iv",
  "configurado": true
}
```

### Fluxo de busca híbrida
```text
getCredenciaisSoftruck(supabase):
  1. SELECT credenciais_encrypted, iv FROM integracoes_credenciais WHERE integracao = 'softruck'
  2. SE encontrou e configurado:
     a. deriveKey(SUPABASE_SERVICE_ROLE_KEY) via PBKDF2
     b. decrypt(encrypted, iv, key) via AES-256-GCM
     c. return JSON.parse(decrypted)
  3. SENÃO:
     a. return { publicKey: Deno.env.get('SOFTRUCK_PUBLIC_KEY'), ... }
```
