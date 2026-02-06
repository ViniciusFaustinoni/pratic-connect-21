
## Plano: Salvar e Exibir Vídeo 360° para Analista de Cadastro

### Análise do Sistema Atual

Após investigação do código, identifiquei que o sistema **já possui a implementação completa** para salvar e exibir o vídeo 360°:

| Componente | Status | Descrição |
|------------|--------|-----------|
| Upload do vídeo | ✅ Funcionando | Hook `useUploadVideo360` salva no bucket `vistoria-videos` e atualiza `vistorias.video_360_url` |
| Tela do vistoriador | ✅ Funcionando | `InstaladorChecklist.tsx` exibe o vídeo e permite substituir |
| Tela do analista | ✅ Funcionando | `PropostaAnalise.tsx` renderiza `Video360Card` quando há URL |
| Dados no banco | ✅ Confirmado | Existe contrato com vídeo 360° salvo corretamente |

### Lacuna Identificada

Existe um **cenário de fallback** no hook `usePropostasPendentes` que pode não exibir o vídeo:

```typescript
// Fallback para tabela legada cotacoes_vistoria_fotos
// NÃO inclui video_360_url no objeto criado
vistoria = {
  id: contrato.cotacao_id,
  status: 'pendente',
  fotos: fotosLegado,
  // video_360_url AUSENTE!
};
```

### Correção Necessária

Modificar o fallback para também buscar o `video_360_url` da vistoria associada à cotação:

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/usePropostasPendentes.ts` | Adicionar busca de video_360_url no fallback legado |

---

### Alteração Detalhada

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

**Linha 307-334 - Modificar fallback para incluir busca de vídeo:**

```typescript
// 2. Fallback: buscar em cotacoes_vistoria_fotos (legado)
if (!vistoria && contrato.cotacao_id) {
  // Primeiro, buscar tipo_vistoria e video_360_url da vistoria/cotação
  const { data: cotacaoTipo } = await supabase
    .from('cotacoes')
    .select('tipo_vistoria')
    .eq('id', contrato.cotacao_id)
    .maybeSingle();
  
  // Tentar buscar vistoria pela cotacao_id para obter video_360_url
  const { data: vistoriaCotacao } = await supabase
    .from('vistorias')
    .select('video_360_url')
    .eq('cotacao_id', contrato.cotacao_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const isAutoFromCotacao = cotacaoTipo?.tipo_vistoria === 'autovistoria';
  
  const { data: fotosLegado } = await supabase
    .from('cotacoes_vistoria_fotos')
    .select('id, tipo, arquivo_url, created_at')
    .eq('cotacao_id', contrato.cotacao_id)
    .order('created_at', { ascending: true });

  if (fotosLegado && fotosLegado.length > 0) {
    vistoria = {
      id: contrato.cotacao_id,
      status: 'pendente',
      tipo: isAutoFromCotacao ? 'autovistoria' : 'agendada',
      modalidade: isAutoFromCotacao ? 'autovistoria' : 'presencial',
      fotos: fotosLegado as VistoriaFotoInfo[],
      // NOVO: Incluir video_360_url se existir
      video_360_url: vistoriaCotacao?.video_360_url || null,
    };
  }
}
```

---

### Fluxo Completo Após Correção

```text
┌────────────────────────────────────────────────────────────────┐
│  VISTORIADOR/INSTALADOR                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Grava vídeo 360° do veículo                          │  │
│  │  2. Upload para bucket "vistoria-videos"                 │  │
│  │  3. URL salva em vistorias.video_360_url                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  ANALISTA DE CADASTRO                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PropostaAnalise.tsx                                     │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  🎥 Vídeo 360° do Veículo                          │  │  │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  │
│  │  │  │                                              │  │  │  │
│  │  │  │         [VIDEO PLAYER]                       │  │  │  │
│  │  │  │                                              │  │  │  │
│  │  │  └──────────────────────────────────────────────┘  │  │  │
│  │  │  Gravado pelo vistoriador - Volta completa         │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

### Resultado Esperado

Após a correção:

1. **Upload funcionando** - O vistoriador grava e envia o vídeo 360° (já funciona)
2. **Vídeo salvo no banco** - Campo `video_360_url` é preenchido na tabela `vistorias` (já funciona)
3. **Analista visualiza** - O card `Video360Card` aparece na tela de análise mostrando o vídeo
4. **Cobertura completa** - Funciona tanto para fluxo moderno (contrato_id) quanto legado (cotacao_id)

---

### Observação Técnica

O componente `Video360Card` já existe e está funcional:
- Player de vídeo nativo HTML5
- Badge indicando "360°"
- Descrição "Gravado pelo vistoriador"
- Suporte a `preload="metadata"` e `playsInline` para mobile
