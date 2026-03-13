import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgendamentoVistoria } from './AgendamentoVistoria';
import { EscolhaLocalVistoria } from './EscolhaLocalVistoria';
import { AgendamentoBase } from './AgendamentoBase';
import { motion, AnimatePresence } from 'framer-motion';

interface AgendamentoVistoriaCompletaProps {
  cotacaoId: string;
  tipoVistoria?: 'autovistoria' | 'agendada';
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  veiculoPlaca?: string;
  veiculoDescricao?: string;
  enderecoInicial?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  onConfirmar: () => void;
}

type ModoAgendamento = 'escolha' | 'cliente' | 'base';

export function AgendamentoVistoriaCompleta({ 
  cotacaoId, 
  tipoVistoria, 
  clienteNome = '',
  clienteTelefone,
  clienteEmail,
  veiculoPlaca,
  veiculoDescricao,
  enderecoInicial,
  onConfirmar 
}: AgendamentoVistoriaCompletaProps) {
  const [modo, setModo] = useState<ModoAgendamento>('escolha');

  return (
    <AnimatePresence mode="wait">
      {modo === 'escolha' && (
        <motion.div
          key="escolha"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <EscolhaLocalVistoria 
            onEscolher={(local) => setModo(local)}
          />
        </motion.div>
      )}

      {modo === 'cliente' && (
        <motion.div
          key="cliente"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="space-y-4"
        >
          <Button variant="ghost" size="sm" onClick={() => setModo('escolha')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
           <AgendamentoVistoria
            cotacaoId={cotacaoId}
            onConfirmar={onConfirmar}
            contexto="pos-autovistoria"
            tipoVistoria={tipoVistoria}
            enderecoInicial={enderecoInicial}
          />
        </motion.div>
      )}

      {modo === 'base' && (
        <motion.div
          key="base"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
        >
          <AgendamentoBase
            cotacaoId={cotacaoId}
            clienteNome={clienteNome}
            clienteTelefone={clienteTelefone}
            clienteEmail={clienteEmail}
            veiculoPlaca={veiculoPlaca}
            veiculoDescricao={veiculoDescricao}
            onAgendado={onConfirmar}
            onVoltar={() => setModo('escolha')}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
