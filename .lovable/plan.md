## Problema

Na fila `Cadastro › Processos › Troca de Titularidade › Aguardando Cadastro`, a solicitação MARCOS DATIVO → MARCUS FAUSTINONI (Ford Fiesta KOU6D37) aparece com o badge laranja **"Aguardando autovistoria"**, mas como o termo de cancelamento foi assinado hoje (20/05/2026, 15:09 BRT), ela está dentro da **janela mesmo-dia** — autovistoria é dispensada por regra (memória `mem://logic/operations/troca-titularidade-janela-mesmo-dia`).

A lógica do badge em `src/pages/cadastro/ProcessosOperacionais.tsx` (linhas 134-168) só conhece três caminhos:
1. `autovistoria_concluida_em` → "Autovistoria concluída" (verde)
2. `tipo_vistoria === 'agendada_base'` ou agendamento → "Vistoria base agendada/Aguardando vistoria base" (azul)
3. Default → "Aguardando autovistoria" (âmbar) ← caindo aqui indevidamente

Falta o caminho 4: **dentro da janela mesmo-dia BRT** = vistoria dispensada.

## Correção

Em `src/pages/cadastro/ProcessosOperacionais.tsx`, antes do default âmbar, adicionar verificação espelhando o helper já existente em `CotacaoContratacao.tsx` (linhas 245-255):

```ts
// Caminho 3: janela mesmo-dia (termo assinado ainda hoje BRT) → vistoria dispensada
if (s.termo_cancelamento_assinado_em) {
  const a = new Date(s.termo_cancelamento_assinado_em);
  const fimDiaBRTemUTC = new Date(Date.UTC(
    a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(),
    26, 59, 59, 999  // 23:59:59.999 BRT = 02:59 UTC do dia seguinte
  ));
  if (new Date() <= fimDiaBRTemUTC) {
    return (
      <Badge variant="outline" className="text-green-600 border-green-600">
        Vistoria dispensada (mesmo dia)
      </Badge>
    );
  }
}
```

Esse trecho roda **depois** do check de `autovistoria_concluida_em` e do check de vistoria base agendada (para não sobrescrever caminhos que o cliente já escolheu), e **antes** do default. Cobre exatamente o caso da imagem.

## Sem mudanças adicionais

- Não tocar em backend, edge function, trigger ou solicitação no banco.
- Não tocar em `CotacaoContratacao.tsx` — a regra do link público já está correta.
- Não alterar a aba destino (continua em "Aguardando Cadastro"); só o badge muda.

## Pós-implementação

- Memória `mem://logic/operations/troca-titularidade-janela-mesmo-dia` permanece válida; nada a atualizar.

## Arquivos

- `src/pages/cadastro/ProcessosOperacionais.tsx` (1 inserção entre as linhas 161 e 162)
