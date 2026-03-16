

## Plano: Eliminar Hardcodes de Prazo e Conectar Configs Órfãs

### Escopo

20+ arquivos com prazos hardcoded. Criar helper compartilhado para edge functions, inserir 7 chaves no banco, e substituir todos os valores fixos por leitura dinâmica.

---

### 1. Inserir chaves faltantes no banco (migration de dados via insert tool)

7 novas chaves em `configuracoes`:

| Chave | Valor | Unidade |
|-------|-------|---------|
| `prazo_link_evento_horas` | 72 | horas |
| `prazo_link_primeiro_acesso_horas` | 48 | horas |
| `prazo_cotacao_fornecedor_horas` | 24 | horas |
| `prazo_vencimento_adesao_dias` | 3 | dias |
| `prazo_documento_upload_dias` | 7 | dias |
| `prazo_rastreador_sem_sinal_horas` | 4 | horas |
| `prazo_manutencao_rastreador_horas` | 48 | horas_uteis |

As duas chaves órfãs (`operacional_prazo_instalacao`, `operacional_prazo_analise_docs`) já existem -- não precisam ser inseridas, apenas passam a ser lidas pelo código.

---

### 2. Criar helper para edge functions

**Arquivo:** `supabase/functions/_shared/config-helper.ts`

```typescript
export async function getConfiguracaoNumero(
  supabase: any, chave: string, fallback: number
): Promise<number> {
  const { data } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle();
  return data ? parseFloat(data.valor) || fallback : fallback;
}
```

Padrão idêntico ao já usado em `efetivar-substituicao` (inline), mas centralizado.

---

### 3. Substituições por arquivo

#### Edge Functions (backend) — importar `getConfiguracaoNumero` do helper

| Arquivo | Hardcode | Substituição |
|---------|----------|-------------|
| `gerar-link-evento/index.ts` L85 | `+ 72` | `getConfiguracaoNumero(sb, 'prazo_link_evento_horas', 72)` |
| `agendar-contato-sinistro/index.ts` L31 | `+ 72` | idem |
| `analisar-evento/index.ts` L135 | `+ 72` | idem |
| `analisar-evento/index.ts` L177 | texto "72 horas" | usar variável `${prazoLink} horas` |
| `cron-contato-sinistro/index.ts` L189 | texto "72 horas" | idem |
| `aprovar-solicitacao-ia/index.ts` L369 | texto "72 horas" | idem |
| `assistente-chat/index.ts` L159 | texto "72 horas" | texto estático do system prompt -- substituir por variável carregada no início |
| `whatsapp-webhook/index.ts` L333 | texto "72h" | idem (system prompt) |
| `app-primeiro-acesso/index.ts` L111 | `48 * 60 * 60 * 1000` | `prazoAcesso * 60 * 60 * 1000` |
| `app-primeiro-acesso/index.ts` L147 | texto "48 horas" | `${prazoAcesso} horas` |
| `send-email/index.ts` L310 | texto "48 horas" | `${prazoAcesso} horas` |
| `send-email/index.ts` L378 | texto "24 horas" | `${prazoCotacao} horas` |
| `notificar-manutencao-whatsapp/index.ts` L43 | texto "48 horas" | `${prazoManutencao} horas` |
| `asaas-cobranca-adesao/index.ts` L221 | `+ 3` | `getConfiguracaoNumero(sb, 'prazo_vencimento_adesao_dias', 3)` |
| `autentique-webhook/index.ts` L641 | `+ 3` | idem |
| `retroativo-pagamento-termo/index.ts` L116 | `+ 3` | idem |
| `verificar-instalacao-completa/index.ts` L62 | `4 * 60 * 60 * 1000` | `prazoSemSinal * 60 * 60 * 1000` |
| `verificar-instalacao-completa/index.ts` L149 | texto "4 horas" | `${prazoSemSinal} horas` |
| `cron-lembrete-documentos/index.ts` L40-95 | `7 * 24 * 60 * 60 * 1000` (2x) e `3 * 24...` | `prazoDocs * 24 * 60 * 60 * 1000` |

#### Frontend (React) — usar `useConfiguracaoNumero` (hook já existe)

| Arquivo | Hardcode | Substituição |
|---------|----------|-------------|
| `SinistroAnalise.tsx` L581 | texto "72 horas" | `useConfiguracaoNumero('prazo_link_evento_horas', 72)` → interpolar no texto |
| `EventoLinkCard.tsx` L107 | texto "72 horas" | idem |
| `SolicitarOrcamentoDialog.tsx` L85 | `+ 24` | `useConfiguracaoNumero('prazo_cotacao_fornecedor_horas', 24)` |
| `AtribuirFornecedoresDialog.tsx` L135 | texto "24 horas" | idem |
| `AtribuirFornecedoresDialog.tsx` L190 | `+ 24` | idem |
| `AppSinistroNovo.tsx` L758 | texto "24 horas" | idem |
| `SolicitarDocumentosSinistroDialog.tsx` L101 | `+ 7` | `useConfiguracaoNumero('prazo_documento_upload_dias', 7)` |
| `ReguladorOficina.tsx` L67 | `> 48` | `useConfiguracaoNumero('prazo_manutencao_rastreador_horas', 48)` |

---

### 4. O que NÃO será alterado

- `ReguladorOficina.tsx` L67 (`horas > 48`) — é um alerta de UX, não um prazo operacional. **Porém** mapeia diretamente para `prazo_manutencao_rastreador_horas`, então será conectado.
- `AgendarVistoriaModal.tsx` — opções de seleção de prazo (24h/48h/72h) são opções de UI dropdown, não hardcodes de regra de negócio.
- `ConsultaTrajetoAvancada.tsx` — filtros de análise de trajeto, não prazos operacionais.
- `DespesaRecorrenteModal.tsx` — cálculo de recorrência financeira, não prazo operacional.
- `ModalEnviarAssinatura.tsx` — opções de prazo para assinatura, configuração de UI.
- `AppSinistroDetalhe.tsx` / `SinistroDetalhe.tsx` — janela de busca de mensagens IA (24h antes), não prazo operacional.
- Cotação validade 7 dias — já dinâmico via `validade_dias`.
- `operacional_prazo_sinistro` — já corrigido e conectado.

---

### 5. Resumo de arquivos afetados

- **1 novo arquivo:** `supabase/functions/_shared/config-helper.ts`
- **13 edge functions editadas** (substituir hardcodes por helper)
- **6 componentes React editados** (substituir hardcodes por hook)
- **7 inserts na tabela `configuracoes`** (via insert tool)

---

### Nota técnica

Para edge functions que têm prazos em textos de system prompt (como `assistente-chat` e `whatsapp-webhook`), o prazo será lido uma vez no início da request e interpolado no template. Isso evita queries extras e mantém o prompt dinâmico.

