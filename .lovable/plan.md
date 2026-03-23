

# Plano: Fila de Envio em Massa para Aprovacao Meta

## Resumo

Criar botao "Enviar todos os rascunhos" que coloca templates DRAFT em uma fila e os envia para a Meta **um de cada vez**, com intervalo entre cada envio, evitando bloqueio por rate limit.

---

## Implementacao

### 1. Logica de fila no frontend (`WhatsAppMetaTemplates.tsx`)

Adicionar estado e funcao de fila:

- `filaEnvio: string[]` — IDs dos templates na fila
- `envioEmMassa: boolean` — flag de processo ativo  
- `envioProgresso: { atual: number; total: number; nome: string }` — progresso visual

Funcao `enviarEmMassa()`:
1. Filtrar templates com status `DRAFT`
2. Se nenhum, toast.info("Nenhum rascunho para enviar")
3. Iterar sequencialmente (for...of) com `await` em cada envio
4. Entre cada envio, aguardar 15 segundos (`await new Promise(r => setTimeout(r, 15000))`)
5. Usar `enviar.mutateAsync(id)` (ja existente) para cada template
6. Se um falhar, registrar erro e continuar com o proximo
7. Ao final, exibir toast com resumo: "X enviados, Y erros"

Botao cancelar: setar flag `cancelado = true` que interrompe o loop.

### 2. Botao na UI

Adicionar botao "Enviar rascunhos para Meta" ao lado do "Sincronizar" e "Novo Template":
- Icone: `Send` 
- Visivel apenas quando ha templates DRAFT
- Disabled durante o processo
- Exibir progresso inline: "Enviando 3/12 — d5_ultimo_dia..."

### 3. Barra de progresso

Quando `envioEmMassa === true`, exibir acima da tabela um Alert com:
- Barra de progresso visual (div com width percentual)
- Nome do template sendo enviado
- Contador "X de Y"
- Tempo estimado restante (Y * 15s)
- Botao "Cancelar" para interromper

---

## Detalhes tecnicos

- Intervalo de 15s entre envios (Meta permite ~200 chamadas/hora para management API, mas conservadoramente usamos 4/min)
- Nenhuma edge function nova — usa a existente `whatsapp-meta-templates` com `acao: 'enviar'`
- Nenhuma tabela nova — tudo no estado do componente
- Se o usuario sair da pagina, o processo para naturalmente

---

## Arquivo afetado

| Arquivo | Alteracao |
|---|---|
| `src/components/integracoes/WhatsAppMetaTemplates.tsx` | Botao + logica de fila + barra de progresso |

