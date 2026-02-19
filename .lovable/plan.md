
# Corrigir endereço de instalação/manutenção não persistindo o endereço selecionado

## Problema

Quando o usuário seleciona "Outro endereço" no modal de agendamento de manutenção (ou instalação), o sistema **sempre salva o endereço cadastrado do associado** nos campos individuais do serviço (`logradouro`, `numero`, `bairro`, etc.). O endereço digitado pelo usuário é inserido apenas no campo `observacoes` como texto livre, mas nunca nos campos de endereço reais.

Isso significa que rotas, mapas e atribuição por proximidade sempre usam o endereço cadastrado, não o endereço onde o serviço realmente será realizado.

## Causa raiz

**Arquivo:** `src/hooks/useVistoriaManutencao.ts` (função `useAbrirEAgendarManutencao`, linhas 1241-1261)

O código inicializa os campos de endereço com os dados do associado e só os limpa se `localTipo === 'base'`. Quando `localTipo === 'rota'` com endereço alternativo, os campos individuais nunca são sobrescritos:

```text
let logradouro = associado?.logradouro || null;   // <-- sempre pega do associado
let numero = associado?.numero || null;
...
if (params.localTipo === 'base') { ... limpa ... }
// FALTA: if tipoEndereco === 'outro' { usar campos digitados }
```

**Arquivo:** `src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx` (linhas 240-264)

O modal envia `localEndereco` como string formatada (`"Rua X, 123 - Bairro, Cidade/UF"`), mas o hook precisaria receber os campos individuais para salvá-los corretamente.

## Solução

### 1. Expandir a interface `AbrirEAgendarManutencaoParams`

Adicionar campos opcionais de endereço alternativo à interface:

```text
export interface AbrirEAgendarManutencaoParams {
  ...campos existentes...
  // Endereço alternativo (quando o usuário digita outro endereço)
  enderecoAlternativo?: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
}
```

### 2. Usar endereço alternativo no hook

Na função `useAbrirEAgendarManutencao`, após a linha que inicializa com o endereço do associado, adicionar verificação:

```text
// Se endereço alternativo foi fornecido, usar em vez do associado
if (params.enderecoAlternativo) {
  logradouro = params.enderecoAlternativo.logradouro;
  numero = params.enderecoAlternativo.numero;
  bairro = params.enderecoAlternativo.bairro;
  cidade = params.enderecoAlternativo.cidade;
  uf = params.enderecoAlternativo.uf;
  cep = params.enderecoAlternativo.cep;
  latitude = null;  // Será geocodificado depois
  longitude = null;
}
```

### 3. Enviar campos individuais do modal

No `AgendarManutencaoUnificadoModal`, ao chamar `abrirEAgendarMutation.mutateAsync`, incluir `enderecoAlternativo` quando `tipoEndereco === 'outro'`:

```text
await abrirEAgendarMutation.mutateAsync({
  ...campos existentes...
  enderecoAlternativo: tipoEndereco === 'outro' ? {
    logradouro, numero, bairro, cidade, uf, cep
  } : undefined,
});
```

## Arquivos alterados

- `src/hooks/useVistoriaManutencao.ts` - interface + lógica de endereço alternativo
- `src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx` - enviar campos individuais

## Resultado esperado

- Ao selecionar "Outro endereço" e digitar um novo, o serviço será criado com esse endereço nos campos corretos
- Rotas, mapas e atribuição por proximidade usarão o endereço real do serviço
- Selecionar "Endereço cadastrado" continua funcionando como antes
