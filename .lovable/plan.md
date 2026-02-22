
# S05 — Modal de Emissao de Laudo

## Resumo

Reescrever completamente o `EmitirLaudoModal.tsx` de um formulario basico (4 campos) para um modal completo com 7 secoes: conclusao com radio buttons coloridos, resumo executivo (min 100 chars), irregularidades condicionais, recomendacao com validacao cruzada, upload de PDF, resumo automatico de diligencias, e confirmacao final com checkbox obrigatorio. Apos emissao, atualizar a pagina de detalhe para mostrar card de conclusao no lugar dos botoes de acao.

---

## 1. Reescrever `src/components/sindicante/EmitirLaudoModal.tsx`

O modal atual sera completamente substituido. Novo conteudo:

**Titulo:** "Emitir Laudo — SIND-XXXXXXXX-001"
**Subtitulo:** "Evento #EVT-XXXXXXXX-XXX"
**Tamanho:** `max-w-2xl` com `max-h-[90vh] overflow-y-auto`

### Props adicionais necessarias
Adicionar `sindicanciaNumero`, `eventoProtocolo` e `diligencias` (array) as props, para exibir no titulo e calcular o resumo de diligencias. Alternativa: buscar dentro do modal via query (mais simples, menos props).

Decisao: buscar diligencias dentro do modal via query ao abrir, para manter a interface de props simples.

### Secao 1: Conclusao (radio buttons)
4 opcoes com `RadioGroup`, cada uma como card clicavel com borda colorida:
- **Regular** — borda/badge verde. Texto descritivo abaixo.
- **Irregular — Fraude Comprovada** — borda/badge vermelho.
- **Irregular — Fraude Suspeita** — borda/badge laranja.
- **Inconclusivo** — borda/badge amarelo.

Usar `CONCLUSAO_LAUDO_LABELS` do types.

### Secao 2: Resumo Executivo
- Textarea com `rows={6}`, minimo 100 caracteres
- Placeholder longo explicativo
- Dica abaixo: "Este resumo sera lido pelo analista da Pratic..."
- Contador de caracteres

### Secao 3: Irregularidades (condicional)
- Visivel apenas se conclusao = 'irregular_comprovada' ou 'irregular_suspeita'
- Textarea obrigatoria quando visivel
- Placeholder explicativo

### Secao 4: Recomendacao (select)
- 5 opcoes de `RECOMENDACAO_LABELS`
- Validacao cruzada: se conclusao = 'regular', filtrar opcoes para mostrar apenas 'aprovar' e 'encaminhar_diretoria'
- Se conclusao mudar de regular para outro, resetar recomendacao se era 'aprovar'

### Secao 5: Upload de PDF
- Input de arquivo unico, aceita apenas PDF, max 10MB
- Upload para bucket `sindicancia-evidencias` no path `{sindicanciaId}/laudo/`
- Se nao anexar: alerta amarelo recomendando anexar
- Usar `react-dropzone` ou input nativo

### Secao 6: Resumo de Diligencias (somente leitura)
- Query: `sindicancia_diligencias WHERE sindicancia_id = X`
- Card informativo com contagem por tipo (usando `TIPO_DILIGENCIA_LABELS`)
- Calculo de dias entre primeira e ultima diligencia
- Formato: "Foram realizadas [X] diligencias ao longo de [Y] dias: - [N] visita(s) ao local - [N] entrevista(s) - ..."

### Secao 7: Confirmacao Final
- Card com borda amarela e icone de atencao
- Texto de aviso sobre irreversibilidade
- Checkbox: "Confirmo que as informacoes do laudo estao corretas e completas"
- Botao "Emitir Laudo" (vermelho) so habilitado quando checkbox marcado

### Fluxo ao confirmar
1. Upload do PDF (se houver) -> obter URL publica
2. UPDATE `sindicancias` SET laudo_conclusao, laudo_resumo, laudo_irregularidades, laudo_recomendacao, laudo_arquivo_url, data_laudo, status = 'laudo_emitido'
3. UPDATE `sinistros` SET status = 'aguardando_analise' WHERE id = sinistro_id
4. INSERT `sinistro_historico` com descricao "Laudo de sindicancia emitido — Conclusao: [X] — Recomendacao: [Y]"
5. Notificar analistas de eventos via `NotificacaoHelper` — criar nova funcao `notificarLaudoEmitido` ou reutilizar `notificarSindicanciaConcluida`
6. Toast de sucesso
7. Redirecionar para `/sindicante` (dashboard)

### Botoes
- "Cancelar" (outline)
- "Emitir Laudo" (variant="destructive", disabled se !confirmado)

---

## 2. Adicionar funcao de notificacao

**Arquivo:** `src/components/sinistros/NotificacaoHelper.ts`

Adicionar funcao `notificarLaudoEmitido(sinistroId, protocolo, conclusao, sindicanciaNumero)`:
- Buscar user_ids com role 'analista_eventos' (similar a getDiretoresIds)
- Tambem notificar diretores
- Mensagem: "Laudo de sindicancia recebido — Evento #[protocolo] — Conclusao: [conclusao]"

---

## 3. Atualizar card de acoes apos emissao no `SindicanteCasoDetalhe.tsx`

**Arquivo:** `src/pages/sindicante/SindicanteCasoDetalhe.tsx`

No card "Acoes" (coluna direita), quando `status === 'laudo_emitido'`:
- Substituir botoes por card verde com:
  - Icone check
  - "Laudo emitido em [data_laudo formatada]"
  - Badge da conclusao (cores do `CONCLUSAO_LAUDO_LABELS`)
  - "Aguardando decisao do analista"

Tambem adicionar na coluna esquerda um novo card "Laudo Emitido" mostrando:
- Conclusao (badge colorida)
- Resumo executivo (texto)
- Irregularidades (se houver)
- Recomendacao
- Link para download do PDF (se houver)

Adicionar `useNavigate` ao `onSuccess` do `EmitirLaudoModal` para redirecionar ao dashboard.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `src/components/sindicante/EmitirLaudoModal.tsx` | Reescrever completamente: 7 secoes, radio buttons, upload PDF, resumo diligencias, checkbox confirmacao |
| `src/components/sinistros/NotificacaoHelper.ts` | Adicionar `notificarLaudoEmitido` |
| `src/pages/sindicante/SindicanteCasoDetalhe.tsx` | Card de acoes pos-emissao + card de laudo emitido na coluna esquerda + redirect apos emissao |

## Sequencia de Implementacao

1. Adicionar `notificarLaudoEmitido` no NotificacaoHelper
2. Reescrever `EmitirLaudoModal.tsx`
3. Atualizar `SindicanteCasoDetalhe.tsx` com card pos-emissao e redirect
