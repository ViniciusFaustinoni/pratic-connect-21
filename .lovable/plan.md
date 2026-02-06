
## Plano: Notificação Automática via WhatsApp ao Solicitar Documentos

### Contexto Atual

O sistema já possui:
- ✅ **Realtime funcionando**: A página `/acompanhar/:token` já escuta mudanças em `documentos_solicitados` via Supabase Realtime
- ✅ **Componente de documentos pendentes**: `DocumentosPendentes` já é renderizado quando o associado tem status `documentacao_pendente`
- ✅ **Chamada à notificação**: O hook `useSolicitarDocumentos` já invoca a edge function `notificar-cliente`

### Problema a Resolver

O template atual de WhatsApp para `documentos_solicitados` não inclui:
1. O **link direto** para a página de envio de documentos
2. A **lista detalhada** dos documentos solicitados (apenas exibe os IDs concatenados)

### Alterações Necessárias

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/usePropostasPendentes.ts` | Buscar `link_token` do contrato e formatar lista de documentos com labels legíveis |
| `supabase/functions/notificar-cliente/index.ts` | Atualizar template para incluir link e listar documentos detalhadamente |

---

### Detalhes Técnicos

#### 1. Atualizar `useSolicitarDocumentos` (src/hooks/usePropostasPendentes.ts)

**Antes** (linha 1770-1781):
```typescript
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'documentos_solicitados',
    associado_id: associadoId,
    dados: {
      documentos: documentos.join(', '),
      observacoes: observacoes || '',
    },
  },
});
```

**Depois**:
```typescript
// Buscar link_token do contrato para incluir na mensagem
const { data: contratoComLink } = await supabase
  .from('contratos')
  .select('link_token')
  .eq('id', contratoId)
  .single();

// Mapa de labels para documentos
const DOCUMENTO_LABELS: Record<string, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comprovante_residencia: 'Comprovante de Residência',
  selfie_veiculo: 'Selfie com Veículo',
  frente: 'Foto Frente do Veículo',
  traseira: 'Foto Traseira',
  lateral_direita: 'Foto Lateral Direita',
  lateral_esquerda: 'Foto Lateral Esquerda',
  odometro: 'Foto do Odômetro',
  chassi: 'Foto do Chassi',
  motor: 'Foto do Motor',
  banco_dianteiro: 'Foto Banco Dianteiro',
  banco_traseiro: 'Foto Banco Traseiro',
  pneu_dianteiro_direito: 'Pneu Dianteiro Direito',
  pneu_dianteiro_esquerdo: 'Pneu Dianteiro Esquerdo',
  pneu_traseiro_direito: 'Pneu Traseiro Direito',
  pneu_traseiro_esquerdo: 'Pneu Traseiro Esquerdo',
  outro: 'Outro Documento',
};

// Formatar lista de documentos com labels
const docsFormatados = documentos
  .map((id) => `• ${DOCUMENTO_LABELS[id] || id}`)
  .join('\n');

// Gerar link de acompanhamento
const linkAcompanhamento = contratoComLink?.link_token 
  ? `${window.location.origin}/acompanhar/${contratoComLink.link_token}`
  : null;

await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'documentos_solicitados',
    associado_id: associadoId,
    dados: {
      documentos: docsFormatados, // Lista formatada com bullets
      observacoes: observacoes || '',
      link_acompanhamento: linkAcompanhamento || 'Acesse pelo link enviado anteriormente',
    },
  },
});
```

#### 2. Atualizar Template em `notificar-cliente` (supabase/functions/notificar-cliente/index.ts)

**Antes** (linha 51-54):
```typescript
documentos_solicitados: {
  titulo: '📄 Documentos Pendentes',
  mensagem: 'Olá {nome}! Precisamos de alguns documentos para dar continuidade ao seu cadastro: {documentos}. Acesse o link de acompanhamento para enviar. Você tem 7 dias para enviar.',
  emailTemplate: 'generico',
},
```

**Depois**:
```typescript
documentos_solicitados: {
  titulo: '📄 Documentação Pendente',
  mensagem: `Olá {nome}! Para dar continuidade à sua filiação na PRATIC, precisamos dos seguintes documentos:

{documentos}

{observacoes}

📲 *Envie agora mesmo pelo link:*
🔗 {link_acompanhamento}

⏰ Você tem *7 dias* para enviar. Após esse prazo, a solicitação pode ser cancelada.

Qualquer dúvida, responda esta mensagem!`,
  emailTemplate: 'generico',
},
```

---

### Fluxo Completo Após Implementação

```
┌───────────────────────────────────────────────────────────────────┐
│  ANALISTA DE CADASTRO                                             │
│  (Tela de Análise de Proposta)                                   │
│                                                                   │
│  1. Clica em "Solicitar Documentos"                              │
│  2. Seleciona: CNH, CRLV, Comprovante                            │
│  3. Adiciona observação: "Fotos legíveis por favor"              │
│  4. Confirma                                                      │
└────────────────────────┬──────────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────────┐
│  SISTEMA (Backend)                                                │
│                                                                   │
│  1. Insere registros em documentos_solicitados                   │
│  2. Atualiza associado.status → 'documentacao_pendente'          │
│  3. Busca link_token do contrato                                 │
│  4. Formata documentos com labels legíveis                       │
│  5. Chama edge function notificar-cliente                        │
└────────────────────────┬──────────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────────┐
│  WHATSAPP DO CLIENTE                                              │
│                                                                   │
│  📄 Documentação Pendente                                         │
│                                                                   │
│  Olá João! Para dar continuidade à sua filiação na PRATIC,       │
│  precisamos dos seguintes documentos:                            │
│                                                                   │
│  • CNH                                                           │
│  • CRLV                                                          │
│  • Comprovante de Residência                                     │
│                                                                   │
│  📝 Obs: Fotos legíveis por favor                                │
│                                                                   │
│  📲 Envie agora mesmo pelo link:                                 │
│  🔗 https://pratic.app/acompanhar/abc123                         │
│                                                                   │
│  ⏰ Você tem 7 dias para enviar.                                 │
└────────────────────────┬──────────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────────┐
│  ÁREA DO CLIENTE (Realtime)                                       │
│  /acompanhar/:token                                               │
│                                                                   │
│  A tela já atualiza automaticamente via Supabase Realtime        │
│  quando o INSERT em documentos_solicitados é detectado.          │
│                                                                   │
│  O cliente vê:                                                   │
│  ┌─────────────────────────────────────────────┐                 │
│  │  ⚠️ Documentos Pendentes                    │                 │
│  │                                             │                 │
│  │  📄 CNH                          [Pendente] │                 │
│  │  📄 CRLV                         [Pendente] │                 │
│  │  📄 Comprovante de Residência    [Pendente] │                 │
│  │                                             │                 │
│  │  [  📤 Enviar Documentos  ]                 │                 │
│  └─────────────────────────────────────────────┘                 │
└───────────────────────────────────────────────────────────────────┘
```

---

### Verificações Adicionais

1. **Realtime já está funcionando** para `documentos_solicitados` na página `/acompanhar/:token` (linhas 408-421 do arquivo `AcompanhamentoProposta.tsx`)

2. **O componente `DocumentosPendentes`** já renderiza quando `associado.status === 'documentacao_pendente'` (linha 594)

3. **Não é necessário alterar a área do cliente** - ela já atualiza automaticamente via Realtime

---

### Considerações

- O link enviado por WhatsApp direciona diretamente para `/acompanhar/:token`, onde o cliente verá os documentos pendentes e poderá enviá-los
- A observação do analista (se preenchida) será incluída na mensagem
- O prazo de 7 dias é informativo - pode ser ajustado conforme regra de negócio
