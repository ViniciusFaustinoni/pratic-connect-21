

# Correções: Analista de Eventos

## Resultado da Verificação

### 1. Perfil "analista_eventos" -- OK
- Existe no enum `app_role`
- Aparece no dropdown de gestão de usuários com badge dedicada (sky)
- Segue mesma lógica dos outros perfis via `usePermissions`

### 2. Dashboard do Analista -- OK
- Contadores: aguardando, analisados hoje, aprovados mês, reprovados mês
- Usa `useEventosContadores()` que consulta corretamente a tabela sinistros

### 3. Fila de Eventos -- 1 BUG
| Item | Status |
|---|---|
| Lista com status aguardando_analise | OK |
| Cards com nome, placa, tipo, data, regulador | OK |
| Ordenação mais antigo primeiro | OK |
| **Fallback tipo hardcoded "Colisão"** | **BUG (linha 46)** |

### 4. Tela de Análise (Detalhe) -- 2 FALTANDO
| Seção | Status |
|---|---|
| 1 - Associado (nome, CPF, tel, email, plano, categoria, adimplência, tempo, eventos anteriores) | OK |
| 2 - Veículo (placa, marca, modelo, ano, cor, FIPE, chassi, rastreador) | OK |
| 3 - Cronologia (datas, tempo em destaque, alerta 30 dias, alerta 7 dias) | OK |
| 4 - Relato (texto, áudio, local, terceiro) | OK |
| 5 - B.O. (número, resumo, visualizador PDF/imagem) | OK |
| 6 - Fotos Auto Vistoria (grid com zoom) | OK |
| 7 - Vistoria Regulador (fotos, vídeo, tipo dano, descrição, orçamento, total, parecer, recomendação) | OK |
| **7 - Etapas de Reparo selecionadas** | **FALTANDO** |
| 8 - Fotos Vistoria de Adesão (31 fotos para comparação) | OK |
| Accordion colapsáveis | OK |

### 5. Ações
| Item | Status |
|---|---|
| Botão Reprovar (vermelho) | OK |
| Modal: textarea motivo obrigatório | OK |
| Modal: seletor de motivo padrão (5 opções corretas) | OK |
| Edge function: status -> reprovado | OK |
| Edge function: WhatsApp ao associado | OK |
| Edge function: invalidar links ativos | OK |
| Botão Aprovar (verde) | OK |
| Modal: checkbox confirmação | OK |
| Modal: observações opcional | OK |
| Modal: resumo (associado, veículo, FIPE, orçamento) | OK |
| **Modal: cota de coparticipação** | **FALTANDO** |
| Edge function: status -> aprovado | OK |
| Edge function: gerar Link 2 (72h) | OK |
| Edge function: invalidar Link 1 | OK |
| Edge function: WhatsApp com novo link | OK |

---

## 3 Correções Necessárias

### Correção 1 — Fallback tipo na fila (AnalistaEventosFila.tsx)

**Arquivo:** `src/pages/analista-eventos/AnalistaEventosFila.tsx`
**Linha 46:** Trocar `{ev.tipo || 'Colisão'}` por `{ev.tipo?.replace(/_/g, ' ') || 'Evento'}`

### Correção 2 — Exibir etapas de reparo na Seção 7 (EventoAnaliseDetalhe.tsx)

**Arquivo:** `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

Após o bloco de descrição técnica (linha 351) e antes do bloco de orçamento (linha 353), adicionar exibição das etapas de reparo:

```text
{dadosVistoria?.etapas_reparo?.length > 0 && (
  <div className="space-y-2">
    <p className="font-semibold text-xs">Etapas de Reparo</p>
    <div className="flex flex-wrap items-center gap-1">
      {dadosVistoria.etapas_reparo
        .filter((e: any) => typeof e === 'object' ? e.selecionada : true)
        .map((etapa: any, i: number, arr: any[]) => (
          <span key={i} className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {typeof etapa === 'string' ? etapa : etapa.nome}
            </Badge>
            {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
          </span>
        ))}
    </div>
  </div>
)}
```

Isso mostra a sequência visual tipo "Lanternagem -> Pintura -> Polimento -> Lavagem", compatível tanto com o formato antigo (strings) quanto com o novo formato (objetos com id/nome/status).

### Correção 3 — Cota de coparticipação no modal de aprovação (EventoAnaliseDetalhe.tsx)

**Arquivo:** `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

No modal de aprovação (linha 480-487), após o valor FIPE, adicionar a cota calculada. O hook `useEventoAnaliseDetalhe` já retorna o sinistro com `associado.plano`, que contém os dados necessários.

Adicionar dentro do bloco de resumo:

```text
{sinistro.veiculo?.valor_fipe && sinistro.associado?.plano && (
  <p>
    <span className="text-muted-foreground">Cota Copartic.:</span>{' '}
    R$ {Math.max(
      Number(sinistro.veiculo.valor_fipe) * 0.035,
      350
    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
  </p>
)}
```

Nota: O percentual (3.5%) e mínimo (R$350) são valores padrão. Idealmente viriam do plano do associado. Se o plano tiver campos `percentual_coparticipacao` e `valor_minimo_coparticipacao`, a fórmula seria ajustada para usar esses valores.

---

## Arquivos Afetados

| Ação | Arquivo |
|---|---|
| Modificar | `src/pages/analista-eventos/AnalistaEventosFila.tsx` — corrigir fallback tipo |
| Modificar | `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` — adicionar etapas de reparo + cota no modal |
