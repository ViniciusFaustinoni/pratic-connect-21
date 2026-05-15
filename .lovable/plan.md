## Mudança

Trocar a foto **1** da autovistoria de **"Frente — placa centralizada"** para **"Motor"**, mantendo:

- Foto 2: **Chassi** (inalterada)
- Vídeo 360° terminando no **painel ligado** (inalterado)
- Total continua **3 itens** (badge "0/3 itens")

## Arquivo único alterado

`src/data/autovistoriaConfig.ts`

### 1. Carro — `fotosCarro[0]`
Substituir o objeto `frente_centro` por:
```ts
{
  id: 'motor',
  label: 'Motor',
  descricao: 'Foto do compartimento do motor com o capô aberto.',
  ordem: 1,
  categoria: 'identificacao',
  instrucoes: [
    'Abra o capô e estabilize-o',
    'Enquadre todo o compartimento do motor',
    'Garanta boa iluminação — use flash se necessário',
  ],
  evitar: [
    'Foto parcial mostrando só uma parte do motor',
    'Capô fechando ou atrapalhando o enquadramento',
    'Sombras fortes sobre o bloco',
  ],
  dicaExtra: 'O motor é usado para confirmar o estado de conservação do veículo.',
}
```

### 2. Moto — `fotosMoto[0]`
Substituir por:
```ts
{
  id: 'motor',
  label: 'Motor da moto',
  descricao: 'Foto lateral do bloco do motor da moto.',
  ordem: 1,
  categoria: 'identificacao',
  instrucoes: [
    'Posicione-se ao lado da moto',
    'Enquadre o bloco do motor por inteiro',
    'Use boa iluminação',
  ],
  evitar: [
    'Foto desfocada ou muito de longe',
    'Sujeira excessiva escondendo o bloco',
  ],
}
```

### 3. Remover OCR de placa da autovistoria
- `FOTOS_VALIDAR_PLACA = []` (array vazio — preserva o símbolo para imports existentes)
- Remover `validaPlaca: true` das duas fotos

## Impacto colateral verificado

- `vistoriaSubFipeAdapter.ts` consome via `getFotosByTipoVeiculo` (config completa 31/15) — **não afetado**.
- `AutovistoriaCotacao.tsx` chama `getFotosAutovistoria` e segue o array — **adapta automaticamente**.
- `isFotoComValidacaoPlaca` continua existindo, mas passa a retornar `false` para tudo — sem callers quebrados.
- Validação de placa do veículo passa a depender só do CRLV/cadastro (decisão do usuário).

## Memória a atualizar

`mem://logic/operations/autovistoria-2-fotos-video-360` e a Core rule:
> "Autovistoria canônica: 2 fotos (`motor` + `chassi`) + vídeo 360° terminando no PAINEL LIGADO (carro/moto ligado)."

## Fora de escopo

- Vídeo 360° já está implementado corretamente (texto "termina no painel ligado", motor funcionando) — nenhuma mudança.
- Tela só mostra os passos 1 e 2 porque o bloco do vídeo só aparece após as 2 fotos enviadas (comportamento atual mantido).
