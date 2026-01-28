
# Plano: Ajuste de Comunicação Pós-Autovistoria

## Problema

O componente `EscolhaLocalVistoria.tsx` exibe textos que mencionam "vistoria" quando, na verdade, a autovistoria já foi realizada. Neste ponto do fluxo, o cliente está escolhendo onde será feita a **instalação do rastreador**.

## Textos a Alterar

| Linha | Texto Atual | Novo Texto |
|-------|-------------|------------|
| 25 | "Onde deseja realizar a vistoria?" | "Onde deseja realizar a instalação do rastreador?" |
| 48 | "Um vistoriador irá ao seu endereço para realizar a vistoria do veículo" | "Um técnico irá ao seu endereço para realizar a instalação do rastreador" |
| 74 | "Leve seu veículo à nossa sede para realizar a vistoria no local" | "Leve seu veículo à nossa sede para realizar a instalação no local" |
| 110 | "Após escolher o local, você poderá selecionar o melhor horário para a vistoria" | "Após escolher o local, você poderá selecionar o melhor horário para a instalação" |

## Arquivo a Modificar

`src/components/cotacao-publica/EscolhaLocalVistoria.tsx`

## Alterações Detalhadas

### Título principal (linha 25)
```tsx
// De:
<h2 className="text-xl font-semibold">Onde deseja realizar a vistoria?</h2>

// Para:
<h2 className="text-xl font-semibold">Onde deseja realizar a instalação do rastreador?</h2>
```

### Descrição opção 1 - Técnico vai até cliente (linha 48)
```tsx
// De:
<p className="text-sm text-muted-foreground">
  Um vistoriador irá ao seu endereço para realizar a vistoria do veículo
</p>

// Para:
<p className="text-sm text-muted-foreground">
  Um técnico irá ao seu endereço para realizar a instalação do rastreador
</p>
```

### Descrição opção 2 - Cliente vai até base (linha 74)
```tsx
// De:
<p className="text-sm text-muted-foreground">
  Leve seu veículo à nossa sede para realizar a vistoria no local
</p>

// Para:
<p className="text-sm text-muted-foreground">
  Leve seu veículo à nossa sede para realizar a instalação no local
</p>
```

### Texto de rodapé (linha 110)
```tsx
// De:
<p className="text-xs text-center text-muted-foreground">
  Após escolher o local, você poderá selecionar o melhor horário para a vistoria
</p>

// Para:
<p className="text-xs text-center text-muted-foreground">
  Após escolher o local, você poderá selecionar o melhor horário para a instalação
</p>
```

## Resultado Esperado

Após as alterações, a tela exibirá mensagens claras indicando que o próximo passo é a instalação do rastreador, eliminando a confusão sobre a vistoria (que já foi concluída via autovistoria).
