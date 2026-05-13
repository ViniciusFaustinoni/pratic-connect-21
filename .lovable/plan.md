## Objetivo

Na aba de cotação (`CotacaoFormDialog`), o painel da Regra do 1% deve exibir **somente o Estado A (card verde "Elegível à Regra do 1%")** e apenas quando:
1. O diretor habilitou globalmente (`configuracoes.fipe_menor_ativo = true`), e
2. O veículo é **elegível** pelo cálculo (`fipeMenorInfo.elegivel === true && !fipeMenorInfo.bloqueado`).

Em todos os outros casos (bloqueado por restrição comercial, faixa de rastreador, ou simplesmente não-elegível), o painel **não aparece** para o vendedor — sem alertas amarelos, sem mensagens informativas.

## Já existe

- Toggle global `fipe_menor_ativo` ✅
- Cálculo `fipeMenorInfo` com flags `elegivel` / `bloqueado` ✅
- Card verde do Estado A já implementado em `CotacaoFormDialog.tsx:2247-2317` ✅
- Fluxo de aprovação (`aprovacoes_fipe_menor`) ✅

Portanto a implementação é **somente render-only**: remover dois ramos de UI.

## Mudança

Arquivo único: **`src/components/cotacoes/CotacaoFormDialog.tsx`** (linhas 2233–2329)

Remover:
- **Estado C** (linhas 2237–2244) — Alert amber "Regra do 1% indisponível"
- **Estado B** (linhas 2320–2327) — Alert "Regra do 1% não se aplica"

Manter apenas o **Estado A** (card verde com checkbox "Solicitar FIPE Menor" + textarea de justificativa).

A condição de wrapper passa de:
```tsx
{fipeMenorAtivo && fipeMenorInfo && ( ... três estados ... )}
```
para:
```tsx
{fipeMenorAtivo
  && fipeMenorInfo?.elegivel
  && !fipeMenorInfo?.bloqueado
  && fipeMenorInfo.faixaAtual
  && fipeMenorInfo.faixaInferior && (
   <Card> ... Estado A ... </Card>
)}
```

## Fora de escopo (não mexer)

- Lógica de `fipeMenorInfo` (cálculo, bloqueios por tipo, faixa rastreador) — mantida intacta
- Bug do limite mínimo por tipo (carro 30k / moto 9k) reportado anteriormente — **não corrigir agora** (você pediu apenas para mostrar o card; posso abrir tarefa separada se quiser)
- Telas de aprovação `/diretoria/reducao-cota` e `/vendas/aprovacoes-fipe-menor` — não alteradas
- Painel de configuração do diretor (toggle e limites) — não alterado

## Resultado visual

| Cenário | Antes | Depois |
|---|---|---|
| Diretor desabilitou | nada | nada |
| Habilitado + elegível | card verde | card verde |
| Habilitado + bloqueado (blindado/100%/faixa rastreador/limite tipo) | alert amber | **nada** |
| Habilitado + não-elegível (FIPE−1% continua na mesma faixa) | alert info | **nada** |
| FIPE ≤ limite mínimo | nada (já era) | nada |
