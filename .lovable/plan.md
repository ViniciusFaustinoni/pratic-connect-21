
# Plano: Completar Gerador de Termo de Afiliação

## Diagnóstico do Problema

Ao analisar o código, identifiquei a origem do problema:

| Local | Arquivo | Termo 0KM | Termo Rastreador |
|-------|---------|-----------|------------------|
| **Frontend** | `src/components/cadastro/TermoFiliacaoTemplate.tsx` | Presente | Presente |
| **Backend (Autentique)** | `supabase/functions/_shared/termo-afiliacao-template.ts` | Presente | **FALTA** |

O PDF que você gerou via Autentique veio do template do **backend**, que não possui o "Termo de Responsabilidade do Rastreador".

---

## Solução

Adicionar ao template do backend (`termo-afiliacao-template.ts`) a seção condicional do **Termo de Responsabilidade do Rastreador**, que aparecerá quando:
- Veículo for a **diesel** (qualquer valor)
- **Carro** com valor FIPE > R$ 20.000
- **Moto** com valor FIPE > R$ 9.000

---

## Implementação Técnica

### Arquivo a Modificar

`supabase/functions/_shared/termo-afiliacao-template.ts`

### Mudanças

1. **Adicionar função auxiliar** `exigeRastreador` para determinar obrigatoriedade
2. **Criar função** `generateSecaoRastreador` com as 6 cláusulas do comodato
3. **Modificar função principal** `generateTermoAfiliacao` para incluir a nova seção

---

## Nova Seção a Adicionar

```typescript
// Verifica se rastreador é obrigatório
const exigeRastreador = (veiculo: any): { exige: boolean; motivo: string | null } => {
  // Diesel sempre exige
  if (veiculo.combustivel?.toLowerCase() === 'diesel') {
    return { exige: true, motivo: 'Veículo a diesel' };
  }
  
  const valorFipe = veiculo.valor_fipe || 0;
  const categoria = (veiculo.categoria || '').toLowerCase();
  const isMoto = categoria.includes('moto') || categoria.includes('ciclomotor');
  
  // Moto > R$ 9.000
  if (isMoto && valorFipe > 9000) {
    return { exige: true, motivo: 'Valor FIPE acima de R$ 9.000' };
  }
  
  // Carro > R$ 20.000
  if (!isMoto && valorFipe > 20000) {
    return { exige: true, motivo: 'Valor FIPE acima de R$ 20.000' };
  }
  
  return { exige: false, motivo: null };
};
```

### Conteúdo do Termo de Responsabilidade do Rastreador

```text
+------------------------------------------------------------------+
| TERMO DE RESPONSABILIDADE - EQUIPAMENTO RASTREADOR               |
| (Anexo ao Termo de Afiliação Nº XXXX)                            |
+------------------------------------------------------------------+
|                                                                  |
| Pelo presente termo, o(a) associado(a) abaixo qualificado(a)     |
| declara ter recebido em regime de COMODATO o equipamento         |
| rastreador para instalação no veículo cadastrado.                |
|                                                                  |
| 1. DO EQUIPAMENTO                                                |
| O equipamento é de propriedade exclusiva da ABP PraticCar,       |
| sendo cedido em comodato durante a vigência da filiação.         |
|                                                                  |
| 2. DO RASTREAMENTO                                               |
| O associado autoriza o rastreamento 24 horas do veículo          |
| para fins de monitoramento e recuperação em caso de sinistro.    |
|                                                                  |
| 3. DA DEVOLUÇÃO                                                  |
| O associado compromete-se a devolver o equipamento em perfeito   |
| estado quando do desligamento do PSM, no prazo de 15 dias.       |
|                                                                  |
| 4. DA MULTA                                                      |
| A não devolução acarretará multa de R$ 400,00.                   |
|                                                                  |
| 5. DO TÍTULO EXECUTIVO                                           |
| O presente termo tem força de título executivo extrajudicial,    |
| nos termos do Art. 784 do Código de Processo Civil.              |
|                                                                  |
| 6. DA OBRIGATORIEDADE                                            |
| A instalação do rastreador é CONDIÇÃO OBRIGATÓRIA para início    |
| da proteção, conforme regras do PSM para veículos com FIPE       |
| superior aos limites estabelecidos ou movidos a diesel.          |
|                                                                  |
| [Assinatura do Associado]                                        |
+------------------------------------------------------------------+
```

---

## Ordem das Seções no Documento Final

```text
1. Cabeçalho (Logo, CNPJ, Número do Termo)
2. Qualificação do Associado
3. Veículo Protegido
4. [CONDICIONAL] Termo Aditivo 0KM       ← Se placa vazia/000
5. [CONDICIONAL] Termo Rastreador        ← Se FIPE > limite ou diesel
6. Plano e Coberturas
7. Valores e Pagamento
8. Declarações do Associado
9. Proteção de Dados (LGPD)
10. Disposições Finais
11. Assinatura
12. Rodapé
```

---

## Modificação na Função Principal

```typescript
export function generateTermoAfiliacao(data: TermoAfiliacaoData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Afiliação - ${data.contrato.numero}</title>
  ${generateStyles()}
</head>
<body>
  <div class="page">
    ${generateHeader(data)}
    ${generateSecao1(data)}
    ${generateSecao2(data)}
    ${generateSecaoCarroZero(data)}
    ${generateSecaoRastreador(data)}    <!-- NOVO -->
    ${generateSecao3(data)}
    ${generateSecao4(data)}
    ${generateSecao5(data)}
    ${generateSecao6(data)}
    ${generateSecao7()}
    ${generateSecao8(data)}
    ${generateFooter(data)}
  </div>
</body>
</html>
  `;
}
```

---

## Impacto

Após a implementação:

| Documento | Quando Aparece | Páginas |
|-----------|----------------|---------|
| Termo de Afiliação Principal | Sempre | ~6 páginas |
| Termo Aditivo 0KM | Placa vazia ou procedência "Novo" | +1 página |
| Termo Responsabilidade Rastreador | Diesel ou FIPE > limite | +1 página |

**Total estimado:** 6 a 8 páginas dependendo das condições

---

## Testes Necessários

1. Veículo com placa e FIPE < limite → Apenas termo principal
2. Veículo 0KM com FIPE < limite → Termo principal + Aditivo 0KM
3. Veículo com placa e FIPE > limite → Termo principal + Rastreador
4. Veículo 0KM com FIPE > limite → Termo principal + Aditivo 0KM + Rastreador
5. Veículo diesel (qualquer valor) → Termo principal + Rastreador

---

## Estimativa de Tempo

| Tarefa | Tempo |
|--------|-------|
| Adicionar função `exigeRastreador` | 10 min |
| Criar `generateSecaoRastreador` | 20 min |
| Modificar `generateTermoAfiliacao` | 5 min |
| Deploy da edge function | Automático |
| **Total** | **35 min** |

---

## Deploy

A edge function `autentique-create` será reimplantada automaticamente após a modificação do arquivo compartilhado, pois ela importa o template de `termo-afiliacao-template.ts`.
