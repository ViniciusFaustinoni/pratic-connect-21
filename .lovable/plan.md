
# Plano de Implementacao - Vistoria de Manutencao (6 Tarefas)

## Resumo Executivo

Este plano cobre a implementacao de 6 funcionalidades para completar o fluxo de Vistoria de Manutencao:

| Tarefa | Descricao | Complexidade | Tempo Est. |
|--------|-----------|--------------|------------|
| VM-01 | Checklist Tecnico de Manutencao | Media | 30 min |
| VM-02 | Upload de Fotos do Reparo | Media | 45 min |
| VM-03 | Permissoes na Manutencao Interna | Facil | 20 min |
| VM-04 | Modal de Reagendamento Pos-Ausencia | Facil | 25 min |
| VM-05 | Notificacao WhatsApp (Edge Function) | Media | 35 min |
| VM-06 | Status "Reservado" no Enum | Facil | 10 min |

**Total estimado: ~2h45min**

---

## Analise do Estado Atual

### Componentes Existentes que Serao Reutilizados

1. **`ChecklistItem.tsx`** - Ja existe em `src/components/instalador/` com logica de OK/NOK
2. **`FotoCapture.tsx`** - Ja existe com compressao e preview
3. **`usePermissions.ts`** - Hook completo com `isDiretor`, `isCoordenadorMonitoramento`
4. **Bucket `vistorias`** - Ja existe (private) para armazenar fotos

### Colunas que Faltam na Tabela `servicos`

- `checklist_manutencao` (jsonb)
- `fotos_manutencao` (jsonb)
- `whatsapp_notificado` (boolean)
- `whatsapp_notificado_em` (timestamptz)

### Enum `status_rastreador`

Valores atuais: `estoque`, `instalado`, `manutencao`, `baixado`, `retorno_base`, `triagem`, `em_analise_plataforma`, `em_garantia`

**Falta: `reservado`**

---

## VM-01: Checklist Tecnico de Manutencao

### Arquivos a Criar

**`src/components/instalador/ChecklistManutencao.tsx`**

```text
Componente que renderiza 6 itens de verificacao obrigatorios:

ITENS DO CHECKLIST:
1. "Verificar conexao eletrica do rastreador"
   Desc: "Checar fios, conectores e aterramento"
   
2. "Verificar LED de status do equipamento"
   Desc: "LED piscando = OK, apagado = sem energia"
   
3. "Testar sinal GPS"
   Desc: "Verificar se rastreador esta transmitindo posicao"
   
4. "Verificar tensao da bateria do veiculo"
   Desc: "Minimo 12V para funcionamento adequado"
   
5. "Inspecionar estado fisico do rastreador"
   Desc: "Sem sinais de violacao, oxidacao ou dano"
   
6. "Verificar fixacao e posicionamento"
   Desc: "Rastreador bem fixo e em local discreto"

LAYOUT:
- Card com titulo "Checklist de Manutencao" + icone ClipboardCheck
- Barra de progresso no topo: "X de 6 verificacoes"
- Cada item: Checkbox (h-5 w-5) + label bold + descricao menor
- Altura minima 48px por item (touch-friendly)
- Quando todos marcados: borda verde no card

PROPS:
- onComplete: () => void
- disabled: boolean
- checklistData: ChecklistItem[]
- onChecklistChange: (items: ChecklistItem[]) => void
```

### Arquivos a Modificar

**`src/pages/instalador/ExecutarManutencao.tsx`**

```text
ADICIONAR:
1. Import do ChecklistManutencao
2. Estado para controlar checklist:
   - const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
   - const [checklistCompleto, setChecklistCompleto] = useState(false)

3. Renderizar ChecklistManutencao ENTRE informacoes e botao:
   - Condicao: isEmAndamento (apos clicar "Cheguei no Local")
   - Posicao: antes do botao "Concluir Manutencao"

4. Desabilitar botao "Concluir Manutencao":
   - disabled={!checklistCompleto}

5. Passar checklistData para handleConcluirComResultado
```

**`src/hooks/useVistoriaManutencao.ts`**

```text
MODIFICAR useRegistrarResultadoManutencao:

1. Adicionar parametro checklistManutencao ao RegistrarResultadoParams:
   checklistManutencao?: {
     items: Array<{
       id: string;
       label: string;
       checked: boolean;
       checked_at: string;
     }>;
   };

2. No update do servico, adicionar:
   checklist_manutencao: params.checklistManutencao || null
```

### Migracao SQL

```sql
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS checklist_manutencao jsonb DEFAULT NULL;

COMMENT ON COLUMN servicos.checklist_manutencao IS 
'Checklist tecnico preenchido pelo vistoriador durante manutencao';
```

---

## VM-02: Upload de Fotos do Reparo

### Arquivos a Criar

**`src/components/instalador/FotosManutencao.tsx`**

```text
Componente de upload de fotos para evidencia do reparo.

FUNCIONALIDADES:
- Botao "Adicionar Foto" (h-12, centralizado)
- Abre camera (accept="image/*" capture="environment")
- Aceita selecao da galeria
- Minimo 2 fotos obrigatorias, maximo 6
- Grid de previews (grid-cols-3 gap-2)
- Cada preview: 80x80px, border-radius, botao X para remover
- Contador: "X de 2 fotos minimas" (verde quando atingido)
- Compressao: max 800px largura, quality 0.7

CATEGORIAS (label abaixo de cada preview, selecionavel):
- "Rastreador"
- "Fiacao"
- "Painel do veiculo"
- "Geral"

PROPS:
- fotos: FotoManutencao[]
- onFotosChange: (fotos: FotoManutencao[]) => void
- minFotos?: number (default: 2)
- maxFotos?: number (default: 6)
- disabled?: boolean
- obrigatorio?: boolean (default: true)

TIPO FotoManutencao:
{
  file: File;
  preview: string;
  categoria: 'rastreador' | 'fiacao' | 'painel' | 'geral';
}
```

### Arquivos a Modificar

**`src/pages/instalador/ExecutarManutencao.tsx`**

```text
ADICIONAR:
1. Import FotosManutencao
2. Estado para fotos:
   const [fotosManutencao, setFotosManutencao] = useState<FotoManutencao[]>([])

3. Renderizar FotosManutencao DENTRO do modal de resultado:
   - ANTES do botao de confirmar
   - Obrigatorio para 'resolvido' e 'substituicao' (minimo 2)
   - Opcional para 'nao_resolvido'

4. Validacao antes de confirmar:
   if ((resultado === 'resolvido' || resultado === 'substituicao') && fotosManutencao.length < 2) {
     toast.error('Adicione pelo menos 2 fotos do reparo');
     return;
   }

5. Passar fotos para handleConcluirComResultado
```

**`src/hooks/useVistoriaManutencao.ts`**

```text
MODIFICAR useRegistrarResultadoManutencao:

1. Adicionar parametro fotos ao RegistrarResultadoParams:
   fotos?: File[];

2. Fazer upload das fotos ANTES de atualizar servico:
   - Bucket: 'vistorias' (ja existe, private)
   - Path: manutencao/{servicoId}/{timestamp}_{index}.jpg

3. Salvar URLs no update:
   fotos_manutencao: fotosUrls  // array de { url, categoria, uploaded_at }
```

**`src/components/monitoramento/manutencao/RegistrarResultadoModal.tsx`**

```text
ADICIONAR:
1. Import FotosManutencao
2. Estado para fotos
3. Renderizar componente (OPCIONAL para admin)
4. Passar fotos no submit
```

### Migracao SQL

```sql
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS fotos_manutencao jsonb DEFAULT '[]';

COMMENT ON COLUMN servicos.fotos_manutencao IS 
'Fotos do reparo/substituicao [{url, categoria, uploaded_at}]';
```

---

## VM-03: Permissoes na Manutencao Interna

### Arquivos a Modificar

**`src/pages/monitoramento/ManutencaoInterna.tsx`**

```text
ADICIONAR no inicio do componente:

1. Import usePermissions e ShieldAlert
2. Verificacao de permissao:
   const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
   const temAcesso = isDiretor || isCoordenadorMonitoramento;
   const podeDescartar = isDiretor; // SOMENTE diretor pode descartar

3. Early return se nao tem acesso:
   if (!temAcesso) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <Card className="max-w-md">
           <CardContent className="pt-6 text-center">
             <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
             <h2 className="text-lg font-semibold">Acesso Restrito</h2>
             <p className="text-muted-foreground mt-2">
               Apenas Diretores e Coordenadores de Monitoramento podem acessar a Manutencao Interna.
             </p>
           </CardContent>
         </Card>
       </div>
     );
   }

4. No dropdown de acoes, condicionar "Descartar":
   {podeDescartar && item.etapa === 'em_triagem' && (
     <>
       <DropdownMenuSeparator />
       <DropdownMenuItem 
         onClick={() => handleAbrirModal(item, 'descarte')}
         className="text-destructive"
       >
         <Trash2 className="h-4 w-4 mr-2" />
         Descartar
       </DropdownMenuItem>
     </>
   )}
```

**`src/hooks/useManutencaoInterna.ts`**

```text
VERIFICAR/ADICIONAR no useDescartarRastreador:
- Registrar quem descartou:
  descartado_por: user.id
  descartado_em: new Date().toISOString()
```

---

## VM-04: Modal de Reagendamento Pos-Ausencia

### Arquivos a Criar

**`src/components/monitoramento/manutencao/TratarAusenciaModal.tsx`**

```text
Modal especifico para quando associado nao compareceu.

LAYOUT:
+----------------------------------------------+
| ASSOCIADO NAO COMPARECEU              [X]    |
+----------------------------------------------+
| Atencao: O associado nao compareceu          |
|                                              |
| Associado: [nome]                            |
| Veiculo: [modelo - placa]                    |
| Rastreador: [codigo]                         |
| Data agendada: [data]                        |
| Tipo: [Base / Rota]                          |
|                                              |
| ============================================ |
| O QUE DESEJA FAZER?                          |
|                                              |
| (o) Reagendar manutencao                     |
|     Agendar nova data para o associado       |
|                                              |
| (o) Cancelar e SUSPENDER protecao            |
|     Associado ficara SEM protecao contra     |
|     roubo, furto e colisao ate regularizar.  |
|     [!] Esta acao notifica o associado.      |
|                                              |
| Observacao                                   |
| [________________________________]           |
|                                              |
| [Voltar]  [Confirmar]                        |
+----------------------------------------------+

COMPORTAMENTO:
- Se "Reagendar": chama hook para mudar nao_compareceu -> pendente
- Se "Cancelar + Suspender": AlertDialog de confirmacao, depois cancela com suspenderProtecao=true

PROPS:
- open: boolean
- onClose: () => void
- vistoria: VistoriaManutencao | null
```

### Arquivos a Modificar

**`src/pages/monitoramento/VistoriasManutencao.tsx`**

```text
ADICIONAR:
1. Import TratarAusenciaModal
2. Estado para modal:
   const [modalTratarAusencia, setModalTratarAusencia] = useState(false);

3. Handler para abrir:
   const handleTratarAusencia = (vistoria: VistoriaManutencao) => {
     setVistoriaSelecionada(vistoria);
     setModalTratarAusencia(true);
   };

4. Renderizar modal:
   <TratarAusenciaModal 
     open={modalTratarAusencia}
     onClose={() => setModalTratarAusencia(false)}
     vistoria={vistoriaSelecionada}
   />
```

**`src/components/monitoramento/manutencao/ManutencaoTabela.tsx`**

```text
ADICIONAR prop e handler:
- onTratarAusencia?: (vistoria: VistoriaManutencao) => void

No dropdown, para status 'nao_compareceu':
- Substituir "Reagendar" por "Tratar ausencia" que abre o modal especifico
```

**`src/hooks/useVistoriaManutencao.ts`**

```text
ADICIONAR hook useReagendarPosAusencia:

export function useReagendarPosAusencia() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (servicoId: string) => {
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'pendente',
          data_agendada: null,
          periodo: null,
          profissional_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', servicoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-manutencao-metricas'] });
      toast.success('Manutencao reagendada', {
        description: 'Voltou para fila de agendamento.',
      });
    },
  });
}
```

---

## VM-05: Notificacao WhatsApp (Edge Function)

### Arquivos a Criar

**`supabase/functions/notificar-manutencao-whatsapp/index.ts`**

```text
Edge Function para disparar notificacao via n8n.

ENTRADA:
{
  telefone: string,
  nome_associado: string,
  data_agendada: string,
  periodo: 'manha' | 'tarde',
  tipo_local: 'base' | 'rota',
  endereco?: string
}

MENSAGEM BASE:
"Ola {nome}, sua Praticcar informa: foi agendada uma manutencao 
do rastreador do seu veiculo para o dia {data} no periodo da {periodo}. 
Por favor, compareca a nossa sede no endereco: {endereco}. 
Prazo: 48 horas. Em caso de nao comparecimento, as protecoes contra 
roubo, furto e colisao poderao ser suspensas. Duvidas? Entre em contato."

MENSAGEM ROTA:
"Ola {nome}, sua Praticcar informa: foi agendada uma visita tecnica 
para manutencao do rastreador do seu veiculo para o dia {data} no 
periodo da {periodo}. Nosso tecnico ira ate o endereco informado. 
Por favor, esteja disponivel no local. Duvidas? Entre em contato."

LOGICA:
1. Verificar N8N_WEBHOOK_URL_MANUTENCAO
2. Se nao configurada: log warn e retorna { success: false, reason: 'webhook_not_configured' }
3. Montar mensagem conforme tipo_local
4. POST para webhook n8n
5. Retornar { success: true/false }
```

### Arquivos a Modificar

**`src/hooks/useVistoriaManutencao.ts`**

```text
MODIFICAR useAgendarVistoriaManutencao:

SUBSTITUIR o TODO (linha 428-431) por:

if (params.notificarWhatsApp) {
  try {
    // Buscar telefone do associado
    const { data: servicoData } = await supabase
      .from('servicos')
      .select(`
        associado:associados(nome, telefone),
        logradouro, numero, bairro, cidade, uf
      `)
      .eq('id', params.servicoId)
      .single();

    const endereco = servicoData?.logradouro 
      ? `${servicoData.logradouro}, ${servicoData.numero} - ${servicoData.bairro}, ${servicoData.cidade}/${servicoData.uf}`
      : 'Sede Praticcar';

    const { error: notifError } = await supabase.functions.invoke('notificar-manutencao-whatsapp', {
      body: {
        telefone: servicoData?.associado?.telefone,
        nome_associado: servicoData?.associado?.nome,
        data_agendada: params.dataAgendada,
        periodo: params.periodo,
        tipo_local: params.localTipo,
        endereco,
      }
    });
    
    if (notifError) {
      console.error('Erro ao notificar WhatsApp:', notifError);
    } else {
      // Registrar que foi notificado
      await supabase
        .from('servicos')
        .update({
          whatsapp_notificado: true,
          whatsapp_notificado_em: new Date().toISOString(),
        })
        .eq('id', params.servicoId);
    }
  } catch (err) {
    console.error('Falha na notificacao WhatsApp:', err);
    // NAO bloqueia o agendamento
  }
}
```

### Migracao SQL

```sql
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS whatsapp_notificado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notificado_em timestamptz DEFAULT NULL;

COMMENT ON COLUMN servicos.whatsapp_notificado IS 'Se o associado foi notificado via WhatsApp';
COMMENT ON COLUMN servicos.whatsapp_notificado_em IS 'Timestamp da notificacao WhatsApp';
```

---

## VM-06: Status "Reservado" no Enum

### Migracao SQL

```sql
-- Adicionar 'reservado' ao enum status_rastreador
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'reservado' AFTER 'estoque';
```

### Arquivos a Modificar

**`src/types/rastreadores.ts`**

```text
MODIFICAR StatusRastreador (linha 11):

export type StatusRastreador = 
  | 'estoque'
  | 'reservado'           // <-- ADICIONAR
  | 'instalado'
  | 'manutencao'
  | 'retorno_base'
  | 'triagem'
  | 'em_analise_plataforma'
  | 'em_garantia'
  | 'baixado';

ADICIONAR em STATUS_RASTREADOR_LABELS (linha 21):
  reservado: 'Reservado',

ADICIONAR em STATUS_RASTREADOR_COLORS (linha 32):
  reservado: 'bg-yellow-100 text-yellow-800',

MODIFICAR TRANSICOES_STATUS_RASTREADOR:
  estoque: ['reservado', 'instalado', 'manutencao', 'baixado'],
  reservado: ['instalado', 'estoque'],  // <-- ADICIONAR linha
```

**Pagina de Estoque de Rastreadores** (se existir filtro por status):

```text
Adicionar opcao 'reservado' nos filtros de status.
Adicionar card de metrica "Reservados" (icone Clock, cor amarelo).
```

**`src/hooks/useVistoriaManutencao.ts`**

```text
VERIFICAR useRastreadoresParaSubstituicao (linha 853):
- Ja filtra por status = 'estoque'
- 'reservado' NAO sera incluido (correto!)
```

---

## Ordem de Implementacao Recomendada

1. **VM-06** - Status Reservado (10 min) - Migracao simples
2. **VM-03** - Permissoes Manutencao Interna (20 min) - Apenas adicionar guards
3. **VM-01** - Checklist Tecnico (30 min) - Componente novo + integracao
4. **VM-02** - Upload Fotos (45 min) - Componente + storage + integracao
5. **VM-04** - Modal Reagendamento (25 min) - Modal novo + hook
6. **VM-05** - WhatsApp Edge Function (35 min) - Edge function + integracao

---

## Migracoes SQL Consolidadas

```sql
-- VM-01: Checklist
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS checklist_manutencao jsonb DEFAULT NULL;

-- VM-02: Fotos
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS fotos_manutencao jsonb DEFAULT '[]';

-- VM-05: WhatsApp
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS whatsapp_notificado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notificado_em timestamptz DEFAULT NULL;

-- VM-06: Status Reservado
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'reservado' AFTER 'estoque';
```

---

## Arquivos Afetados (Resumo)

| Arquivo | Acao | Tarefas |
|---------|------|---------|
| `src/components/instalador/ChecklistManutencao.tsx` | CRIAR | VM-01 |
| `src/components/instalador/FotosManutencao.tsx` | CRIAR | VM-02 |
| `src/components/monitoramento/manutencao/TratarAusenciaModal.tsx` | CRIAR | VM-04 |
| `supabase/functions/notificar-manutencao-whatsapp/index.ts` | CRIAR | VM-05 |
| `src/pages/instalador/ExecutarManutencao.tsx` | MODIFICAR | VM-01, VM-02 |
| `src/hooks/useVistoriaManutencao.ts` | MODIFICAR | VM-01, VM-02, VM-04, VM-05 |
| `src/pages/monitoramento/ManutencaoInterna.tsx` | MODIFICAR | VM-03 |
| `src/pages/monitoramento/VistoriasManutencao.tsx` | MODIFICAR | VM-04 |
| `src/components/monitoramento/manutencao/ManutencaoTabela.tsx` | MODIFICAR | VM-04 |
| `src/components/monitoramento/manutencao/RegistrarResultadoModal.tsx` | MODIFICAR | VM-02 |
| `src/types/rastreadores.ts` | MODIFICAR | VM-06 |

