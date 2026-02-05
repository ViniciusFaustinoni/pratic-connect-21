

## Obrigatoriedade de Localização na Autovistoria

### Análise do Estado Atual

Após exploração do código, identifiquei:

1. **Tabela `vistorias`** já possui as colunas `endereco_latitude` e `endereco_longitude` (adicionadas na migration `20260119132829`)
2. **Componente Autovistoria** (`src/components/associado/Autovistoria.tsx`) coleta fotos, mas **NÃO coleta localização**
3. **Página AnaliseVistoria** (`src/pages/cadastro/AnaliseVistoria.tsx`) é onde o analista de cadastro revisa as vistorias
4. Hook `useCriarAutovistoria` cria o registro na tabela vistorias, mas não passa dados de localização

### Solução Proposta

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   FLUXO DE AUTOVISTORIA COM LOCALIZAÇÃO                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ANTES: Autovistoria                                                    │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ Foto 1 de 6: Frente          ────────────────────────────   │        │
│  │ [Tirar Foto]   [Anterior] [Próxima]                         │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                         │
│  DEPOIS: Autovistoria com Localização                                   │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ Foto 1 de 6: Frente          ────────────────────────────   │        │
│  │ [Tirar Foto]   [Anterior] [Próxima]                         │        │
│  │                                                              │        │
│  │ ⚠️ OBRIGATÓRIO: Compartilhar Localização                    │        │
│  │ Permitir acesso ao GPS? [ Permitir ] [ Negar ]             │        │
│  │ Localização: São Paulo, SP (lat: -23.5505, long: -46.6333) │        │
│  │ Precisão: ≈ 15m                                             │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                         │
│  Após conclusão → Salva em banco:                                       │
│  vistorias.endereco_latitude = -23.5505                                │
│  vistorias.endereco_longitude = -46.6333                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│          ANALISTA DE CADASTRO VÊ A LOCALIZAÇÃO NA ANÁLISE               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Análise de Vistoria                                                    │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ 📍 LOCALIZAÇÃO DA VISTORIA                                  │        │
│  │ ├─ Latitude: -23.5505                                       │        │
│  │ ├─ Longitude: -46.6333                                      │        │
│  │ ├─ Precisão: ~15m                                           │        │
│  │ └─ [Ver no Mapa 🗺️]  [Copiar Coordenadas]                  │        │
│  │                                                              │        │
│  │ Dados do Cliente / Veículo / Fotos / Checklist...           │        │
│  │                                                              │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes a Criar/Modificar

#### 1. Criar Componente `LocationCapture.tsx`

Novo componente de captura de localização que:
- Usa `navigator.geolocation` para capturar GPS (como já existe em `LocationButton.tsx`)
- Torna obrigatório compartilhar a localização
- Mostra erro se GPS negado
- Exibe coordenadas capturadas
- Retorna `{ latitude, longitude, accuracy }`

#### 2. Modificar `Autovistoria.tsx`

Adicionar seção após a primeira foto ou antes de finalizar:
- Incluir componente de captura de localização
- Estado para armazenar coordenadas: `const [coordenadas, setCoordenadas] = useState<{latitude: number; longitude: number} | null>(null);`
- Bloquear conclusão se não houver localização capturada
- Passar coordenadas ao hook `useCriarAutovistoria` quando iniciar a vistoria

#### 3. Modificar Hook `useCriarAutovistoria`

Ajustar para aceitar parâmetro de coordenadas:
```typescript
export function useCriarAutovistoria() {
  return useMutation({
    mutationFn: async ({ 
      contratoId, 
      veiculoId,
      associadoId,
      latitude,     // NOVO
      longitude,    // NOVO
    }: { 
      contratoId: string; 
      veiculoId?: string;
      associadoId: string;
      latitude?: number;
      longitude?: number;
    }) => {
      // ... criar vistoria
      const { data: vistoria, error } = await supabase
        .from('vistorias')
        .insert({
          // ... campos existentes
          endereco_latitude: latitude || null,
          endereco_longitude: longitude || null,
        })
```

#### 4. Modificar `AnaliseVistoria.tsx`

Adicionar seção para exibir localização:
- Card chamado "Localização da Vistoria" com:
  - Latitude e longitude exibidas
  - Precisão (se disponível)
  - Botão "Ver no Mapa" que abre Google Maps
  - Botão "Copiar Coordenadas" para copiar ao clipboard
- Posicionar no início da análise (antes das fotos)

#### 5. Criar Integração com Mapa (Opcional)

Adicionar modal com mapa interativo usando Leaflet para visualizar a localização capturada.

### Fluxo Completo

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ FLUXO DE AUTOVISTORIA COM OBRIGAÇÃO DE LOCALIZAÇÃO                       │
└──────────────────────────────────────────────────────────────────────────┘

1. Cliente inicia autovistoria
   ↓
2. Sistema pede: "Permitir acesso à localização?"
   ├─ Cliente permite → Captura GPS
   └─ Cliente nega → Mostrar erro, pedir novamente até permitir
   ↓
3. Cliente tira 6 fotos
   ↓
4. Sistema salva:
   - Todas as 6 fotos em storage
   - Localização (latitude, longitude) na tabela vistorias
   ↓
5. Analista de Cadastro revisa:
   - Vê card de localização no topo
   - Pode clicar em "Ver no Mapa" para verificar coerência
   - Aprova/reprova com ressalvas/reprovada
   ↓
```

### Rubricas de Decisão

1. **Implementação**: Modificar componente para capturar GPS obrigatoriamente
2. **Armazenamento**: Passar coordenadas para o banco via hook modificado
3. **Visualização**: Exibir localização na tela de análise do cadastro
4. **UX**: Validação clara se GPS negado, mostrar precisão capturada

### Considerações Técnicas

- **GPS já implementado**: O `LocationButton.tsx` já existe e pode ser reutilizado
- **Colunas já existem**: Tabela `vistorias` já tem `endereco_latitude` e `endereco_longitude`
- **Responsividade**: O componente funciona em mobile (web e Progressive Web App)
- **Permissões**: Navegador pede permissão automaticamente ao chamar `navigator.geolocation`
- **Privacidade**: Coordenadas são salvas apenas após consentimento do usuário

