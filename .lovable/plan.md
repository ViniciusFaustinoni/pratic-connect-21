
# Plano de Implementação Completo: Vistoria de Manutenção

## Visao Geral

Este plano implementa TODAS as lacunas identificadas no diagnóstico do fluxo de Vistoria de Manutenção, seguindo o mapa de decisões completo com seus 18 desfechos possíveis.

---

## Resumo das Lacunas a Implementar

| # | Lacuna | Prioridade |
|---|--------|------------|
| 1 | Notificação WhatsApp no agendamento (TODO) | Alta |
| 2 | Template de notificação para manutenção | Alta |
| 3 | Checklist de verificação na tela do técnico | Média |
| 4 | Upload de fotos do reparo na manutenção | Média |
| 5 | Rota da página ManutencaoInterna (faltando no App.tsx) | Alta |
| 6 | PermissionGate na tela de Manutenção Interna | Média |
| 7 | Controle de 48h para não comparecimento BASE | Baixa |

---

## Fase 1: Infraestrutura de Notificações

### 1.1 Adicionar Templates de Manutenção na Edge Function

**Arquivo:** `supabase/functions/disparar-notificacao/index.ts`

Adicionar novo grupo de templates "manutencao" com os subtipos:

```typescript
manutencao: {
  agendada: {
    titulo: '🔧 Manutenção Agendada',
    mensagem: 'Sua manutenção de rastreador foi agendada para {data} ({periodo}). Local: {local}. Técnico: {tecnico}.',
    prioridade: 'alta'
  },
  lembrete_24h: {
    titulo: '⏰ Lembrete: Manutenção Amanhã',
    mensagem: 'Lembrete: Sua manutenção de rastreador está agendada para amanhã ({data}) no período da {periodo}.',
    prioridade: 'alta'
  },
  tecnico_caminho: {
    titulo: '🚗 Técnico a Caminho',
    mensagem: 'O técnico {tecnico} está a caminho para realizar a manutenção do seu rastreador. Contato: {telefone_tecnico}.',
    prioridade: 'alta'
  },
  concluida: {
    titulo: '✅ Manutenção Concluída',
    mensagem: 'A manutenção do rastreador do veículo {placa} foi concluída com sucesso!',
    prioridade: 'normal'
  },
  protecao_suspensa: {
    titulo: '⚠️ Proteção Suspensa',
    mensagem: 'ATENÇÃO: Sua proteção (roubo, furto e colisão) foi suspensa devido ao não comparecimento na manutenção agendada. Entre em contato para regularizar.',
    prioridade: 'urgente'
  },
  reagendada: {
    titulo: '📅 Manutenção Reagendada',
    mensagem: 'Sua manutenção foi reagendada para {data} ({periodo}). Local: {local}.',
    prioridade: 'alta'
  }
}
```

Também adicionar tipo "manutencao" no interface NotificacaoRequest.

### 1.2 Implementar Disparo de Notificação no Hook de Agendamento

**Arquivo:** `src/hooks/useVistoriaManutencao.ts`

Na mutation `useAgendarVistoriaManutencao`, substituir o `// TODO` por chamada real:

```typescript
// Linha ~428-431, substituir:
if (params.notificarWhatsApp) {
  console.log('[useAgendarVistoriaManutencao] Notificação WhatsApp pendente');
}

// Por:
if (params.notificarWhatsApp) {
  // Buscar dados do serviço para notificação
  const { data: servicoData } = await supabase
    .from('servicos')
    .select(`
      associado_id,
      veiculo:veiculos(placa),
      profissional:profiles!servicos_profissional_id_fkey(nome, telefone)
    `)
    .eq('id', params.servicoId)
    .single();

  if (servicoData?.associado_id) {
    const periodoLabel = params.periodo === 'manha' ? 'manhã' : 'tarde';
    const localLabel = params.localTipo === 'base' ? 'Nossa Base' : 'Seu Endereço (Rota)';
    
    await supabase.functions.invoke('disparar-notificacao', {
      body: {
        associado_id: servicoData.associado_id,
        tipo: 'manutencao',
        subtipo: 'agendada',
        dados: {
          data: params.dataAgendada,
          periodo: periodoLabel,
          local: localLabel,
          tecnico: servicoData.profissional?.nome || 'A definir',
          telefone_tecnico: servicoData.profissional?.telefone || '',
          placa: servicoData.veiculo?.placa || '',
        },
        referencia_tipo: 'servico',
        referencia_id: params.servicoId,
      },
    });
  }
}
```

---

## Fase 2: Tela do Técnico - Checklist e Fotos

### 2.1 Adicionar Checklist de Verificação

**Arquivo:** `src/pages/instalador/ExecutarManutencao.tsx`

Adicionar seção de checklist ANTES do botão "Concluir Manutenção":

```tsx
// Novo estado
const [checklistCompleto, setChecklistCompleto] = useState({
  verificouSinal: false,
  verificouBateria: false,
  verificouFisico: false,
  verificouFiacao: false,
});

// Componente de checklist (antes do botão Concluir)
{isEmAndamento && (
  <Card className="border-amber-200">
    <CardHeader className="pb-2">
      <CardTitle className="text-base flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4" />
        Verificações
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {[
        { key: 'verificouSinal', label: 'Verificar sinal GPS/comunicação' },
        { key: 'verificouBateria', label: 'Verificar tensão da bateria' },
        { key: 'verificouFisico', label: 'Verificar estado físico do dispositivo' },
        { key: 'verificouFiacao', label: 'Verificar fiação e conexões' },
      ].map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <Checkbox
            id={item.key}
            checked={checklistCompleto[item.key]}
            onCheckedChange={(checked) => 
              setChecklistCompleto(prev => ({ ...prev, [item.key]: !!checked }))
            }
          />
          <Label htmlFor={item.key} className="text-sm cursor-pointer">
            {item.label}
          </Label>
        </div>
      ))}
    </CardContent>
  </Card>
)}
```

### 2.2 Adicionar Upload de Fotos do Reparo

**Arquivo:** `src/pages/instalador/ExecutarManutencao.tsx`

Adicionar seção de fotos no modal de resultado:

```tsx
// Novos estados
const [fotosReparo, setFotosReparo] = useState<File[]>([]);
const [uploading, setUploading] = useState(false);

// Componente de upload (dentro do modal, antes da descrição)
<div className="space-y-2">
  <Label className="text-sm font-medium">
    Fotos do Reparo (opcional)
  </Label>
  <div className="grid grid-cols-3 gap-2">
    {fotosReparo.map((foto, idx) => (
      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
        <img 
          src={URL.createObjectURL(foto)} 
          alt={`Foto ${idx + 1}`}
          className="w-full h-full object-cover"
        />
        <button
          type="button"
          onClick={() => setFotosReparo(prev => prev.filter((_, i) => i !== idx))}
          className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ))}
    {fotosReparo.length < 3 && (
      <label className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setFotosReparo(prev => [...prev, file]);
          }}
        />
        <Camera className="h-6 w-6 text-muted-foreground" />
      </label>
    )}
  </div>
  <p className="text-xs text-muted-foreground">
    Tire fotos do rastreador após o reparo (máx. 3)
  </p>
</div>
```

Criar função de upload e integrar com o `handleConcluirComResultado`:

```typescript
const uploadFotosReparo = async (servicoId: string): Promise<string[]> => {
  const urls: string[] = [];
  for (const foto of fotosReparo) {
    const fileName = `manutencao/${servicoId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage
      .from('vistorias')
      .upload(fileName, foto, { contentType: 'image/jpeg' });
    if (!error) {
      const { data: urlData } = supabase.storage.from('vistorias').getPublicUrl(fileName);
      urls.push(urlData.publicUrl);
    }
  }
  return urls;
};
```

---

## Fase 3: Rota e Permissões da Manutenção Interna

### 3.1 Adicionar Rota no App.tsx

**Arquivo:** `src/App.tsx`

Adicionar import e rota:

```tsx
// Import (linha ~80)
import ManutencaoInterna from "./pages/monitoramento/ManutencaoInterna";

// Rota (dentro das rotas de monitoramento, ~linha 280)
<Route path="manutencao-interna" element={<ManutencaoInterna />} />
```

### 3.2 Adicionar PermissionGate na Página

**Arquivo:** `src/pages/monitoramento/ManutencaoInterna.tsx`

Envolver o conteúdo com PermissionGate:

```tsx
// Linha 114, envolver o return com:
return (
  <PermissionGate 
    allowedRoles={['diretor', 'coordenador_monitoramento']}
    fallback={
      <div className="p-6 text-center text-muted-foreground">
        Acesso restrito a Coordenador de Monitoramento e Diretor.
      </div>
    }
  >
    <div className="min-h-screen">
      {/* ... conteúdo existente ... */}
    </div>
  </PermissionGate>
);
```

---

## Fase 4: Ajustes na Lógica de Negócio

### 4.1 Disparar Notificação ao Suspender Proteção

**Arquivo:** `src/hooks/useVistoriaManutencao.ts`

Na mutation `useCancelarVistoriaManutencao`, após suspender proteção:

```typescript
// Linha ~793-795, após setar protecao_suspensa = true:
if (suspenderProtecao && servico?.associado_id) {
  // Notificar associado sobre suspensão
  await supabase.functions.invoke('disparar-notificacao', {
    body: {
      associado_id: servico.associado_id,
      tipo: 'manutencao',
      subtipo: 'protecao_suspensa',
      dados: {},
      referencia_tipo: 'servico',
      referencia_id: servicoId,
      forcar_envio: true, // Ignora preferências - é crítico
    },
  });
}
```

### 4.2 Disparar Notificação ao Concluir Manutenção

**Arquivo:** `src/hooks/useVistoriaManutencao.ts`

Na mutation `useRegistrarResultadoManutencao`, após sucesso:

```typescript
// Após linha ~520 (serviço concluído com sucesso):
// Notificar associado
const { data: servicoNotif } = await supabase
  .from('servicos')
  .select('associado_id, veiculo:veiculos(placa)')
  .eq('id', params.servicoId)
  .single();

if (servicoNotif?.associado_id) {
  await supabase.functions.invoke('disparar-notificacao', {
    body: {
      associado_id: servicoNotif.associado_id,
      tipo: 'manutencao',
      subtipo: 'concluida',
      dados: {
        placa: servicoNotif.veiculo?.placa || '',
      },
      referencia_tipo: 'servico',
      referencia_id: params.servicoId,
    },
  });
}
```

---

## Fase 5: Menu de Navegação

### 5.1 Adicionar Link para Manutenção Interna no Menu

**Arquivo:** `src/components/layout/nav-items.ts` (ou similar)

Adicionar item no menu de Monitoramento:

```typescript
{
  title: 'Manutenção Interna',
  href: '/monitoramento/manutencao-interna',
  icon: Settings,
  roles: ['diretor', 'coordenador_monitoramento'],
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/disparar-notificacao/index.ts` | Adicionar templates de "manutencao" |
| `src/hooks/useVistoriaManutencao.ts` | Implementar disparo de notificações |
| `src/pages/instalador/ExecutarManutencao.tsx` | Adicionar checklist e upload de fotos |
| `src/App.tsx` | Adicionar rota `/monitoramento/manutencao-interna` |
| `src/pages/monitoramento/ManutencaoInterna.tsx` | Adicionar PermissionGate |
| `src/components/layout/Sidebar.tsx` ou nav config | Adicionar link no menu |

---

## Fluxo de Testes Recomendados

1. **Abertura**: Abrir manutenção de rastreador instalado, verificar se status muda para "manutencao"
2. **Agendamento**: Agendar com notificação WhatsApp, verificar se template é enviado
3. **Execução Técnico**: Entrar na tela, preencher checklist, tirar fotos
4. **Resultado Resolvido**: Concluir como resolvido, verificar status volta para "instalado"
5. **Resultado Substituição**: Testar troca de rastreador, verificar destino do antigo
6. **Não Compareceu BASE**: Marcar não compareceu, cancelar com suspensão, verificar notificação
7. **Manutenção Interna**: Acessar tela, testar triagem, encaminhar para plataforma, registrar laudo

---

## Ordem de Implementação Sugerida

1. Templates de notificação (Edge Function)
2. Rota da Manutenção Interna (App.tsx)
3. PermissionGate na tela interna
4. Disparo de notificações nos hooks
5. Checklist na tela do técnico
6. Upload de fotos
7. Link no menu

