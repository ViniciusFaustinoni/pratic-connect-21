
# Correção do Fluxo de Análise: Fotos da Auto-Vistoria + IA com Cobertura de Conserto

## Contexto

Atualmente, quando um sinistro de colisão é criado via IA:
- A IA confirma o reboque (se necessário) e cria o chamado de assistência
- Mas NAO informa ao associado sobre a possibilidade de conserto coberto pelo plano
- NAO envia o link de auto-vistoria de eventos com passo a passo
- Na tela de análise (`SinistroAnalise.tsx`), as fotos enviadas pelo associado via link de auto-vistoria NAO aparecem

## Mudancas

### 1. Prompt da IA — Explicar cobertura de conserto e enviar link (assistente-chat)

**Arquivo:** `supabase/functions/assistente-chat/index.ts`

No `SYSTEM_PROMPT`, após o bloco "FLUXO SINISTRO + ASSISTÊNCIA", adicionar instrução para que após confirmar a necessidade de reboque e criar o chamado de assistência, a IA:

- Informe ao associado que seu plano de cobertura total inclui o **conserto do veículo** (reparo em oficina credenciada)
- Explique que para dar andamento ao processo de conserto, o associado precisa completar 3 etapas via link:
  - Etapa 1: Enviar no mínimo 5 fotos do veículo danificado
  - Etapa 2: Enviar o Boletim de Ocorrência
  - Etapa 3: Enviar um relato escrito ou em áudio
- Inclua o marcador `[LINK_AUTO_VISTORIA]` na mensagem para que o frontend saiba exibir o link
- Essa explicação só deve acontecer se o veículo tiver **cobertura total** (se for apenas roubo/furto, não se aplica)

Texto sugerido para o prompt:

```
## FLUXO PÓS-REBOQUE PARA COLISÃO (COBERTURA TOTAL)
Após confirmar a necessidade de reboque e criar o chamado de assistência para um sinistro de COLISÃO com cobertura TOTAL:

1. Informe ao associado: "Seu plano inclui cobertura para conserto do veículo em oficina credenciada!"
2. Explique que para dar andamento, ele precisa completar 3 etapas simples pelo link que será enviado:
   - **Etapa 1** — Enviar no mínimo 5 fotos do veículo danificado (diferentes ângulos)
   - **Etapa 2** — Enviar o Boletim de Ocorrência (foto ou PDF) e o número do B.O.
   - **Etapa 3** — Enviar um relato escrito ou em áudio sobre o ocorrido
3. Diga: "Você receberá um link por WhatsApp para enviar essas informações. O link é válido por 72 horas."
4. Conclua: "Após o envio, um regulador será agendado para vistoria em até 3 dias úteis."

IMPORTANTE: Só mencione conserto se a cobertura for TOTAL. Para cobertura apenas roubo/furto, não há cobertura de conserto.
```

### 2. Tela de Análise — Exibir fotos da auto-vistoria de eventos

**Arquivo:** `src/hooks/useSinistroAnalise.ts`

Adicionar uma query para buscar o `sinistro_evento_links` mais recente do sinistro, que contem os dados das 3 etapas (fotos em `dados_etapa1.fotos_urls`, B.O. em `dados_etapa2`, relato em `dados_etapa3`).

```typescript
// Link do evento (dados das etapas de auto-vistoria)
const { data: linkEvento } = useQuery({
  queryKey: ['sinistro-analise-link-evento', sinistroId],
  queryFn: async () => {
    const { data } = await supabase
      .from('sinistro_evento_links')
      .select('*')
      .eq('sinistro_id', sinistroId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!sinistroId,
});
```

Retornar `linkEvento` no hook.

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

Após o card de "Documentos", adicionar um novo card **"Fotos da Auto-Vistoria"** que exibe:

- Grid de fotos da `dados_etapa1.fotos_urls` (com clique para ampliar)
- Informacoes do B.O. da `dados_etapa2` (número e arquivo)
- Relato do associado da `dados_etapa3` (texto ou link de áudio)
- Badge indicando o status do link (completado, pendente, expirado)

O card ficará posicionado logo acima do card de "Documentos" para que seja a primeira coisa que o analista vê.

Layout do card:

```
+------------------------------------------+
| Fotos da Auto-Vistoria do Associado (X)  |
| Status: Completado / Pendente            |
+------------------------------------------+
| [foto1] [foto2] [foto3]                 |
| [foto4] [foto5] [foto6]                 |
+------------------------------------------+
| B.O.: Número XXXX | [Ver arquivo]        |
+------------------------------------------+
| Relato: "Texto do relato..."             |
| ou [Ouvir áudio]                         |
+------------------------------------------+
```

### 3. Conversa da IA — Exibir link no chat do associado

**Arquivo:** `src/components/sinistros/ConversaIADialog.tsx`

Adicionar tratamento para o marcador `[LINK_AUTO_VISTORIA]` no conteúdo exibido (similar aos outros marcadores já tratados como `[BOTAO_LOCALIZACAO]`, `[UPLOAD_BO]`, etc.).

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/assistente-chat/index.ts` | Adicionar bloco no prompt sobre fluxo pós-reboque com explicação de conserto e link de auto-vistoria |
| `src/hooks/useSinistroAnalise.ts` | Adicionar query para buscar `sinistro_evento_links` com dados das etapas |
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar card "Fotos da Auto-Vistoria" com grid de fotos, B.O. e relato do associado |
| `src/components/sinistros/ConversaIADialog.tsx` | Tratar marcador `[LINK_AUTO_VISTORIA]` no conteúdo |

## Resultado

- A IA, após confirmar reboque em sinistro de colisão com cobertura total, explica que o plano cobre conserto e orienta o associado sobre as 3 etapas do link
- O associado recebe o link de auto-vistoria via WhatsApp (já funciona via `aprovar-solicitacao-ia`)
- Quando o analista de eventos abre a tela de análise, as fotos enviadas pelo associado via link já estão visíveis, junto com o B.O. e o relato
