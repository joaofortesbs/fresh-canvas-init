
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, GraduationCap, Building2, Calendar, Trash2 } from "lucide-react";
import AddEducationModal from "./modals/AddEducationModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: Date | null;
  endDate: Date | null;
  current: boolean;
  description: string;
  grade?: string;
}

export default function Education() {
  const [educations, setEducations] = useState<Education[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  // Carregar dados de educação ao montar o componente
  useEffect(() => {
    const loadEducations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('user_education')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao carregar educação:', error);
          return;
        }

        if (data) {
          const formattedEducations = data.map(edu => ({
            id: edu.id,
            institution: edu.institution,
            degree: edu.degree,
            field: edu.field || '',
            startDate: edu.start_date ? new Date(edu.start_date) : null,
            endDate: edu.end_date ? new Date(edu.end_date) : null,
            current: edu.current || false,
            description: edu.description || '',
            grade: edu.grade || ''
          }));
          setEducations(formattedEducations);
        }
      } catch (error) {
        console.error('Erro ao carregar educação:', error);
      }
    };

    loadEducations();
  }, []);

  const handleAddEducation = async (education: Education) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from('user_education')
        .insert({
          user_id: user.id,
          institution: education.institution,
          degree: education.degree,
          field: education.field,
          start_date: education.startDate?.toISOString().split('T')[0],
          end_date: education.endDate?.toISOString().split('T')[0],
          current: education.current,
          description: education.description,
          grade: education.grade
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar educação:', error);
        toast({
          title: "Erro",
          description: "Erro ao salvar educação. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      if (data) {
        const newEducation = {
          id: data.id,
          institution: data.institution,
          degree: data.degree,
          field: data.field || '',
          startDate: data.start_date ? new Date(data.start_date) : null,
          endDate: data.end_date ? new Date(data.end_date) : null,
          current: data.current || false,
          description: data.description || '',
          grade: data.grade || ''
        };
        setEducations([newEducation, ...educations]);
        
        toast({
          title: "Sucesso",
          description: "Educação adicionada com sucesso!",
          className: "bg-green-50 border-green-200 text-green-800"
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar educação:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao salvar educação.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveEducation = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_education')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao remover educação:', error);
        toast({
          title: "Erro",
          description: "Erro ao remover educação. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      setEducations(educations.filter(edu => edu.id !== id));
      toast({
        title: "Sucesso",
        description: "Educação removida com sucesso!",
        className: "bg-green-50 border-green-200 text-green-800"
      });
    } catch (error) {
      console.error('Erro ao remover educação:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao remover educação.",
        variant: "destructive"
      });
    }
  };

  const formatDateRange = (startDate: Date | null, endDate: Date | null, current: boolean) => {
    const start = startDate ? format(startDate, "MMM yyyy", { locale: ptBR }) : "";
    const end = current ? "Presente" : endDate ? format(endDate, "MMM yyyy", { locale: ptBR }) : "";
    return `${start} - ${end}`;
  };

  return (
    <div className="bg-white dark:bg-[#0A2540] rounded-xl border border-[#E0E1DD] dark:border-white/10 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#FF6B00]/10 flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-[#FF6B00]" />
          </div>
          <h3 className="text-lg font-semibold text-[#29335C] dark:text-white">
            Educação
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="text-[#64748B] dark:text-white/60 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 h-8 w-8 p-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {educations.length > 0 ? (
        <div className="space-y-4">
          {educations.map((education) => (
            <div key={education.id} className="p-4 bg-gray-50 dark:bg-[#29335C]/20 rounded-lg border border-[#E0E1DD] dark:border-white/10">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-[#FF6B00]" />
                    <h4 className="font-semibold text-[#29335C] dark:text-white">
                      {education.institution}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-[#FF6B00]/10 text-[#FF6B00] border-[#FF6B00]/20">
                      {education.degree}
                    </Badge>
                    {education.field && (
                      <span className="text-[#64748B] dark:text-white/60 text-sm">
                        em {education.field}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[#64748B] dark:text-white/60 mb-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateRange(education.startDate, education.endDate, education.current)}
                    </div>
                    {education.grade && (
                      <div>
                        Nota: {education.grade}
                      </div>
                    )}
                  </div>
                  {education.description && (
                    <p className="text-sm text-[#64748B] dark:text-white/60 mt-2">
                      {education.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveEducation(education.id)}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-[#FF6B00]/10 rounded-full flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-[#FF6B00]" />
          </div>
          <p className="text-[#64748B] dark:text-white/60 mb-3">
            Adicione informações sobre sua formação acadêmica
          </p>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Educação
          </Button>
        </div>
      )}

      <AddEducationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddEducation}
      />
    </div>
  );
}
