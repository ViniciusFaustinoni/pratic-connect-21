

# Mostrar Indice de Risco IA independente do status do sinistro

## Problema

O card "Analise de Risco com IA" so aparece quando o sinistro esta com status `aguardando_analise`. Apos aprovacao (ou qualquer mudanca de status), o card desaparece.

## Solucao

Remover a condicao `sinistro.status === 'aguardando_analise'` da renderizacao do `CardAnaliseRiscoIA` no arquivo `src/pages/eventos/SinistroAnalise.tsx`.

O card continuara restrito a sinistros do tipo colisao (`tipo` contendo "colis"), mas sera exibido em qualquer status (aprovado, negado, em analise, etc.).

## Detalhe tecnico

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx` (linha 1410)

**De:**
```
{sinistro.tipo?.toLowerCase().includes('colis') && sinistro.status === 'aguardando_analise' && (
  <CardAnaliseRiscoIA sinistroId={sinistro.id} />
)}
```

**Para:**
```
{sinistro.tipo?.toLowerCase().includes('colis') && (
  <CardAnaliseRiscoIA sinistroId={sinistro.id} />
)}
```

Nenhuma outra alteracao e necessaria. O componente `CardAnaliseRiscoIA` ja carrega a analise salva do banco (`sinistro_analises_ia`) e exibe corretamente, e o botao "Reanalisar" continuara disponivel caso o analista queira refazer.
