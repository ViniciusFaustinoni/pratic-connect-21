
# S03 — Modal de Abertura de Sindicancia

## Resumo

Substituir o modal antigo `EncaminharSindicanciaDialog.tsx` por um novo modal completo que cria um registro na tabela `sindicancias`, com motivos padronizados detalhados, selecao de empresa de sindicancia ativa, datepicker de prazo, e card de resumo antes de confirmar. Criar tambem um segundo modal simples para atribuir sindicante a casos "Aguardando Atribuicao".

---

## 1. Atualizar constantes em `src/types/sindicancia.ts`

Substituir o array `MOTIVOS_PADRONIZADOS` atual (8 itens genericos) pela nova lista de 10 motivos detalhados da tarefa:

```
inconsistencia_relato -> "Inconsistencia no relato do associado"
distancia_gps -> "Distancia GPS suspeita"
historico_sinistros -> "Historico de sinistros"
valor_dano_incompativel -> "Valor do dano incompativel"
documentacao_suspeita -> "Documentacao suspeita"
indicios_fraude -> "Indicios de fraude"
denuncia_externa -> "Denuncia ou informacao externa"
veiculo_restricoes -> "Veiculo com restricoes"
condutor_irregular -> "Condutor irregular"
evento_carencia -> "Evento em periodo de carencia"
```

---

## 2. Reescrever `src/components/sinistros/EncaminharSindicanciaDialog.tsx`

O modal atual sera completamente reescrito. Conteudo novo:

**Titulo:** "Abrir Sindicancia — Evento #[protocolo]"

### Secao 1: Motivo da Sindicancia
- 10 checkboxes (pode marcar varios) com os motivos padronizados
- Textarea obrigatoria "Descricao detalhada do motivo" com minimo 50 caracteres
- Placeholder explicativo para o analista

### Secao 2: Atribuir Sindicante
- Select buscando `empresas_sindicancia` WHERE `ativo = true`
- Cada opcao mostra: nome_fantasia + especialidades (badges) + count de casos ativos (query em `sindicancias`)
- Pode deixar em branco — mostra informativo azul "caso ficara como Aguardando Atribuicao"

### Secao 3: Prazo
- Datepicker (nao input numerico)
- Valor padrao: hoje + 30 dias
- Minimo: hoje + 7 dias
- Maximo: hoje + 60 dias

### Secao 4: Resumo antes de confirmar
- Card cinza com: evento, motivos selecionados, sindicante ou "Nao atribuido", prazo, aviso de suspensao

### Validacoes
- Pelo menos 1 checkbox marcado
- Descricao >= 50 caracteres
- Verifica se ja existe sindicancia ativa (status != 'encerrado' e != 'cancelado') para o mesmo sinistro. Se sim, bloqueia com erro mostrando o numero.

### Fluxo ao confirmar
1. Inserir em `sindicancias` com:
   - `sinistro_id`, `motivo` (descricao), `motivos_padronizados` (array dos checkboxes marcados)
   - `empresa_sindicancia_id` e `sindicante_profile_id` (da empresa selecionada, se houver)
   - `data_limite` (data do datepicker)
   - `status`: 'atribuido' se sindicante selecionado, 'aguardando_atribuicao' se nao
   - `data_atribuicao`: now() se atribuido
   - `aberto_por`: profile_id do analista logado
2. Atualizar `sinistros` SET status = 'em_sindicancia', prazo_suspenso = true, etc.
3. Inserir suspensao de prazo em `sinistro_suspensoes_prazo`
4. Inserir historico em `sinistro_historico`
5. Se sindicante atribuido, notificar via `NotificacaoHelper`
6. Toast de sucesso com o numero da sindicancia gerado

**Botoes:** "Cancelar" (outline) | "Abrir Sindicancia" (vermelho/destrutivo)

---

## 3. Criar `src/components/sinistros/AtribuirSindicanteModal.tsx` (novo)

Modal simples para atribuir sindicante a caso "Aguardando Atribuicao":

- Props: `sindicanciaId`, `open`, `onOpenChange`, `onSuccess`
- Select de empresas ativas (mesmo do modal principal)
- Botao "Atribuir"
- Ao salvar: UPDATE sindicancias SET empresa_sindicancia_id, sindicante_profile_id, status = 'atribuido', data_atribuicao = now()
- Notifica o sindicante

---

## 4. Atualizar `SinistroDetalhe.tsx`

Nenhuma mudanca estrutural necessaria — o modal ja esta conectado via `modalSindicanciaOpen` e `EncaminharSindicanciaDialog`. A interface do componente (props) sera mantida compativel. Apenas garantir que o `onSuccess` invalida as queries corretas (incluindo sindicancias).

---

## Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| `src/components/sinistros/AtribuirSindicanteModal.tsx` | Modal simples para atribuir sindicante |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `src/types/sindicancia.ts` | Atualizar MOTIVOS_PADRONIZADOS com 10 novos motivos |
| `src/components/sinistros/EncaminharSindicanciaDialog.tsx` | Reescrever completamente com novo fluxo |

## Sequencia de Implementacao

1. Atualizar `MOTIVOS_PADRONIZADOS` em `sindicancia.ts`
2. Reescrever `EncaminharSindicanciaDialog.tsx`
3. Criar `AtribuirSindicanteModal.tsx`
