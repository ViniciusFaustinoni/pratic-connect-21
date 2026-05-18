## Liberação manual de R/F — PHILLIP DE SOUZA VIEIRA (QXT9H99)

Aplicar a Opção B (atalho operacional): liberar Roubo/Furto agora, sem esperar o vídeo 360° nem o técnico. Instalação do rastreador continua agendada normalmente — esta ação só destrava a cobertura R/F antecipada.

### Mudanças

1. **`veiculos`** (`14c2e181-285c-46f2-8b64-0fe96f79fcdd`)
   - `cobertura_roubo_furto = true`
   - `updated_at = now()`
   - Mantém `status='instalacao_pendente'` (instalação técnica continua pendente)

2. **`vistorias`** (`3d23689a-996f-4c14-b75d-16f8396a795f`, autovistoria pendente)
   - `status = 'aprovada'`
   - `analisado_em = now()`

3. **`servicos`** (`cffe1b70-bd7c-4820-8c05-47d604b2b096`, vistoria_entrada autovistoria)
   - `status = 'aprovada'` (terminal, sai da fila)
   - `concluida_em = null`
   - `analisado_em = now()`
   - `observacoes_analise = 'Liberação manual de R/F pelo Monitoramento — fotos validadas; vídeo 360° dispensado. Instalação técnica segue no agendamento.'`

4. **`associados_historico`** — registrar:
   - tipo `status_alterado`
   - descrição: "Cobertura Roubo/Furto liberada manualmente pelo Monitoramento (veículo QXT9H99). Instalação do rastreador segue no agendamento já marcado."

### O que NÃO muda
- `contratos`: continua `assinado`, `cadastro_aprovado=true` (correto)
- `associados`: continua `aguardando_instalacao` (correto)
- `instalacoes` / `servicos instalacao` agendados: intactos — técnico ainda vai
- `cobertura_total`: continua `false` (só libera com rastreador instalado)
- SGA Hinova: nada enviado (sistema nunca envia ATIVO; promoção é manual no painel)

### Confirmação
Responda **"aplica"** que eu executo a migration única com todos os 4 UPDATEs/INSERT acima.
