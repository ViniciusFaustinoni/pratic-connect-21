## Teste E2E — Atribuição Prestador com seletor de escopo

Vou rodar dois cenários espelhados (mesma fluxo, escopos opostos) e ao final fazer checagem no banco para confirmar o estado canônico.

### Pré-requisitos que vou checar antes de começar

1. Login como diretor (`admin@teste.com`) no preview.
2. Identificar **2 serviços de campo** elegíveis na fila de Atribuição Manual ou no Mapa:
   - **Caso A:** serviço `vistoria_entrada` de sub-FIPE (default sugerido: Somente Fotos).
   - **Caso B:** serviço `instalacao` de veículo que exige rastreador (default sugerido: Fotos + Instalação).
3. Identificar 1 prestador externo ativo com telefone cadastrado.

Se não houver candidatos prontos, paro e peço orientação (não vou criar cotação fake só para testar).

### Cenário A — Sub-FIPE com escopo "Somente Fotos"

**Passo 1.** Monitoramento › Serviços de Campo › Atribuição Manual → abrir o serviço sub-FIPE.
**Passo 2.** Selecionar o prestador. Conferir que o seletor de escopo aparece com **default "Somente Fotos"**.
**Passo 3.** Manter "Somente Fotos" e clicar Gerar Link. Capturar screenshot do dialog de resultado.
**Passo 4.** Abrir o link público gerado em nova aba. Validar visualmente que:
   - Cards de fotos + vídeo 360° aparecem.
   - **NÃO aparece** o card "IMEI do Rastreador Instalado".
   - **NÃO aparece** etapa "Teste de Comunicação".
**Passo 5.** Voltar ao painel — confirmar `servicos.status='agendada'` e `prestador_id` preenchido.

### Cenário B — Mesmo serviço (ou outro elegível) com escopo "Fotos + Instalação"

**Passo 6.** Repetir a partir do Passo 1 em outro serviço, agora **trocando o default** ou pegando um `instalacao`.
**Passo 7.** No dialog, escolher "Fotos + Instalação". Se o veículo exigir rastreador e estiver sem, conferir que o aviso amarelo "exige rastreador" **não aparece** (porque escolheu fotos+instalação).
**Passo 8.** Gerar link e abrir. Validar visualmente:
   - Cards de fotos + vídeo 360° aparecem.
   - **Aparece** o card "IMEI do Rastreador Instalado" (obrigatório).
   - **Aparece** etapa "Teste de Comunicação".

### Cenário C (extra rápido) — Aviso de rastreador

**Passo 9.** Em um serviço de veículo que exige rastreador (Diesel / Carro≥30k / Moto≥9k) sem rastreador vinculado, escolher "Somente Fotos" e validar que o **aviso amarelo aparece** ("Este veículo exige rastreador; a instalação precisará ser agendada depois") mas **não bloqueia** Gerar Link.

### Checagem de banco ao final

Para cada link gerado nos cenários A e B, rodar via `supabase--read_query`:

```sql
-- Caso A — esperado escopo='somente_fotos' em vistoria_prestador_links
SELECT id, escopo, servico_id, prestador_id, status, expires_at
FROM vistoria_prestador_links
WHERE id = '<id_caso_A>';

-- Caso B — esperado escopo='fotos_instalacao' em instalacao_prestador_links
SELECT id, escopo, instalacao_id, prestador_id, status, expires_at
FROM instalacao_prestador_links
WHERE id = '<id_caso_B>';

-- Confirmar servicos roteados pelo gate correto
SELECT id, tipo, status, prestador_id, updated_at
FROM servicos
WHERE id IN ('<servico_A>','<servico_B>');
```

Critérios de aceite:
- Coluna `escopo` persistida com o valor escolhido (não null).
- Caso A roteou para `vistoria_prestador_links` (não criou registro em `instalacao_prestador_links`).
- Caso B roteou para `instalacao_prestador_links`.
- `servicos.status='agendada'` nos dois casos.

### Entregáveis

Relatório consolidado com:
- Screenshots dos dialogs e dos links públicos (mostrando presença/ausência do card IMEI).
- Resultado das queries.
- Lista de divergências encontradas (se houver), com hipótese de causa — **sem aplicar fixes durante o teste**; se aparecer bug, paro e reporto para você decidir.

### Fora de escopo deste teste

- Concluir a vistoria de ponta a ponta no link público (exigiria upload real de fotos do prestador).
- Validar `concluir-instalacao-prestador` quando `escopo='somente_fotos'` — fica para teste separado se você pedir.
- Aprovação no Monitoramento pós-conclusão.

Se você quiser ampliar para esses pontos, me avise antes de aprovar.
