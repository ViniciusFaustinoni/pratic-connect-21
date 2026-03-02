
# Correcao: Instalador nao volta para tela principal apos imprevisto

## Diagnostico

O fluxo de imprevisto segue estas etapas:
1. Instalador clica "Comunicar Imprevisto" (modal `ImprevistoBotao`)
2. Seleciona motivo e clica "Registrar Imprevisto"
3. Abre o Duplo Check (`DuploCheckImprevisto`) -- contato com associado
4. Confirma duplo check -- tela de sucesso por 4 segundos
5. Timer fecha o dialog e invalida cache

O problema esta no passo 5: o componente `DuploCheckImprevisto` apenas fecha o dialog (`onOpenChange(false)`) e invalida `tarefa-atual`, mas **nao navega** o instalador de volta para `/instalador`. Ele fica preso na pagina de execucao (ex: `/instalador/checklist/:id`).

## Correcao

### Arquivo: `src/components/vistoriador/DuploCheckImprevisto.tsx`

Adicionar `useNavigate` do react-router-dom e, no callback do timer de sucesso (linha 69-72), alem de fechar o dialog e invalidar cache, chamar `navigate('/instalador')` para levar o instalador de volta a tela principal.

```
// Antes (linha 69-72):
const timer = setTimeout(() => {
  onOpenChange(false);
  queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
}, 4000);

// Depois:
const timer = setTimeout(() => {
  onOpenChange(false);
  queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
  navigate('/instalador');
}, 4000);
```

Apenas 1 arquivo editado. Nenhuma migration necessaria.
