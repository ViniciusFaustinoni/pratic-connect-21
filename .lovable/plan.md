# Plano final — Adesão sem rastreador (carro <30k / moto <9k, não-Diesel)

> **Funcionalidade já existe parcialmente.** Esqueleto pronto (`dispensa_rastreador`, `exige_etapa_instalacao`, autovistoria, vistoria agendada). Faltam ajustes pontuais para paridade total com o fluxo ≥30k/9k.

---

## Como deve ficar na prática

Para qualquer adesão (≥30k ou <30k), o cliente recebe o link público e **sempre escolhe entre 2 caminhos**:

```text
                    [ LINK PÚBLICO ]
                          │
            ┌─────────────┴─────────────┐
            │                           │
     AUTOVISTORIA                VISTORIA PRESENCIAL
   (cliente faz pelo cel)        (técnico vai até ele)
   2 fotos + 1 vídeo                fotos completas
            │                           │
       Aprovação                   Aprovação
       Monitoramento               Monitoramento
            │                           │
   ✓ Ativa R&F                    ✓ Ativa R&F
   ✗ Cobertura total              ✓ Cobertura total
     pendente                       (proteção principal)
            │                           │
            └─── ≥30k/9k: precisa ──────┤
                 técnico instalar       │
                 rastreador depois      │
                                        │
            └─── <30k/9k: técnico ──────┘
                 só tira fotos
                 (sem instalação)
```

**A única diferença real entre ≥30k e <30k é o que o técnico faz na vistoria presencial:**
- ≥30k/9k → tira fotos **e** instala rastreador
- <30k/9k → tira **só** fotos (sem equipamento)

Tudo o mais é igual: autovistoria, agendamento, atribuição, aprovação manual no Monitoramento, ativação via `ativar-associado`, SGA.

---

## Os 2 caminhos em detalhe

### Caminho A — Autovistoria (rápido, ativa só R&F)
1. Cliente abre link, escolhe "Autovistoria".
2. Tira **2 fotos + 1 vídeo** pelo celular (componente `Autovistoria.tsx` já existe).
3. Mídias entram em `em_analise` no Monitoramento.
4. Aprovação manual → **`cobertura_roubo_furto = true`** (se plano inclui R&F).
5. **`cobertura_total` continua `false`** — para ativar precisa da vistoria presencial depois.
6. Veículo continua `instalacao_pendente` para a etapa de cobertura total.

### Caminho B — Vistoria presencial (ativa cobertura total)
1. Cliente escolhe "Agendar Vistoria".
2. Técnico vai até ele.
   - **≥30k/9k:** tira fotos + instala rastreador.
   - **<30k/9k:** tira só fotos (link mostra só a etapa de fotos, etapa "Instalar" oculta).
3. Mídias entram em `em_analise` no Monitoramento.
4. Aprovação manual → ativa **R&F** (se plano inclui) **e cobertura total**.
5. Veículo vira `ativo`.

---

## Estado atual vs. esperado

| Item | Hoje | Esperado | Ação |
|---|---|---|---|
| Escolha autovistoria/agendada no link público | ✓ existe (`EscolhaVistoria.tsx`) | igual | nenhuma |
| Veículo <30k vê opção de autovistoria | ⚠ a confirmar | deve ver | **verificar e liberar** |
| Vistoria presencial <30k esconde etapa instalação | ✓ existe (`exige_etapa_instalacao=false`) | igual | nenhuma |
| Fotos da vistoria presencial <30k vão para `em_analise` | ✗ auto-aprova | **manual** | **corrigir** |
| Veículo <30k já fica `ativo` na aprovação da proposta | ✗ ativa imediato | **`instalacao_pendente`** até vistoria aprovar | **corrigir** |
| Autovistoria ativa só R&F | ✓ existe | igual | nenhuma |
| Vistoria presencial ativa R&F + cobertura total | ✓ existe | igual | nenhuma |
| SGA sem IMEI quando dispensa | ✓ existe | igual | nenhuma |

---

## Mudanças (3 ajustes pontuais)

### 1. `concluir-etapa-fotos-publica`
Remover auto-aprovação quando `exige_etapa_instalacao=false`. Fotos vão para `em_analise` igual aos demais.

### 2. `aprovar-proposta`
Não setar `cobertura_total=true` para veículos `dispensa_rastreador`. Veículo entra em `instalacao_pendente` até a vistoria aprovar (a aprovação dispara `ativar-associado` via trigger já existente).

### 3. `criar-instalacao-pos-pagamento`
Forçar `aguardar_instalacao=true` mesmo com `dispensa_rastreador`.

### 4. UI (pequenos ajustes)
- Garantir que `EscolhaVistoria` aparece no link público também para `dispensa_rastreador=true` (autovistoria + presencial sem instalação).
- Badge "Sem rastreador" no Monitoramento para o operador entender.
- `AtivacaoProgressIcons` opcional: ocultar ícone "Radio" quando dispensa.

### 5. Memória
Atualizar `mem://logic/operations/vistoria-sem-rastreador-flow`:
> "FIPE < 30k carro / 9k moto não-Diesel: mesma jornada do ≥30k (autovistoria OU presencial). Diferença única: na presencial, técnico só fotografa (sem instalar). Aprovação manual obrigatória. R&F ativa após autovistoria; cobertura total só após presencial. SGA enviado sem IMEI."

---

## Arquivos afetados

- `supabase/functions/concluir-etapa-fotos-publica/index.ts`
- `supabase/functions/aprovar-proposta/index.ts`
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- `src/pages/public/VistoriaPublica.tsx` (verificar exibição de `EscolhaVistoria`)
- `src/components/ativacao/AtivacaoProgressIcons.tsx` (opcional)
- `src/pages/monitoramento/Vistorias.tsx` (badge)

Sem migration de schema.

---

Bate com o que você tem em mente? Aprovando, parto para a implementação.
