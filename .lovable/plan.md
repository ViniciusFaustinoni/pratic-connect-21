
# Plano de Revisao Completa: Documentos

## Diagnostico Atual

### Status do Banco de Dados
| Tabela | Registros |
|--------|-----------|
| documento_templates | 6 |
| documento_categorias | 5 |
| documento_gerados | 0 |
| documento_assinaturas | 0 |

### Conclusao Principal
A area possui **DADOS MOCK** em `DocumentosHistorico.tsx` e a funcao de salvar historico esta **comentada/TODO** no hook `useGerarDocumento.ts`.

---

## O que esta funcionando corretamente

| Pagina/Componente | Funcionalidade | Status |
|-------------------|----------------|--------|
| TemplatesList.tsx | CRUD completo de templates | OK |
| TemplatesList.tsx | Filtros por busca e categoria | OK |
| TemplatesList.tsx | Duplicar, visualizar, excluir template | OK |
| TemplateForm.tsx | Criar novo template | OK |
| TemplateForm.tsx | Editar template existente | OK |
| TemplateForm.tsx | Validacoes e codigo automatico | OK |
| GerarDocumento.tsx | Wizard 3 etapas (associado, template, preview) | OK |
| GerarDocumento.tsx | Busca real de associados | OK |
| GerarDocumento.tsx | Geracao de PDF com pdf-lib | OK |
| GerarDocumento.tsx | Merge de variaveis | OK |
| ModalVisualizarTemplate | Visualizacao de template | OK |
| ModalEnviarAssinatura | Envio via Autentique (estrutura) | OK |
| ModalEnviarWhatsApp | Envio via Evolution API (estrutura) | OK |
| useDocumentoTemplates | Hooks CRUD completos | OK |
| useDocumentoPermissoes | Controle de acesso por perfil | OK |

---

## Problemas Identificados

| # | Problema | Arquivo | Linhas | Impacto |
|---|----------|---------|--------|---------|
| 1 | Usa `mockHistorico` para lista de documentos | DocumentosHistorico.tsx | 14-20 | Dados falsos exibidos |
| 2 | Usa `mockEstatisticas` para KPIs | DocumentosHistorico.tsx | 22-27 | Metricas falsas |
| 3 | Filtro de periodo nao funciona | DocumentosHistorico.tsx | 76-87 | Nao filtra dados |
| 4 | Acoes "Ver PDF", "Baixar", "Reemitir", "WhatsApp" so exibem toast | DocumentosHistorico.tsx | 52-54, 219-234 | Botoes nao funcionam |
| 5 | Funcao `salvarHistorico` esta comentada/TODO | useGerarDocumento.ts | 397-425 | Documentos gerados nao sao salvos |
| 6 | Checkbox "Salvar no historico" nao persiste | GerarDocumento.tsx | 526-538 | Opcao nao funciona |

---

## Correcoes Necessarias

### 1. Implementar salvarHistorico no useGerarDocumento.ts

**Arquivo**: `src/hooks/useGerarDocumento.ts`

Descomentar e implementar a funcao para:
1. Fazer upload do PDF para o bucket 'documentos'
2. Inserir registro na tabela `documento_gerados`

```typescript
const salvarHistorico = async (
  templateId: string,
  associadoId: string,
  dados: DadosMerge,
  pdfBytes: Uint8Array,
  arquivoNome: string
): Promise<DocumentoGerado | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. Upload do PDF para o Storage
    const timestamp = Date.now();
    const nomeUnico = `gerados/${associadoId}/${timestamp}-${arquivoNome}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(nomeUnico, new Blob([pdfBytes], { type: 'application/pdf' }), {
        contentType: 'application/pdf',
      });
    
    if (uploadError) throw uploadError;
    
    // 2. Obter URL publica
    const { data: urlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(uploadData.path);
    
    // 3. Gerar numero do documento
    const numeroDoc = `DOC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${timestamp.toString().slice(-6)}`;
    
    // 4. Inserir na tabela documento_gerados
    const { data, error } = await supabase
      .from('documento_gerados')
      .insert({
        template_id: templateId,
        associado_id: associadoId,
        numero_documento: numeroDoc,
        dados_utilizados: dados,
        arquivo_url: urlData.publicUrl,
        arquivo_nome: arquivoNome,
        gerado_por: user?.id,
        gerado_em: new Date().toISOString(),
        assinado: false,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as DocumentoGerado;
  } catch (error) {
    console.error('Erro ao salvar historico:', error);
    return null;
  }
};
```

### 2. Criar hook useDocumentoGerados

**Novo arquivo**: `src/hooks/useDocumentoGerados.ts`

Hook para gerenciar o historico de documentos gerados:

```typescript
export function useDocumentoGerados(filtros?: {
  periodo?: string;
  categoria?: string;
  busca?: string;
}) {
  return useQuery({
    queryKey: ['documento-gerados', filtros],
    queryFn: async () => {
      let query = supabase
        .from('documento_gerados')
        .select(`
          *,
          template:documento_templates(id, nome, codigo, categoria:documento_categorias(id, nome, cor)),
          associado:associados(id, nome, cpf),
          gerado_por_profile:profiles!documento_gerados_gerado_por_fkey(id, nome)
        `)
        .order('gerado_em', { ascending: false });
      
      // Aplicar filtros de periodo
      if (filtros?.periodo === 'hoje') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        query = query.gte('gerado_em', hoje.toISOString());
      } else if (filtros?.periodo === '7dias') {
        const seteDias = new Date();
        seteDias.setDate(seteDias.getDate() - 7);
        query = query.gte('gerado_em', seteDias.toISOString());
      }
      // ... demais filtros
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useEstatisticasDocumentos() {
  return useQuery({
    queryKey: ['documento-estatisticas'],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('documento_gerados')
        .select('id, gerado_em, assinado');
      
      if (error) throw error;
      
      const total = data.length;
      const esteMes = data.filter(d => new Date(d.gerado_em) >= inicioMes).length;
      const assinados = data.filter(d => d.assinado).length;
      const pendentes = data.filter(d => !d.assinado).length;
      
      return { total, esteMes, assinados, pendentes };
    },
  });
}
```

### 3. Refatorar DocumentosHistorico.tsx

**Arquivo**: `src/pages/documentos/DocumentosHistorico.tsx`

Remover mocks e conectar aos hooks reais:

```typescript
// REMOVER estas linhas:
const mockHistorico = [...];
const mockEstatisticas = {...};

// ADICIONAR:
import { useDocumentoGerados, useEstatisticasDocumentos } from '@/hooks/useDocumentoGerados';
import { useDocumentoStorage } from '@/hooks/useDocumentoStorage';

// No componente:
const [busca, setBusca] = useState('');
const [periodo, setPeriodo] = useState('todos');
const [categoria, setCategoria] = useState('todos');

const { data: historico, isLoading } = useDocumentoGerados({ busca, periodo, categoria });
const { data: estatisticas } = useEstatisticasDocumentos();
const { downloadDocumento } = useDocumentoStorage();

// Implementar acoes reais:
const handleVerPDF = (arquivoUrl: string) => {
  window.open(arquivoUrl, '_blank');
};

const handleBaixar = async (path: string, nomeArquivo: string) => {
  await downloadDocumento(path, nomeArquivo);
};

const handleReemitir = (templateId: string, associadoId: string) => {
  navigate(`/documentos/gerar?template=${templateId}&associado=${associadoId}`);
};

const handleEnviarWhatsApp = (item: DocumentoGerado) => {
  // Abrir modal de envio WhatsApp
  setSelectedDoc(item);
  setShowWhatsAppModal(true);
};
```

### 4. Atualizar GerarDocumento.tsx para persistir

**Arquivo**: `src/pages/documentos/GerarDocumento.tsx`

Atualizar a funcao `handleGerarDocumento` para usar o novo salvarHistorico:

```typescript
const handleGerarDocumento = async (modo: 'baixar' | 'abrir') => {
  if (!associadoSelecionado || !templateSelecionado) return;

  const resultado = await gerarDocumento(
    convertToDocumentoTemplate(templateSelecionado),
    associadoSelecionado.id,
    { 
      modo, 
      salvarHistorico,
      retornarBytes: salvarHistorico // Para poder salvar no storage
    }
  );
  
  // Se salvou historico, exibir mensagem de sucesso
  if (salvarHistorico && resultado?.documentoGeradoId) {
    toast.success('Documento salvo no historico!');
  }
};
```

---

## Resumo das Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/hooks/useGerarDocumento.ts` | Modificar | Implementar salvarHistorico com upload para Storage |
| `src/hooks/useDocumentoGerados.ts` | **Novo** | Hook para buscar historico e estatisticas |
| `src/pages/documentos/DocumentosHistorico.tsx` | Modificar | Remover mocks, usar hooks reais, implementar acoes |
| `src/pages/documentos/GerarDocumento.tsx` | Modificar | Integrar com novo salvarHistorico |

---

## Integracoes Existentes (NAO MEXER)

A area Documentos ja possui integracao correta com:

1. **Associados**: Busca para selecao no wizard
2. **Veiculos**: Dados para merge de variaveis
3. **Contratos**: Dados para merge de variaveis
4. **Planos**: Nome do plano para merge
5. **Profiles**: Identificacao de quem gerou
6. **Storage (bucket documentos)**: Ja existe e e usado pelo UploadLogo

**Nao e necessario alterar outras areas do sistema.**

---

## Verificacao Pos-Implementacao

1. Acessar Gerar Documento
2. Selecionar associado real
3. Selecionar template
4. Gerar PDF com "Salvar no historico" marcado
5. Verificar se PDF foi salvo no bucket 'documentos/gerados'
6. Verificar se registro aparece na tabela documento_gerados
7. Acessar Historico de Documentos
8. Verificar se documento gerado aparece na lista
9. Testar acao "Ver PDF" - deve abrir em nova aba
10. Testar acao "Baixar" - deve baixar arquivo
11. Testar filtros de periodo e categoria
12. Verificar estatisticas atualizadas

