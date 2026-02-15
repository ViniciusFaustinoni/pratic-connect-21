

# Diferenciar visualmente cards de Sinistro e Assistencia 24h

## Problema

Na pagina de Solicitacoes IA, os cards de Sinistro e Assistencia 24h usam a mesma cor de borda lateral (amber/amarelo), dificultando a identificacao rapida do tipo.

## Solucao

Alterar o componente `SolicitacoesIA.tsx` para aplicar cores diferentes na borda lateral e no fundo do card conforme o tipo:

- **Sinistro**: borda vermelha (`border-l-red-500`) e fundo sutil vermelho
- **Assistencia 24h**: borda azul (`border-l-blue-500`) e fundo sutil azul
- **Cancelamento**: borda laranja (`border-l-orange-500`)
- **Troca de Titularidade**: borda roxa (`border-l-purple-500`)

## Arquivo a modificar

**`src/pages/diretoria/SolicitacoesIA.tsx`**

Na linha ~231-234, substituir a logica de cor fixa `border-l-amber-400` por cores dinamicas baseadas no `solicitacao.tipo`:

```typescript
const borderColorByTipo: Record<string, string> = {
  sinistro: 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10',
  assistencia: 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10',
  cancelamento: 'border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10',
  troca_titularidade: 'border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/10',
};
```

Aplicar no Card:
```typescript
<Card className={cn(
  "transition-all border-l-4",
  borderColorByTipo[solicitacao.tipo] || "border-l-amber-400"
)}>
```

Isso se aplica a todos os status (pendente, aprovado, rejeitado), nao apenas pendentes, para manter a identificacao visual consistente.

