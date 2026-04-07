

# Plano: Aba "Manutenção" dentro de Serviços de Campo

## Contexto

A pagina "Serviços de Campo" (`VistoriasInstalacoesMon.tsx`) ja agrupa abas de Instalacoes, Vistorias, Retiradas, Encaixes, Viagens e Historico. A nova funcionalidade sera uma **aba adicional** nessa mesma pagina, sem criar rotas ou paginas novas.

A view `view_rastreadores_posicao` ja possui `horas_sem_comunicacao`, `associado_id`, `veiculo_id`, `associado_nome`, `placa`, `modelo`, `marca` — tudo necessario para a listagem.

## Alteracoes

### 1. Banco de dados — tabela `manutencao_tratativas`

Nova tabela para persistir o status de cada tratativa:

```sql
CREATE TABLE manutencao_tratativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES veiculos(id),
  associado_id uuid NOT NULL REFERENCES associados(id),
  rastreador_id uuid REFERENCES rastreadores(id),
  status text NOT NULL DEFAULT 'aguardando_contato'
    CHECK (status IN ('aguardando_contato','em_tratativa','agendado','visita_realizada','resolvido_sem_visita')),
  criado_por uuid REFERENCES profiles(id),
  observacoes text,
  data_agendamento timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

+ RLS para authenticated (select/insert/update)

### 2. Hook `useManutencaoRastreadores.ts`

- Query 1: `view_rastreadores_posicao` com filtro `horas_sem_comunicacao >= 72` e `status = 'instalado'`
- Query 2: `manutencao_tratativas` do periodo selecionado
- Query 3: `sinistros` com `veiculo_id` in lista, status NOT IN (`cancelado`, `encerrado`, `negado`) — flag `temEventoAberto`
- Query 4: `view_inadimplentes` com `associado_id` in lista — flag `inadimplente`
- Merge client-side e calcula metricas dos 4 cards
- Filtros: busca (nome/placa), status, periodo

### 3. Componente `ManutencaoRastreadoresTab.tsx`

Componente lazy-loaded com:
- **4 cards**: Aguardando contato (cinza), Em tratativa (amarelo), Agendados (azul), Concluidos hoje (verde)
- **Filtros**: Input busca + Select status (6 opcoes) + Select periodo (4 opcoes)
- **Tabela**: Associado | Placa | Modelo | Ultimo ponto | Dias sem pontuar | Status (badge colorido) | Acoes
- Botao "Iniciar tratativa":
  - Desabilitado + tooltip "Veiculo com evento em aberto" se `temEventoAberto`
  - Desabilitado + tooltip "Associado inadimplente" se `inadimplente`
  - Azul ativo se elegivel
- Ao clicar, insere registro em `manutencao_tratativas` com status `aguardando_contato` (fluxo completo vem no proximo prompt)

### 4. `VistoriasInstalacoesMon.tsx`

- Importar `ManutencaoRastreadoresTab` via lazy
- Adicionar TabsTrigger "Manutencao" com icone `Settings` apos "Viagens"
- Adicionar TabsContent correspondente

### 5. Sem alteracao no sidebar

A aba fica acessivel dentro de Servicos de Campo — sem novo item de menu.

## Arquivos

- **Criado**: migration SQL
- **Criado**: `src/hooks/useManutencaoRastreadores.ts`
- **Criado**: `src/components/monitoramento/manutencao-rastreadores/ManutencaoRastreadoresTab.tsx`
- **Modificado**: `src/pages/monitoramento/VistoriasInstalacoesMon.tsx`

