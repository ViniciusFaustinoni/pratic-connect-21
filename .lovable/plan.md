
# Condicionar Botao "Enviar para Oficina" a Aprovacao + Cota Paga

## Problema

O botao "Enviar para Oficina" aparece em situacoes incorretas:
1. Na lista de sinistros (`SinistrosList.tsx`), aparece para status `em_analise` e `aprovado`, sem verificar pagamento da cota
2. Na tela de analise (`SinistroAnalise.tsx`), aparece quando status e `aprovado` sem verificar se a cota foi paga
3. O botao "Suspender" nas acoes da tela de analise deve ser substituido por "Enviar para Oficina" quando o sinistro esta aprovado e a cota foi paga
4. Ambos os botoes devem sumir quando o status ja e `em_reparo`

## Alteracoes

### 1. `src/pages/eventos/SinistrosList.tsx` (linha 457)

**Antes:**
```
sinistro.status === 'em_analise' || sinistro.status === 'aprovado'
```

**Depois:**
```
sinistro.status === 'aprovado' && sinistro.cota_paga === true
```

O botao so aparece quando o sinistro esta aprovado E a cota foi paga. Desaparece automaticamente quando o status muda para `em_reparo`.

### 2. `src/pages/eventos/SinistroAnalise.tsx` - Secao de status aprovado (linhas 1390-1396)

Condicionar o botao "Enviar para Oficina" a exibir somente quando `sinistro.cota_paga === true`:

```tsx
{sinistro.cota_paga && (
  <Button className="w-full" onClick={() => setShowEnviarOficina(true)}>
    <Wrench className="h-4 w-4 mr-2" />
    Enviar para Oficina
  </Button>
)}
```

### 3. `src/pages/eventos/SinistroAnalise.tsx` - Grid de acoes (linhas 1529-1575)

Na area de botoes de acao (Sindicancia, Analise Interna, Juridico, Suspender), substituir o botao "Suspender" por "Enviar para Oficina" quando o sinistro esta aprovado e a cota esta paga. A logica:

- Se status e `aprovado` e `cota_paga === true`: mostrar "Enviar para Oficina" no lugar de "Suspender"
- Caso contrario (status permite acoes e nao e em_reparo): manter "Suspender"
- Se status e `em_reparo`: os botoes de acao ja nao aparecem (ja esta na lista de exclusao `statusPermiteAcoes`)

O botao "Enviar para Oficina" substituindo "Suspender" tera estilo verde para diferenciar:

```tsx
{sinistro.status === 'aprovado' && sinistro.cota_paga ? (
  <Button variant="outline" size="sm"
    className="border-teal-300 text-teal-700 hover:bg-teal-50"
    onClick={() => setShowEnviarOficina(true)}>
    <Wrench className="h-3.5 w-3.5 mr-1.5" />
    Enviar para Oficina
  </Button>
) : (
  <Button variant="outline" size="sm"
    className="border-muted-foreground/30 text-muted-foreground hover:bg-muted"
    onClick={() => setShowSuspender(true)}>
    <Clock className="h-3.5 w-3.5 mr-1.5" />
    Suspender
  </Button>
)}
```

## Resumo do comportamento

| Situacao | Lista (Wrench) | Analise - Area Status | Analise - Acoes (Suspender/Oficina) |
|---|---|---|---|
| Aprovado, cota NAO paga | Oculto | Oculto | Suspender |
| Aprovado, cota paga | Visivel | Visivel | Enviar para Oficina |
| Em reparo | Oculto | Msg "Ja encaminhado" | Oculto (statusPermiteAcoes) |
| Outros status | Oculto | N/A | Suspender |

## Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistrosList.tsx` | Condicionar botao Wrench a `aprovado + cota_paga` |
| `src/pages/eventos/SinistroAnalise.tsx` | Condicionar botao na secao aprovado + substituir Suspender por Enviar para Oficina |
