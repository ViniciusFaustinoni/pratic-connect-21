import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  FileText, 
  Eye, 
  Download, 
  Send, 
  Car, 
  Bike,
  User, 
  Info,
  Home,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { TermoFiliacaoTemplate } from '@/components/cadastro/TermoFiliacaoTemplate';
import { gerarEBaixarTermoPDF } from '@/lib/gerarTermoPDF';
import { 
  DadosTermoFiliacao, 
  ehVeiculoZeroKm, 
  exigeRastreador,
  formatCurrency 
} from '@/types/termo-filiacao';
import { useAvaliarAditivos } from '@/hooks/useAvaliarAditivos';
import { useAditivos, type TermoAditivo } from '@/hooks/useAditivos';
import { useConfigFipeRastreador, useConfigFipeRastreadorMoto } from '@/hooks/useConfigRastreador';

// Mock do associado selecionado
const mockAssociado: DadosTermoFiliacao = {
  cliente: {
    nome: 'ESTEFANI BOTELHO DA SILVA',
    cpf: '12345678900',
    rg: '12.345.678-9',
    rgOrgao: 'SSP/SP',
    dataNascimento: '1990-05-15',
    estadoCivil: 'Solteira',
    profissao: 'Empresária',
    email: 'estefani@email.com',
    telefone: '11999991111',
    telefoneSecundario: '11999992222',
    endereco: {
      cep: '01310100',
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Apto 45',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
    },
  },
  veiculo: {
    tipo: 'moto',
    marca: 'HONDA',
    modelo: 'CG 160 START',
    anoFab: 2026,
    anoMod: 2026,
    cor: 'VERMELHA',
    placa: '', // vazio = 0KM
    renavam: '12345678901',
    chassi: '9C2KC1670NR123456',
    combustivel: 'GASOLINA',
    valorFipe: 18083.00,
    codigoFipe: '811064-8',
    procedencia: 'Novo (zero km)',
    categoria: 'Motocicleta',
    tipoUso: 'Particular',
    alienado: false,
  },
  plano: {
    nome: 'ADVANCED ESPECIAL',
    codigo: 'ADV-ESP',
    coberturas: ['Roubo', 'Furto', 'Assistência 24h', 'Incêndio'],
    valorMensal: 89.90,
    taxaAdesao: 99.90,
    diaVencimento: 10,
    cotaParticipacao: 10,
    cotaMinima: 1500,
  },
  contrato: {
    numero: 'TERM-2026-00001',
    valorAdesao: 99.90,
    valorMensal: 89.90,
    diaVencimento: 10,
    formaPagamento: 'Boleto Bancário',
  },
  empresa: {
    nome: 'ABP PraticCar',
    razaoSocial: 'Associação de Benefícios PraticCar',
    cnpj: '12.345.678/0001-90',
    logradouro: 'Av. das Américas',
    numero: '19.005',
    bairro: 'Recreio dos Bandeirantes',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
    cep: '22790-703',
    telefone: '(21) 99999-0000',
    email: 'contato@praticcar.com.br',
    lgpdEmail: 'lgpd@praticcar.com.br',
  },
  indicador: {
    nome: 'Maria Santos',
    cpf: '98765432100',
  },
};

export default function GerarTermo() {
  const [busca, setBusca] = useState('');
  const [previewAberto, setPreviewAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [aditivosSelecionados, setAditivosSelecionados] = useState<string[]>([]);
  
  // Dados do associado selecionado (usando mock por enquanto)
  const associado = mockAssociado;
  
  // Configurações dinâmicas de FIPE para rastreador
  const { data: fipeMinCarro = 30000 } = useConfigFipeRastreador();
  const { data: fipeMinMoto = 9000 } = useConfigFipeRastreadorMoto();
  const rastreadorInfo = exigeRastreador(associado.veiculo, { fipeMinCarro, fipeMinMoto });
  
  // Buscar aditivos e avaliar quais se aplicam
  const { data: aditivos = [], isLoading: loadingAditivos } = useAditivos(true);
  const { aditivosAvaliados, isLoading: loadingAvaliacao } = useAvaliarAditivos({
    placa: associado.veiculo.placa,
    procedencia: associado.veiculo.procedencia,
    valorFipe: associado.veiculo.valorFipe,
    observacoes: '',
  });
  
  // Pré-selecionar aditivos que batem com as regras
  useMemo(() => {
    if (aditivosAvaliados.length > 0) {
      const automaticos = aditivosAvaliados
        .filter(({ autoSelecionado }) => autoSelecionado)
        .map(({ aditivo }) => aditivo.id);
      setAditivosSelecionados(automaticos);
    }
  }, [aditivosAvaliados]);
  
  const handleGerarPDF = async () => {
    setGerando(true);
    try {
      // Abrir o preview para renderizar o template (necessário para html2canvas)
      setPreviewAberto(true);
      
      // Aguardar um momento para o DOM renderizar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const nomeArquivo = `Termo_Filiacao_${associado.cliente.nome.replace(/\s/g, '_')}.pdf`;
      await gerarEBaixarTermoPDF('termo-container', nomeArquivo);
      
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGerando(false);
      setPreviewAberto(false);
    }
  };
  
  const handleEnviarAutentique = () => {
    toast.info('Função de envio para Autentique será implementada em breve');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground flex items-center gap-1">
          <Home className="h-4 w-4" />
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span>Cadastro</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Gerar Termo de Filiação</span>
      </div>
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Gerar Termo de Filiação</h1>
        <p className="text-muted-foreground">
          Gere o termo de filiação completo para envio ao associado
        </p>
      </div>
      
      {/* Campo de Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Digite CPF ou nome do associado..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            * Para demonstração, os dados do associado mock são exibidos automaticamente
          </p>
        </CardContent>
      </Card>
      
      {/* Dados do Associado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados do Associado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Nome</Label>
              <p className="font-medium">{associado.cliente.nome}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">CPF</Label>
              <p className="font-medium">{associado.cliente.cpf}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">E-mail</Label>
              <p className="font-medium">{associado.cliente.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Telefone</Label>
              <p className="font-medium">{associado.cliente.telefone}</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              {associado.veiculo.tipo === 'moto' ? (
                <Bike className="h-5 w-5 text-primary mt-0.5" />
              ) : (
                <Car className="h-5 w-5 text-primary mt-0.5" />
              )}
              <div>
                <Label className="text-muted-foreground text-xs">Veículo</Label>
                <p className="font-medium">
                  {associado.veiculo.marca} {associado.veiculo.modelo}
                </p>
                <p className="text-sm text-muted-foreground">
                  {associado.veiculo.anoFab}/{associado.veiculo.anoMod} - {associado.veiculo.cor}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Placa</Label>
              <p className="font-medium">
                {associado.veiculo.placa || (
                  <Badge variant="secondary">ZERO QUILÔMETRO</Badge>
                )}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Valor FIPE</Label>
              <div className="flex items-center gap-2">
                <p className="font-medium text-primary">
                  {formatCurrency(associado.veiculo.valorFipe)}
                </p>
                {rastreadorInfo.exige && (
                  <Badge variant="destructive">Rastreador obrigatório</Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Plano</Label>
              <p className="font-medium">{associado.plano.nome}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
       {/* Documentos a Gerar */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <FileText className="h-5 w-5" />
             Documentos a Gerar
           </CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
             <Checkbox id="proposta" checked disabled />
             <div className="flex-1">
               <Label htmlFor="proposta" className="font-medium cursor-pointer">
                 Proposta de Filiação
               </Label>
               <p className="text-sm text-muted-foreground">
                 Documento principal com todos os termos e condições
               </p>
             </div>
             <Badge>Obrigatório</Badge>
           </div>
           
           {loadingAditivos || loadingAvaliacao ? (
             <p className="text-sm text-muted-foreground py-4">Carregando aditivos...</p>
           ) : (
             <>
               {aditivosAvaliados.map(({ aditivo, autoSelecionado }) => (
                 <div
                   key={aditivo.id}
                   className={`flex items-start gap-3 p-3 rounded-lg ${
                     aditivosSelecionados.includes(aditivo.id)
                       ? autoSelecionado 
                         ? 'bg-green-500/10 border border-green-500/20'
                         : 'bg-blue-500/10 border border-blue-500/20'
                       : 'bg-muted/50 opacity-50'
                   }`}
                 >
                   <Checkbox
                     id={aditivo.id}
                     checked={aditivosSelecionados.includes(aditivo.id)}
                     onCheckedChange={(checked) => {
                       if (checked) {
                         setAditivosSelecionados([...aditivosSelecionados, aditivo.id]);
                       } else {
                         setAditivosSelecionados(aditivosSelecionados.filter(id => id !== aditivo.id));
                       }
                     }}
                   />
                   <div className="flex-1">
                     <Label htmlFor={aditivo.id} className="font-medium cursor-pointer">
                       {aditivo.nome}
                     </Label>
                     {aditivo.descricao && (
                       <p className="text-sm text-muted-foreground">{aditivo.descricao}</p>
                     )}
                   </div>
                   {autoSelecionado && (
                     <Badge variant="outline" className="border-green-500 text-green-600">
                       <Info className="h-3 w-3 mr-1" />
                       Automático
                     </Badge>
                   )}
                 </div>
               ))}
             </>
           )}
         </CardContent>
       </Card>
      
      {/* Botões de Ação */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button 
          variant="outline" 
          onClick={() => setPreviewAberto(true)}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        
        <Button 
          variant="secondary"
          onClick={handleGerarPDF}
          disabled={gerando}
        >
          <Download className="h-4 w-4 mr-2" />
          {gerando ? 'Gerando...' : 'Gerar PDF'}
        </Button>
        
        <Button onClick={handleEnviarAutentique}>
          <Send className="h-4 w-4 mr-2" />
          Enviar Autentique
        </Button>
      </div>
      
       {/* Modal de Preview */}
       <Dialog open={previewAberto} onOpenChange={setPreviewAberto}>
         <DialogContent className="max-w-5xl max-h-[90vh] p-0">
           <DialogHeader className="p-6 pb-0">
             <DialogTitle>Preview do Termo de Filiação</DialogTitle>
           </DialogHeader>
           <ScrollArea className="max-h-[calc(90vh-100px)]">
             <div className="p-6">
               <TermoFiliacaoTemplate
                 dados={associado}
                 aditivos={aditivos.filter(a => aditivosSelecionados.includes(a.id))}
               />
             </div>
           </ScrollArea>
         </DialogContent>
       </Dialog>
       
       {/* Template oculto para geração do PDF */}
       <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
         <TermoFiliacaoTemplate
           dados={associado}
           aditivos={aditivos.filter(a => aditivosSelecionados.includes(a.id))}
         />
       </div>
    </div>
  );
}
