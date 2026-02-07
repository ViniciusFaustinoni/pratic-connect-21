
# Plano: Corrigir Agendamento de Vistoria de Manutenção

## Problema Identificado

Quando o usuário tenta agendar uma **vistoria de manutenção** pela Fila de Vistorias, o modal `AgendarVistoriaModal` exibe as opções incorretas:
- **Presencial** (vistoriador vai até o cliente)
- **Ponto Fixo** (cliente vai a local parceiro)
- **Auto Vistoria** (cliente faz pelo app)

Porém, para **vistorias de manutenção de rastreadores**, as opções devem ser apenas:
- **Base** — associado leva o veículo até a sede
- **Rota** — técnico vai ao local do associado

## Causa Raiz

Na página `FilaVistorias.tsx`, a função `handleAgendar` sempre abre o `AgendarVistoriaModal` genérico, independente do tipo de vistoria:

```typescript
const handleAgendar = (vistoria: VistoriaFila) => {
  setVistoriaSelecionada({...});
  setAgendarModalOpen(true); // Sempre abre o modal genérico
};
```

O sistema já possui o modal correto `AgendarManutencaoModal.tsx` que usa `LOCAL_TIPO_OPTIONS` (base/rota), mas ele não está sendo utilizado para vistorias de manutenção.

## Solução

Modificar `FilaVistorias.tsx` para detectar quando a vistoria é do tipo **manutenção** ou **retirada** e abrir o modal específico `AgendarManutencaoModal` em vez do genérico.

## Alterações

### Arquivo: `src/pages/monitoramento/FilaVistorias.tsx`

1. **Importar** o `AgendarManutencaoModal` e o tipo `VistoriaManutencao`

2. **Adicionar estados** para controlar o modal de manutenção:
   - `manutencaoModalOpen: boolean`
   - `vistoriaManutencaoSelecionada: VistoriaManutencao | null`

3. **Modificar a função `handleAgendar`** para verificar o tipo:
```typescript
const handleAgendar = (vistoria: VistoriaFila) => {
  // Se for manutenção ou retirada, usar modal específico
  if (vistoria.tipo === 'manutencao' || vistoria.tipo === 'retirada') {
    // Buscar dados completos do serviço e abrir modal específico
    const servico = servicosRaw?.find(s => s.id === vistoria.id);
    if (servico) {
      setVistoriaManutencaoSelecionada(/* mapear dados */);
      setManutencaoModalOpen(true);
      return;
    }
  }
  
  // Para outros tipos, continuar com modal genérico
  setVistoriaSelecionada({...});
  setAgendarModalOpen(true);
};
```

4. **Renderizar o modal** de manutenção no final do componente

## Resultado Esperado

- Ao clicar "Agendar" em uma vistoria do tipo **Manutenção** ou **Retirada**, será aberto o modal com opções **Base** e **Rota**
- Para vistorias de entrada normais (cotações), continuará exibindo as opções Presencial/Ponto Fixo/Auto Vistoria
