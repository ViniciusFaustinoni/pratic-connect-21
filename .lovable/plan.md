

# Corrigir exibicao do historico do sinistro com labels amigaveis e todas as acoes

## Problema

1. Na tela `SinistroAnalise.tsx`, o card lateral "Historico" mostra status tecnicos crus como `em_analise`, `aguardando_analise`, `comunicado` ao inves de labels amigaveis ("Em Analise", "Aguardando Analise", "Comunicado")
2. O componente `TimelineEventoTab` (timeline rica) ja existe e ja agrega vistorias, cotacoes, ordens de servico, links do evento, etc. -- porem ele tambem exibe status crus em alguns pontos (linhas 116-117 e 189)
3. Na tela `SinistroDetalhe.tsx`, o historico ja usa `statusConfig` para labels, mas so mostra registros da tabela `sinistro_historico`, sem incluir vistorias e outras acoes

## Solucao

### 1. Substituir o card lateral de historico no `SinistroAnalise.tsx`

Trocar o card basico (linhas 1338-1374) que mostra `{h.status_novo}` cru pelo componente `TimelineEventoTab` que ja agrega todas as fontes de dados (historico, vistorias, cotacoes, OS, links, atualizacoes diarias).

O card ficara:

```
<Card>
  <CardHeader>
    <CardTitle className="text-sm">Historico</CardTitle>
  </CardHeader>
  <CardContent>
    <TimelineEventoTab sinistroId={sinistro.id} />
  </CardContent>
</Card>
```

### 2. Adicionar mapa de labels amigaveis no `TimelineEventoTab.tsx`

Criar um dicionario `STATUS_LABELS` no componente para traduzir todos os status tecnicos:

| Chave tecnica | Label amigavel |
|---|---|
| comunicado | Comunicado |
| em_analise | Em Analise |
| aguardando_analise | Aguardando Analise |
| aguardando_vistoria | Aguardando Vistoria |
| em_vistoria | Em Vistoria |
| aguardando_parecer | Aguardando Parecer |
| aprovado | Aprovado |
| negado | Negado |
| em_regulacao | Em Regulacao |
| em_reparo | Em Reparo |
| aguardando_diretoria | Aguardando Diretoria |
| em_sindicancia | Em Sindicancia |
| suspensa | Suspensa |
| pago | Pago |
| encerrado | Encerrado |
| cancelado | Cancelado |
| pendente | Pendente |
| agendada | Agendada |
| concluida | Concluida |
| em_andamento | Em Andamento |

Aplicar esse mapa em todos os pontos onde status crus sao exibidos:
- Linha 116: `title` do historico de mudanca de status
- Linha 117: `description` com transicao de status
- Linha 189: `description` da vistoria

### 3. Substituir historico no `SinistroDetalhe.tsx`

Substituir o bloco de historico (linhas 1220-1275) pelo `TimelineEventoTab`, para que tambem mostre todas as acoes (vistorias, cotacoes, OS, etc.) com labels amigaveis -- nao apenas mudancas de status.

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/sinistros/TimelineEventoTab.tsx` | Adicionar mapa de labels amigaveis e aplicar em 3 pontos |
| `src/pages/eventos/SinistroAnalise.tsx` | Substituir card de historico basico pelo `TimelineEventoTab` |
| `src/pages/eventos/SinistroDetalhe.tsx` | Substituir bloco de historico pelo `TimelineEventoTab` |

## Resultado esperado

- Todos os status aparecerao com nomes amigaveis em portugues (ex: "Em Analise" ao inves de "em_analise")
- O historico mostrara todas as acoes: mudancas de status, vistorias do regulador, cotacoes, ordens de servico, links enviados, pagamentos, termos assinados, atualizacoes diarias da oficina
- Interface visual consistente com icones e badges coloridos
