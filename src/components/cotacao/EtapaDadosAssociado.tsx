import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { User, ArrowRight, Phone } from 'lucide-react';
import { useVendedores } from '@/hooks/useVendedores';

interface EtapaDadosAssociadoProps {
  // Dados do associado/solicitante
  nome: string;
  setNome: (nome: string) => void;
  email: string;
  setEmail: (email: string) => void;
  telefone1: string;
  setTelefone1: (tel: string) => void;
  telefone2: string;
  setTelefone2: (tel: string) => void;
  
  // Consultor responsável
  consultorId: string;
  setConsultorId: (id: string) => void;
  
  // Navegação
  onNext: () => void;
}

const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

export function EtapaDadosAssociado({
  nome,
  setNome,
  email,
  setEmail,
  telefone1,
  setTelefone1,
  telefone2,
  setTelefone2,
  consultorId,
  setConsultorId,
  onNext,
}: EtapaDadosAssociadoProps) {
  const { data: vendedores = [], isLoading: isLoadingVendedores } = useVendedores();
  
  // Pode avançar se Nome, Telefone e Consultor estão preenchidos
  const telefoneValido = telefone1.replace(/\D/g, '').length >= 10;
  const canProceed = nome.trim() !== '' && telefoneValido && consultorId !== '';

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Dados do Solicitante</CardTitle>
            <CardDescription>
              Informe os dados de contato para a cotação
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Formulário de Dados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nome">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo do solicitante"
            />
          </div>

          {/* E-mail */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">E-mail (opcional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Telefone/WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="telefone1" className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              Telefone/WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="telefone1"
              value={telefone1}
              onChange={(e) => setTelefone1(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
            />
          </div>

          {/* Telefone 2 */}
          <div className="space-y-2">
            <Label htmlFor="telefone2" className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              Telefone 2 (opcional)
            </Label>
            <Input
              id="telefone2"
              value={telefone2}
              onChange={(e) => setTelefone2(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
            />
          </div>
        </div>

        <Separator />

        {/* Consultor Responsável */}
        <div className="space-y-2">
          <Label htmlFor="consultor">
            Consultor Responsável <span className="text-destructive">*</span>
          </Label>
          <Select value={consultorId} onValueChange={setConsultorId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o consultor" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingVendedores ? (
                <SelectItem value="loading" disabled>
                  Carregando...
                </SelectItem>
              ) : (
                vendedores.map((vendedor) => (
                  <SelectItem key={vendedor.user_id} value={vendedor.user_id}>
                    {vendedor.nome}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Botão Avançar */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            onClick={onNext}
            disabled={!canProceed}
            size="lg"
            className="min-w-[140px]"
          >
            Avançar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
