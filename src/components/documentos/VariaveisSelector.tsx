import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  User, 
  Car, 
  FileText, 
  Settings, 
  Building, 
  ChevronDown, 
  Search, 
  Copy, 
  Check,
  Shield,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

// Ícones por grupo
const iconesPorGrupo: Record<string, React.ComponentType<{ className?: string }>> = {
  associado: User,
  veiculo: Car,
  contrato: FileText,
  plano: Shield,
  sistema: Settings,
  empresa: Building,
};

// Variáveis disponíveis organizadas por grupo
const VARIAVEIS_DISPONIVEIS: Record<string, { codigo: string; descricao: string }[]> = {
  associado: [
    { codigo: 'associado.nome', descricao: 'Nome completo do associado' },
    { codigo: 'associado.cpf', descricao: 'CPF do associado (formatado)' },
    { codigo: 'associado.rg', descricao: 'RG do associado' },
    { codigo: 'associado.telefone', descricao: 'Telefone principal (formatado)' },
    { codigo: 'associado.whatsapp', descricao: 'WhatsApp do associado' },
    { codigo: 'associado.email', descricao: 'E-mail do associado' },
    { codigo: 'associado.data_nascimento', descricao: 'Data de nascimento' },
    { codigo: 'associado.data_adesao', descricao: 'Data de adesão à associação' },
    { codigo: 'associado.endereco_completo', descricao: 'Endereço formatado completo' },
    { codigo: 'associado.logradouro', descricao: 'Logradouro (rua, avenida, etc.)' },
    { codigo: 'associado.numero', descricao: 'Número do endereço' },
    { codigo: 'associado.complemento', descricao: 'Complemento do endereço' },
    { codigo: 'associado.bairro', descricao: 'Bairro' },
    { codigo: 'associado.cidade', descricao: 'Cidade' },
    { codigo: 'associado.uf', descricao: 'UF (estado)' },
    { codigo: 'associado.cep', descricao: 'CEP' },
    { codigo: 'associado.profissao', descricao: 'Profissão' },
    { codigo: 'associado.estado_civil', descricao: 'Estado civil' },
  ],
  veiculo: [
    { codigo: 'veiculo.marca', descricao: 'Marca do veículo' },
    { codigo: 'veiculo.modelo', descricao: 'Modelo do veículo' },
    { codigo: 'veiculo.ano', descricao: 'Ano de fabricação/modelo' },
    { codigo: 'veiculo.cor', descricao: 'Cor do veículo' },
    { codigo: 'veiculo.placa', descricao: 'Placa do veículo' },
    { codigo: 'veiculo.chassi', descricao: 'Número do chassi' },
    { codigo: 'veiculo.renavam', descricao: 'Número do RENAVAM' },
    { codigo: 'veiculo.valor_fipe', descricao: 'Valor FIPE formatado (R$)' },
    { codigo: 'veiculo.combustivel', descricao: 'Tipo de combustível' },
    { codigo: 'veiculo.categoria', descricao: 'Categoria do veículo' },
    { codigo: 'veiculo.tipo', descricao: 'Tipo (carro, moto, caminhão)' },
  ],
  contrato: [
    { codigo: 'contrato.numero', descricao: 'Número do contrato' },
    { codigo: 'contrato.valor_adesao', descricao: 'Valor de adesão (R$)' },
    { codigo: 'contrato.valor_mensal', descricao: 'Valor da mensalidade (R$)' },
    { codigo: 'contrato.dia_vencimento', descricao: 'Dia de vencimento' },
    { codigo: 'contrato.data_inicio', descricao: 'Data de início do contrato' },
    { codigo: 'contrato.data_fim', descricao: 'Data de fim do contrato' },
    { codigo: 'contrato.status', descricao: 'Status atual do contrato' },
  ],
  plano: [
    { codigo: 'plano.nome', descricao: 'Nome do plano contratado' },
    { codigo: 'plano.codigo', descricao: 'Código do plano' },
    { codigo: 'plano.descricao', descricao: 'Descrição do plano' },
    { codigo: 'plano.tipo_uso', descricao: 'Tipo de uso (particular, comercial)' },
    { codigo: 'plano.franquia', descricao: 'Valor/percentual da franquia' },
    { codigo: 'plano.carencia', descricao: 'Período de carência' },
    { codigo: 'plano.coberturas_html', descricao: 'Tabela de coberturas em HTML' },
    { codigo: 'plano.valor_base', descricao: 'Valor base do plano' },
    { codigo: 'plano.cobertura_fipe', descricao: 'Percentual de cobertura FIPE' },
  ],
  sistema: [
    { codigo: 'sistema.data_atual', descricao: 'Data atual (DD/MM/AAAA)' },
    { codigo: 'sistema.hora_atual', descricao: 'Hora atual (HH:MM:SS)' },
    { codigo: 'sistema.data_extenso', descricao: 'Data por extenso' },
    { codigo: 'sistema.ano_atual', descricao: 'Ano atual' },
    { codigo: 'sistema.mes_atual', descricao: 'Mês atual por extenso' },
  ],
  empresa: [
    { codigo: 'empresa.nome', descricao: 'Nome fantasia da empresa' },
    { codigo: 'empresa.razao_social', descricao: 'Razão social' },
    { codigo: 'empresa.cnpj', descricao: 'CNPJ da empresa' },
    { codigo: 'empresa.endereco_completo', descricao: 'Endereço completo formatado' },
    { codigo: 'empresa.logradouro', descricao: 'Logradouro' },
    { codigo: 'empresa.numero', descricao: 'Número' },
    { codigo: 'empresa.complemento', descricao: 'Complemento' },
    { codigo: 'empresa.bairro', descricao: 'Bairro' },
    { codigo: 'empresa.cidade', descricao: 'Cidade' },
    { codigo: 'empresa.uf', descricao: 'UF (estado)' },
    { codigo: 'empresa.cep', descricao: 'CEP' },
    { codigo: 'empresa.telefone', descricao: 'Telefone da empresa' },
    { codigo: 'empresa.email', descricao: 'E-mail da empresa' },
    { codigo: 'empresa.site', descricao: 'Website da empresa' },
  ],
};

interface VariaveisSelectorProps {
  onSelect: (variavel: string) => void;
}

export function VariaveisSelector({ onSelect }: VariaveisSelectorProps) {
  const [busca, setBusca] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({
    associado: true,
    veiculo: false,
    contrato: false,
    plano: false,
    sistema: false,
    empresa: false,
  });

  const handleCopiar = (codigo: string) => {
    const texto = `{{${codigo}}}`;
    navigator.clipboard.writeText(texto);
    setCopiado(codigo);
    toast.success('Variável copiada!');
    setTimeout(() => setCopiado(null), 2000);
  };

  const handleInserir = (codigo: string) => {
    onSelect(`{{${codigo}}}`);
    toast.success('Variável inserida!');
  };

  // Filtrar variáveis pela busca
  const filtrarVariaveis = (variaveis: { codigo: string; descricao: string }[]) => {
    if (!busca) return variaveis;
    const termoBusca = busca.toLowerCase();
    return variaveis.filter(
      v => v.codigo.toLowerCase().includes(termoBusca) || 
           v.descricao.toLowerCase().includes(termoBusca)
    );
  };

  // Contar total de variáveis
  const totalVariaveis = Object.values(VARIAVEIS_DISPONIVEIS).reduce(
    (acc, arr) => acc + arr.length, 0
  );

  return (
    <div className="space-y-3">
      {/* Header com contador */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalVariaveis} variáveis disponíveis
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar variável..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista de grupos */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {Object.entries(VARIAVEIS_DISPONIVEIS).map(([grupo, variaveis]) => {
            const Icone = iconesPorGrupo[grupo] || FileText;
            const variaveisFiltradas = filtrarVariaveis(variaveis);
            
            if (variaveisFiltradas.length === 0) return null;
            
            return (
              <Collapsible 
                key={grupo} 
                open={expandido[grupo] || busca.length > 0}
                onOpenChange={(open) => setExpandido(prev => ({ ...prev, [grupo]: open }))}
              >
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Icone className="h-4 w-4" />
                      <span className="capitalize">{grupo}</span>
                      <Badge variant="secondary" className="ml-1">
                        {variaveisFiltradas.length}
                      </Badge>
                    </span>
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pl-6 space-y-1 py-1">
                  {variaveisFiltradas.map(({ codigo, descricao }) => (
                    <div 
                      key={codigo}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-sm font-mono text-primary">
                          {`{{${codigo}}}`}
                        </code>
                        <p className="text-xs text-muted-foreground truncate">
                          {descricao}
                        </p>
                      </div>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopiar(codigo)}
                          title="Copiar"
                        >
                          {copiado === codigo ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleInserir(codigo)}
                        >
                          Inserir
                        </Button>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Export da lista de variáveis para uso externo
export { VARIAVEIS_DISPONIVEIS };
