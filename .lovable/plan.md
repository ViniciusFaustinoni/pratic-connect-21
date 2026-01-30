
# Plano: Pular Etapa de Fotos para Sinistros de Roubo/Furto

## Problema Identificado

Quando o associado seleciona **Roubo** ou **Furto** no wizard de criação de sinistro, o sistema ainda exibe a etapa 4 "Envie fotos" solicitando fotos dos danos do veículo. Isso não faz sentido porque:

1. O veículo **não está mais** com o associado (foi roubado/furtado)
2. Não há como fotografar "danos" ou "detalhes do veículo"
3. O texto "Fotografe os danos e o local da ocorrência" é confuso neste contexto

## Solução

Modificar a lógica de navegação do wizard para **pular automaticamente a etapa de fotos** quando o tipo de sinistro for `roubo` ou `furto`:

```text
FLUXO ATUAL (6 etapas para todos):
Tipo → Data/Local → Descrição → Fotos → B.O. → Confirmação

FLUXO PROPOSTO:
- Colisão, Incêndio, etc: Tipo → Data/Local → Descrição → Fotos → B.O. → Confirmação (6 etapas)
- Roubo/Furto:           Tipo → Data/Local → Descrição → B.O. → Confirmação (5 etapas)
                                                          ↑
                                                    Pula etapa de fotos
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/app/NovoSinistro.tsx` | Pular etapa 4 (fotos) para roubo/furto, ajustar navegação e contagem |
| `src/pages/app/AppSinistroNovo.tsx` | Mesma lógica - pular etapa de fotos para roubo/furto |

## Detalhamento Técnico

### 1. `NovoSinistro.tsx`

**a) Criar constante para verificar se é roubo/furto:**
```typescript
const isRouboOuFurto = tipoSelecionado === 'roubo' || tipoSelecionado === 'furto';
```

**b) Ajustar o total de etapas dinamicamente:**
```typescript
// Total de etapas: 6 normal, 5 para roubo/furto (pula fotos)
const totalEtapas = isRouboOuFurto ? 5 : 6;
const progressoPercentual = (etapa / totalEtapas) * 100;
```

**c) Modificar navegação `avancarEtapa`:**
```typescript
const avancarEtapa = () => {
  if (etapa === totalEtapas) {
    handleEnviar();
  } else if (etapa === 3 && isRouboOuFurto) {
    // Pular etapa 4 (fotos) - ir direto para B.O.
    setEtapa(5);
  } else {
    setEtapa(e => e + 1);
  }
};
```

**d) Modificar navegação `voltarEtapa`:**
```typescript
const voltarEtapa = () => {
  if (etapa === 1) {
    navigate('/app/sinistros');
  } else if (etapa === 5 && isRouboOuFurto) {
    // Ao voltar do B.O., pular fotos - ir para descrição
    setEtapa(3);
  } else {
    setEtapa(e => e - 1);
  }
};
```

**e) Atualizar indicador de progresso no header:**
```typescript
<span className="text-sm text-muted-foreground">
  Etapa {isRouboOuFurto && etapa > 3 ? etapa - 1 : etapa} de {totalEtapas}
</span>
```

### 2. `AppSinistroNovo.tsx`

Aplicar a mesma lógica:

**a) Verificar tipo:**
```typescript
const isRouboOuFurto = tipoSelecionado === 'roubo' || tipoSelecionado === 'furto';
```

**b) Ajustar total de etapas:**
```typescript
const totalEtapas = isRouboOuFurto ? 4 : 5;
```

**c) Modificar navegação para pular etapa 4:**
- Se etapa 3 → avançar → pular para etapa 5 (confirmação)
- Se etapa 5 → voltar → pular para etapa 3 (descrição)

## Comportamento Esperado Após Mudança

**Para Roubo/Furto:**
```text
Etapa 1: Tipo de sinistro (seleciona Roubo)
Etapa 2: Quando e onde? (data/local)
Etapa 3: Descrição
Etapa 4: Boletim de Ocorrência (obrigatório) ← vai direto para cá
Etapa 5: Confirmação
```

**Para outros tipos (Colisão, Incêndio, etc):**
```text
Etapa 1: Tipo de sinistro
Etapa 2: Quando e onde?
Etapa 3: Descrição
Etapa 4: Fotos ← continua exibindo
Etapa 5: Boletim de Ocorrência
Etapa 6: Confirmação
```

## Tempo Estimado

~15 minutos
