import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { User, Link2, ArrowRight, Search, X, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVendedores } from '@/hooks/useVendedores';
import { useLeads } from '@/hooks/useLeads';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

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
  
  // Lead vinculado (opcional)
  leadId: string | null;
  setLeadId: (id: string | null) => void;
  
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
  leadId,
  setLeadId,
  onNext,
}: EtapaDadosAssociadoProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: vendedores = [], isLoading: isLoadingVendedores } = useVendedores();
  const { data: leadsResult } = useLeads({ 
    filters: { search: searchTerm },
    enabled: searchTerm.length >= 2 
  });
  
  const leads = leadsResult?.leads || [];
  
  // Selecionar lead preenche os campos automaticamente
  const handleSelectLead = (lead: typeof leads[0]) => {
    setLeadId(lead.id);
    setNome(lead.nome);
    setEmail(lead.email || '');
    setTelefone1(lead.telefone || '');
    setTelefone2(''); // Campo secundário não existe na tabela leads
    if (lead.vendedor_id) {
      setConsultorId(lead.vendedor_id);
    }
    setSearchOpen(false);
    setSearchTerm('');
  };
  
  // Limpar vínculo com lead
  const handleClearLead = () => {
    setLeadId(null);
    setNome('');
    setEmail('');
    setTelefone1('');
    setTelefone2('');
  };
  
  // Pode avançar se Nome e Consultor estão preenchidos
  const canProceed = nome.trim() !== '' && consultorId !== '';

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
        {/* Vincular Lead Existente (Opcional) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4" />
            Vincular Lead Existente (opcional)
          </Label>
          
          {leadId ? (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex-1">
                <p className="text-sm font-medium">{nome}</p>
                <p className="text-xs text-muted-foreground">Lead vinculado</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearLead}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-start text-muted-foreground"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Buscar lead por nome ou telefone...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Digite nome ou telefone..." 
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searchTerm.length < 2 
                        ? 'Digite ao menos 2 caracteres para buscar'
                        : 'Nenhum lead encontrado'
                      }
                    </CommandEmpty>
                    <CommandGroup>
                      {leads.slice(0, 10).map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={lead.id}
                          onSelect={() => handleSelectLead(lead)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{lead.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              {lead.telefone} {lead.email && `• ${lead.email}`}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OU PREENCHA MANUALMENTE</span>
          <Separator className="flex-1" />
        </div>

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
              className={cn(leadId && "bg-muted/30")}
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
              className={cn(leadId && email && "bg-muted/30")}
            />
          </div>

          {/* Telefone 1 */}
          <div className="space-y-2">
            <Label htmlFor="telefone1" className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              Telefone 1 (opcional)
            </Label>
            <Input
              id="telefone1"
              value={telefone1}
              onChange={(e) => setTelefone1(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
              className={cn(leadId && telefone1 && "bg-muted/30")}
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
              className={cn(leadId && telefone2 && "bg-muted/30")}
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
