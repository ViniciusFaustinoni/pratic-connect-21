
# Plano: Mostrar Localização do Rastreador no Modal de Mapa

## Contexto

Atualmente, o modal "Abrir no Mapa" mostra a **localização do endereço do associado** (geocodificação). O usuário quer que mostre a **localização em tempo real do rastreador do veículo**.

---

## Situação Atual

| Modal atual | Problema |
|-------------|----------|
| Mostra endereço do associado (EST CAFUNDA, 725) | Não é a posição real do veículo |
| Usa coordenadas geocodificadas | Deveria usar posição do rastreador |

### Dados Disponíveis

O associado tem um veículo com rastreador instalado:
- **Veículo**: LTB4J74
- **Rastreador**: instalado, com posição real
- **Última posição**: lat -22.79677300 / lng -43.29465800
- **Última comunicação**: 02/02/2026 20:02

---

## Solução

### 1. Expandir Query de Veículos

Adicionar campos de posição do rastreador na query do `useVeiculosDoAssociado`:

```typescript
rastreador:rastreadores(
  id, codigo, numero_serie, imei, plataforma, plataforma_device_id, status,
  ultima_posicao_lat,     // ADICIONAR
  ultima_posicao_lng,     // ADICIONAR
  ultima_comunicacao      // ADICIONAR
)
```

### 2. Atualizar Interface

Expandir `VeiculoComRelacoes` para incluir os novos campos:

```typescript
export interface VeiculoComRelacoes extends Tables<'veiculos'> {
  rastreador?: {
    id: string;
    codigo: string;
    // ... campos existentes
    ultima_posicao_lat: number | null;
    ultima_posicao_lng: number | null;
    ultima_comunicacao: string | null;
  } | null;
}
```

### 3. Modificar Modal no AssociadoDetalhe

Alterar a lógica para usar a posição do rastreador:

- **Fonte de dados**: Primeiro veículo com rastreador instalado e posição disponível
- **Fallback**: Se não houver rastreador/posição, exibir mensagem informativa
- **Display**: Mostrar placa do veículo, última atualização e velocidade (se disponível)

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useAssociados.ts` | **MODIFICAR** | Adicionar campos de posição na query e interface |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | **MODIFICAR** | Alterar modal para usar posição do rastreador |

---

## Implementação Detalhada

### Arquivo: `src/hooks/useAssociados.ts`

**Linha 44-52** - Atualizar interface:
```typescript
export interface VeiculoComRelacoes extends Tables<'veiculos'> {
  rastreador?: {
    id: string;
    codigo: string;
    numero_serie: string | null;
    imei: string | null;
    plataforma: string | null;
    plataforma_device_id: string | null;
    status: string | null;
    ultima_posicao_lat: number | null;
    ultima_posicao_lng: number | null;
    ultima_velocidade: number | null;
    ultima_ignicao: boolean | null;
    ultima_comunicacao: string | null;
  } | null;
}
```

**Linha 310-312** - Expandir query:
```typescript
rastreador:rastreadores(
  id, codigo, numero_serie, imei, plataforma, plataforma_device_id, status,
  ultima_posicao_lat, ultima_posicao_lng, ultima_velocidade, ultima_ignicao, ultima_comunicacao
)
```

### Arquivo: `src/pages/cadastro/AssociadoDetalhe.tsx`

**Nova lógica para buscar veículo com rastreador ativo:**
```typescript
// Encontrar veículo com rastreador e posição disponível
const veiculoComRastreador = veiculos?.find(
  v => v.rastreador?.status === 'instalado' && 
       v.rastreador?.ultima_posicao_lat && 
       v.rastreador?.ultima_posicao_lng
);
```

**Alterar função `handleAbrirMapa`:**
```typescript
const handleAbrirMapa = () => {
  if (!veiculoComRastreador?.rastreador) {
    toast.error('Nenhum veículo com rastreador e posição disponível');
    return;
  }
  
  setCoordenadas({
    lat: veiculoComRastreador.rastreador.ultima_posicao_lat,
    lng: veiculoComRastreador.rastreador.ultima_posicao_lng
  });
  setMapaModalOpen(true);
};
```

**Atualizar modal para exibir dados do veículo:**
```tsx
<DialogTitle className="flex items-center gap-2">
  <MapPin className="h-5 w-5" />
  Localização - {veiculoComRastreador?.placa || associado.nome}
</DialogTitle>

{/* Popup do marcador */}
<Popup>
  <div className="text-center">
    <strong>{veiculoComRastreador?.placa}</strong>
    <p className="text-xs mt-1">
      {veiculoComRastreador?.modelo} - {veiculoComRastreador?.marca}
    </p>
    <p className="text-xs text-muted-foreground mt-1">
      Última atualização: {formatDistanceToNow(...)}
    </p>
  </div>
</Popup>

{/* Rodapé com status do rastreador */}
<p className="text-sm text-muted-foreground text-center">
  🚗 {veiculoComRastreador?.placa} • 
  {veiculoComRastreador?.rastreador?.ultima_ignicao ? '🟢 Ligado' : '🔴 Desligado'} • 
  Atualizado há {formatDistanceToNow(...)}
</p>
```

---

## Fluxo do Usuário

```text
1. Usuário clica em "Abrir no Mapa"
2. Sistema busca veículo com rastreador instalado e posição
   ├─ Encontrou: Abre modal com posição do rastreador
   └─ Não encontrou: Toast "Nenhum veículo com rastreador"
3. Modal exibe mapa com posição real do veículo
4. Marcador mostra placa, modelo, status e última atualização
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Endereço do associado | Posição real do rastreador |
| Coordenadas geocodificadas | Última posição do veículo |
| Nome do associado no título | Placa do veículo no título |
| Sem informação de atualização | "Atualizado há X minutos" |

---

## Tratamento de Erros

- **Associado sem veículo**: Toast informativo + botão desabilitado
- **Veículo sem rastreador**: Toast informativo
- **Rastreador sem posição**: Toast "Aguardando primeira comunicação"
