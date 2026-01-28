
# Plano: Campo de Observações do Vistoriador na Etapa Final

## Resumo
Adicionar um campo de texto longo opcional na última etapa da vistoria para que o vistoriador possa registrar observações. Essas observações serão salvas na tabela `vistorias` e exibidas ao analista de cadastro durante a análise da proposta.

## Análise Atual

### O que já existe:
- Campo `observacoes` (text) já existe na tabela `vistorias`
- O hook `useAprovarVeiculoVistoria` já aceita `observacoes` como parâmetro opcional
- O hook salva as observações no banco ao aprovar a vistoria (linha 63-65 de `useVistoriaCompleta.ts`)

### O que falta:
- Campo de input na interface do vistoriador
- Buscar o campo `observacoes` na query de propostas pendentes
- Exibir as observações na tela de análise do analista de cadastro

---

## Implementação

### 1. Tela do Vistoriador: `ExecutarVistoriaCompleta.tsx`

**Adicionar estado para observações:**
```typescript
const [observacoes, setObservacoes] = useState('');
```

**Adicionar Textarea antes da seção de vídeo 360°:**
```tsx
{/* Observações do Vistoriador (opcional) */}
<Card className="border-slate-700 bg-slate-800">
  <CardHeader className="pb-2">
    <CardTitle className="flex items-center gap-2 text-base text-white">
      <MessageSquare className="h-5 w-5 text-amber-400" />
      Observações (opcional)
    </CardTitle>
  </CardHeader>
  <CardContent>
    <Textarea
      placeholder="Registre qualquer observação relevante sobre o veículo ou a vistoria..."
      value={observacoes}
      onChange={(e) => setObservacoes(e.target.value)}
      className="resize-none border-slate-600 bg-slate-900 text-white min-h-[100px]"
      rows={4}
    />
    <p className="text-xs text-slate-400 mt-2">
      Essas observações serão visíveis para o analista de cadastro.
    </p>
  </CardContent>
</Card>
```

**Passar observações para o hook de aprovação (linha 127-133):**
```typescript
await aprovarVeiculo.mutateAsync({
  vistoriaId,
  instalacaoId,
  veiculoId: veiculo.id,
  associadoId: associado.id,
  hodometro: parseInt(hodometro),
  observacoes: observacoes.trim() || undefined, // <-- Adicionar
});
```

---

### 2. Interface VistoriaInfo: `usePropostasPendentes.ts`

**Modificar a interface (linha 27-33):**
```typescript
export interface VistoriaInfo {
  id: string;
  status: string;
  tipo: string;
  modalidade?: string;
  fotos: VistoriaFotoInfo[];
  observacoes?: string | null; // <-- Adicionar
  km_atual?: number | null;    // <-- Adicionar (útil mostrar o hodômetro também)
}
```

**Modificar a query de busca de vistoria (linha 270-276):**
```typescript
const { data: vistoriaData } = await supabase
  .from('vistorias')
  .select('id, status, modalidade, observacoes, km_atual') // <-- Adicionar campos
  .eq('contrato_id', contrato.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

**Propagar os campos ao montar o objeto vistoria (linha 286-294):**
```typescript
vistoria = {
  id: vistoriaData.id,
  status: vistoriaData.status || 'pendente',
  tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
  modalidade: vistoriaData.modalidade || undefined,
  fotos: fotosVistoria as VistoriaFotoInfo[],
  observacoes: vistoriaData.observacoes,   // <-- Adicionar
  km_atual: vistoriaData.km_atual,         // <-- Adicionar
};
```

---

### 3. Card de Observações: Novo componente `VistoriaObservacoesCard.tsx`

Criar componente dedicado para exibir observações do vistoriador:

```tsx
// src/components/cadastro/VistoriaObservacoesCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Gauge } from 'lucide-react';

interface VistoriaObservacoesCardProps {
  observacoes?: string | null;
  kmAtual?: number | null;
}

export function VistoriaObservacoesCard({ observacoes, kmAtual }: VistoriaObservacoesCardProps) {
  if (!observacoes && !kmAtual) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-base">
          <MessageSquare className="h-5 w-5 text-amber-500" />
          Observações do Vistoriador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {kmAtual && (
          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Hodômetro:</span>
            <span className="font-semibold">{kmAtual.toLocaleString('pt-BR')} km</span>
          </div>
        )}
        {observacoes && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {observacoes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### 4. Tela de Análise: `PropostaAnalise.tsx`

**Adicionar import:**
```typescript
import { VistoriaObservacoesCard } from '@/components/cadastro/VistoriaObservacoesCard';
```

**Renderizar o card após VistoriaFotosCard (linha ~635):**
```tsx
{/* Fotos da Vistoria */}
{proposta.vistoria && (
  <VistoriaFotosCard 
    fotos={proposta.vistoria.fotos || []} 
    vistoriaStatus={proposta.vistoria.status}
    modalidade={proposta.vistoria.modalidade}
  />
)}

{/* Observações do Vistoriador */}
{proposta.vistoria && (proposta.vistoria.observacoes || proposta.vistoria.km_atual) && (
  <VistoriaObservacoesCard 
    observacoes={proposta.vistoria.observacoes}
    kmAtual={proposta.vistoria.km_atual}
  />
)}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Adicionar Textarea + estado + passar para hook |
| `src/hooks/usePropostasPendentes.ts` | Adicionar `observacoes` e `km_atual` na interface e query |
| `src/components/cadastro/VistoriaObservacoesCard.tsx` | **Criar** - Novo componente |
| `src/pages/cadastro/PropostaAnalise.tsx` | Renderizar novo card |

---

## Fluxo Final

1. **Vistoriador** preenche (opcionalmente) o campo de observações na última etapa da vistoria
2. Ao clicar em "Aprovar", as observações são salvas junto com o hodômetro na tabela `vistorias`
3. **Analista de Cadastro** abre a proposta e vê um card destacado com as observações do vistoriador
4. O card mostra tanto o hodômetro registrado quanto as observações em formato de texto formatado

---

## Comportamento do Campo

- **Opcional**: O vistoriador pode deixar em branco
- **Texto longo**: Textarea com mínimo de 4 linhas
- **Placeholder**: "Registre qualquer observação relevante sobre o veículo ou a vistoria..."
- **Indicação visual**: Texto explicativo informando que será visível ao analista
- **Posição**: Antes do card de vídeo 360°, depois das fotos

---

## Considerações Técnicas

- O campo `observacoes` já existe na tabela `vistorias` (tipo `text`)
- O hook `useAprovarVeiculoVistoria` já salva observações (linha 63-65)
- Não é necessária migração de banco de dados
- O card de observações só é renderizado se houver dados (null-safe)
