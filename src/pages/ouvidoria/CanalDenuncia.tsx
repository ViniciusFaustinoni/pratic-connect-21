import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Lock, Eye, EyeOff, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CanalDenuncia() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [form, setForm] = useState({
    assunto: "",
    descricao: "",
    anonimo: true,
    nome: "",
    telefone: "",
    email: "",
    aceitaTermos: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.assunto || !form.descricao) {
      toast.error("Preencha o assunto e a descrição da denúncia");
      return;
    }

    if (!form.aceitaTermos) {
      toast.error("Você precisa aceitar os termos para continuar");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("ouvidoria_manifestacoes")
        .insert({
          tipo: "denuncia",
          assunto: form.assunto,
          descricao: form.descricao,
          anonimo: form.anonimo,
          canal: "app",
          prioridade: "alta",
          status: "aberto",
          protocolo: "", // Trigger gera automaticamente
        })
        .select("protocolo")
        .single();

      if (error) throw error;

      setProtocolo(data.protocolo);
      toast.success("Denúncia registrada com sucesso!");
    } catch (error) {
      console.error("Erro ao registrar denúncia:", error);
      toast.error("Erro ao registrar denúncia. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (protocolo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">Denúncia Registrada</CardTitle>
            <CardDescription>
              Sua denúncia foi recebida e será analisada com total sigilo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center">
              <p className="text-sm text-purple-700 mb-2">Seu protocolo:</p>
              <p className="text-2xl font-mono font-bold text-purple-900">{protocolo}</p>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Importante:</p>
                  <p>Guarde este protocolo! Você precisará dele para acompanhar o andamento da sua denúncia.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate("/ouvidoria/consulta-protocolo")}
              >
                Acompanhar Denúncia
              </Button>
              <Button 
                className="flex-1"
                onClick={() => {
                  setProtocolo(null);
                  setForm({
                    assunto: "",
                    descricao: "",
                    anonimo: true,
                    nome: "",
                    telefone: "",
                    email: "",
                    aceitaTermos: false,
                  });
                }}
              >
                Nova Denúncia
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <div className="bg-purple-900 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10" />
            <h1 className="text-3xl font-bold">Canal de Denúncia</h1>
          </div>
          <p className="text-purple-200 max-w-xl mx-auto">
            Este é um canal seguro e confidencial para relatar irregularidades, 
            condutas antiéticas ou qualquer situação que viole as normas da associação.
          </p>
        </div>
      </div>

      {/* Garantias */}
      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-white shadow-lg">
            <CardContent className="pt-6 text-center">
              <Lock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-purple-900">100% Sigiloso</h3>
              <p className="text-sm text-muted-foreground">Sua identidade é protegida</p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-lg">
            <CardContent className="pt-6 text-center">
              <Eye className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-purple-900">Acompanhamento</h3>
              <p className="text-sm text-muted-foreground">Monitore o andamento</p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-lg">
            <CardContent className="pt-6 text-center">
              <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-purple-900">Sem Retaliação</h3>
              <p className="text-sm text-muted-foreground">Proteção garantida</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Formulário */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Registrar Denúncia</CardTitle>
            <CardDescription>
              Descreva a situação com o máximo de detalhes possível. 
              Todas as informações são tratadas com absoluto sigilo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Identificação */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonimo"
                    checked={form.anonimo}
                    onCheckedChange={(checked) => 
                      setForm(prev => ({ ...prev, anonimo: checked as boolean }))
                    }
                  />
                  <label htmlFor="anonimo" className="text-sm font-medium cursor-pointer">
                    Desejo permanecer anônimo
                  </label>
                </div>

                {!form.anonimo && (
                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome (opcional)</Label>
                      <Input
                        id="nome"
                        value={form.nome}
                        onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Seu nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone (opcional)</Label>
                      <Input
                        id="telefone"
                        value={form.telefone}
                        onChange={(e) => setForm(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email">E-mail (opcional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Assunto */}
              <div className="space-y-2">
                <Label htmlFor="assunto">Assunto da Denúncia *</Label>
                <Input
                  id="assunto"
                  value={form.assunto}
                  onChange={(e) => setForm(prev => ({ ...prev, assunto: e.target.value }))}
                  placeholder="Resuma o motivo da denúncia"
                  required
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição Detalhada *</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descreva a situação com o máximo de detalhes: O que aconteceu? Quando? Onde? Quem são os envolvidos? Existem testemunhas?"
                  rows={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Quanto mais detalhes, melhor será a investigação.
                </p>
              </div>

              {/* Termos */}
              <div className="flex items-start space-x-2 p-4 bg-purple-50 rounded-lg">
                <Checkbox
                  id="termos"
                  checked={form.aceitaTermos}
                  onCheckedChange={(checked) => 
                    setForm(prev => ({ ...prev, aceitaTermos: checked as boolean }))
                  }
                />
                <label htmlFor="termos" className="text-sm cursor-pointer">
                  Declaro que as informações prestadas são verdadeiras e estou ciente de que 
                  denúncias falsas podem resultar em responsabilização legal.
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-purple-700 hover:bg-purple-800"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enviando..." : "Enviar Denúncia"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Link para consulta */}
        <div className="text-center mt-6">
          <p className="text-muted-foreground text-sm">
            Já registrou uma denúncia?{" "}
            <Button 
              variant="link" 
              className="p-0 h-auto text-purple-700"
              onClick={() => navigate("/ouvidoria/consulta-protocolo")}
            >
              Acompanhe aqui
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
