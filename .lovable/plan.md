
# Plano: Corrigir Busca do Vídeo 360° na Função `useProposta`

## Problema Identificado

O vídeo 360° não aparece na lista de documentos porque a função `useProposta` (usada na tela de análise individual) **não busca** o campo `video_360_url` da tabela `vistorias`.

### Evidências

| Verificação | Resultado |
|-------------|-----------|
| Vídeo existe no banco? | Sim - `cf7afb6b-acec-4214-bd70-edebf107ad2b` |
| URL do vídeo | `https://...supabase.co/.../video_360_1770410381766.mp4` |
| Contrato vinculado? | Sim - `contrato_id = 7a6d1532-c45c-4574-887c-5d30b795ba32` |
| Prop passada ao componente | `proposta.vistoria?.video_360_url` = `undefined` |

### Código Problemático

**Arquivo:** `src/hooks/usePropostasPendentes.ts` - Função `useProposta` (linhas 727-751)

```typescript
// ATUAL - NÃO busca video_360_url:
const { data: vistoriaData } = await supabase
  .from('vistorias')
  .select('id, status, modalidade')  // ← FALTA video_360_url
  .eq('contrato_id', contrato.id)

// Montagem do objeto vistoria:
vistoria = {
  id: vistoriaData.id,
  status: vistoriaData.status || 'pendente',
  tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
  modalidade: vistoriaData.modalidade || undefined,
  fotos: fotosVistoria as VistoriaFotoInfo[],
  // ← FALTA video_360_url: vistoriaData.video_360_url,
};
```

### Comparação com Código Correto

Na função `usePropostasPendentes` (linhas 275-301), a busca está **correta**:

```typescript
.select('id, status, modalidade, observacoes, km_atual, video_360_url')
// ...
video_360_url: vistoriaData.video_360_url,
```

---

## Solução

### Modificar `src/hooks/usePropostasPendentes.ts`

**Localização:** Linhas 727-751 (função `useProposta`)

#### 1. Adicionar campos na consulta (linha 729)

```typescript
// DE:
.select('id, status, modalidade')

// PARA:
.select('id, status, modalidade, observacoes, km_atual, video_360_url')
```

#### 2. Adicionar campos no objeto de resposta (linhas 744-750)

```typescript
// DE:
vistoria = {
  id: vistoriaData.id,
  status: vistoriaData.status || 'pendente',
  tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
  modalidade: vistoriaData.modalidade || undefined,
  fotos: fotosVistoria as VistoriaFotoInfo[],
};

// PARA:
vistoria = {
  id: vistoriaData.id,
  status: vistoriaData.status || 'pendente',
  tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
  modalidade: vistoriaData.modalidade || undefined,
  fotos: fotosVistoria as VistoriaFotoInfo[],
  observacoes: vistoriaData.observacoes,
  km_atual: vistoriaData.km_atual,
  video_360_url: vistoriaData.video_360_url,
};
```

#### 3. Adicionar fallback para busca legada (linhas 754-771)

Para o caso de cotações antigas (fallback), também buscar o vídeo 360:

```typescript
// 2. Fallback: buscar em cotacoes_vistoria_fotos (legado, apenas se tiver cotacao_id)
if (!vistoria && contrato.cotacao_id) {
  // Buscar vistoria pela cotacao_id para obter video_360_url
  const { data: vistoriaCotacao } = await supabase
    .from('vistorias')
    .select('video_360_url, observacoes, km_atual')
    .eq('cotacao_id', contrato.cotacao_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: fotosLegado } = await supabase
    .from('cotacoes_vistoria_fotos')
    .select('id, tipo, arquivo_url, created_at')
    .eq('cotacao_id', contrato.cotacao_id)
    .order('created_at', { ascending: true });

  if (fotosLegado && fotosLegado.length > 0) {
    vistoria = {
      id: contrato.cotacao_id,
      status: 'pendente',
      tipo: 'autovistoria',
      modalidade: 'autovistoria',
      fotos: fotosLegado as VistoriaFotoInfo[],
      video_360_url: vistoriaCotacao?.video_360_url || null,
      observacoes: vistoriaCotacao?.observacoes,
      km_atual: vistoriaCotacao?.km_atual,
    };
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePropostasPendentes.ts` | Corrigir função `useProposta` (linhas 727-771) |

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| `proposta.vistoria?.video_360_url` = `undefined` | `proposta.vistoria?.video_360_url` = URL do vídeo |
| Vídeo 360 não aparece nos documentos | Vídeo 360 aparece no topo da lista com destaque roxo |

---

## Testes Recomendados

1. Acessar a proposta `7a6d1532-c45c-4574-887c-5d30b795ba32`
2. Verificar se o Vídeo 360° aparece no card "Documentos Anexados"
3. Clicar no item do vídeo e confirmar que o player funciona
4. Verificar a contagem de documentos (deve ser 6 agora: 5 docs + 1 vídeo)
