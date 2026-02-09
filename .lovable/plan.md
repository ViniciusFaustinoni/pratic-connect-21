
# Corrigir Fotos, Video e Preview na Tela de Retirada

## Causa Raiz Identificada

O bucket `vistorias` no Supabase Storage esta configurado como **privado** (`public: false`). O codigo usa `getPublicUrl()` para gerar URLs das fotos e video apos upload, mas essas URLs so funcionam para buckets publicos. Resultado:

- **Fotos**: Aparecem como icones quebrados com checkmark verde (o upload funcionou, mas a URL nao carrega a imagem)
- **Video 360**: Player preto mostrando 0:00 (URL inacessivel)
- **Preview**: As imagens locais (Object URL) sao substituidas pela URL publica quebrada

## Solucao

Substituir `getPublicUrl()` por `createSignedUrl()` em todos os uploads da `ExecutarRetirada.tsx`. URLs assinadas funcionam com buckets privados e expiram apos um tempo configuravel.

### Arquivo: `src/pages/instalador/ExecutarRetirada.tsx`

**1. Upload de foto (linhas 254-273)** - Trocar `getPublicUrl` por `createSignedUrl`:

```typescript
// De:
const { data: { publicUrl } } = supabase.storage.from('vistorias').getPublicUrl(fileName);
setFotosEnviadas(prev => ({ ...prev, [tipo]: publicUrl }));

// Para:
const { data: signedData } = await supabase.storage.from('vistorias').createSignedUrl(fileName, 3600);
if (signedData?.signedUrl) {
  setFotosEnviadas(prev => ({ ...prev, [tipo]: signedData.signedUrl }));
}
```

**2. Upload de video (linhas 276-293)** - Mesma mudanca:

```typescript
// De:
const { data: { publicUrl } } = supabase.storage.from('vistorias').getPublicUrl(fileName);
setVideoUrl(publicUrl);

// Para:
const { data: signedData } = await supabase.storage.from('vistorias').createSignedUrl(fileName, 3600);
if (signedData?.signedUrl) {
  setVideoUrl(signedData.signedUrl);
}
```

**3. Upload de assinatura (linhas 297-311)** - Mesma mudanca:

```typescript
// De:
const { data: { publicUrl } } = supabase.storage.from('vistorias').getPublicUrl(fileName);
setAssinaturaUrl(publicUrl);

// Para:
const { data: signedData } = await supabase.storage.from('vistorias').createSignedUrl(fileName, 3600);
if (signedData?.signedUrl) {
  setAssinaturaUrl(signedData.signedUrl);
}
```

## Sobre a Cor do Veiculo

A cor `VERMELHA` esta corretamente armazenada no banco de dados para o veiculo `LTB4J74` e esta sendo exibida na interface. Se a cor real do veiculo for diferente, o problema esta na origem dos dados (cadastro manual ou OCR do CRLV), nao na tela de retirada. A conferencia de dados funciona corretamente: ela mostra o que esta no banco para o tecnico confirmar visualmente.

## Resultado Esperado

- Fotos da retirada aparecerao corretamente apos captura
- Video 360 sera reproduzivel no player
- Assinatura sera exibida apos captura
- URLs assinadas tem validade de 1 hora (suficiente para a sessao de trabalho)
