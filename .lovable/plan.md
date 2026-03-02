

# Fix: Botao "Proximo" nao funciona no mobile com itens NOK

## Diagnostico

O codigo nao tem NENHUMA logica especifica de mobile/desktop -- o mesmo JavaScript roda em ambos. As causas mais provaveis no mobile sao:

1. **Botao desabilitado silenciosamente**: O `disabled:opacity-50` sobre `bg-blue-600` em fundo escuro e quase imperceptivel no mobile. O usuario acha que o botao esta ativo, mas ele esta disabled porque nem todos os itens foram marcados (precisa rolar para ver todos)
2. **Sem feedback ao usuario**: Quando o botao esta disabled, nada acontece -- nenhum toast, nenhuma mensagem explicando o que falta
3. **Dialog pode nao ser visivel**: No mobile, o Dialog pode ficar atras de outros elementos

## Correcao (3 mudancas no mesmo arquivo)

### Arquivo: `src/pages/instalador/InstaladorChecklist.tsx`

**1. Adicionar contador de progresso do checklist na etapa 2**

Mostrar "X de Y itens verificados" acima da lista para o usuario saber quantos faltam. Usar os valores de `checklist` e `checklistItems` ja disponiveis:

```typescript
// Na etapa 2, logo antes dos items do checklist
const itensVerificados = checklistItems.filter(item => 
  checklist[item.id]?.status === 'ok' || checklist[item.id]?.status === 'nok'
).length;
```

Renderizar badge: `{itensVerificados}/{checklistItems.length} verificados`

**2. Substituir button disabled por handler com toast**

Em vez de desabilitar o botao silenciosamente, SEMPRE permitir o clique e mostrar um toast explicativo quando nao puder avancar:

```typescript
// Antes (botao desabilitado silenciosamente):
<Button
  onClick={avancar}
  disabled={!podeAvancar()}
  className="flex-1 bg-blue-600 ..."
>

// Depois (botao sempre clicavel, com feedback):
<Button
  onClick={() => {
    if (!podeAvancar()) {
      // Feedback explicativo
      if (etapaAtual === 2 && !checklistCompleto) {
        const faltam = checklistItems.filter(item => 
          checklist[item.id]?.status === 'pendente' || !checklist[item.id]
        ).length;
        toast.error(`Marque todos os itens do checklist (${faltam} pendente${faltam > 1 ? 's' : ''})`);
      } else {
        toast.error('Complete todos os campos obrigatórios para avançar');
      }
      return;
    }
    avancar();
  }}
  className="flex-1 bg-blue-600 hover:bg-blue-700"
>
```

Isso elimina o `disabled` que causa confusao visual no mobile e da feedback claro ao usuario.

**3. Garantir Dialog mobile-friendly**

Adicionar classes ao DialogContent do dialog de confirmacao NOK para funcionar melhor no mobile:

```typescript
// Antes:
<DialogContent className="max-w-md">

// Depois:
<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md z-[1200]">
```

## Resultado

- Instalador sempre pode clicar "Proximo" -- se faltar algo, recebe toast explicando o que falta
- Contador de progresso mostra quantos itens foram verificados
- Dialog de confirmacao NOK aparece corretamente em qualquer tamanho de tela
- Zero possibilidade de botao "travado" sem feedback

Apenas 1 arquivo editado. Nenhuma migration necessaria.
