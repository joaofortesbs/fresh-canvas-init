
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import UploadModal from "./upload-modal";

interface AddButtonProps {
  onFileUpload?: (files: File[]) => void;
}

const AddButton: React.FC<AddButtonProps> = ({ onFileUpload }) => {
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleUpload = (files: File[]) => {
    if (onFileUpload) {
      onFileUpload(files);
    }
    console.log("Arquivos enviados:", files);
    
    // Implementação do salvamento dos arquivos na lista de recentes
    if (files.length > 0) {
      // Converter Files para objetos serializáveis
      const recentFilesToSave = files.map(file => ({
        name: file.name,
        date: "Hoje",
        type: file.type,
        size: file.size
      }));
      
      // Obter arquivos existentes
      const existingFilesJson = localStorage.getItem('recentFiles');
      let existingFiles = existingFilesJson ? JSON.parse(existingFilesJson) : [];
      
      // Adicionar novos arquivos no início da lista (mais recentes primeiro)
      const updatedFiles = [...recentFilesToSave, ...existingFiles].slice(0, 10); // limitar a 10
      
      // Salvar no localStorage
      localStorage.setItem('recentFiles', JSON.stringify(updatedFiles));
      console.log("Arquivos recentes salvos no localStorage");
    }
  };

  return (
    <>
      <motion.button
        className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#0D23A0] to-[#5B21BD] 
                 flex items-center justify-center shadow-lg text-white"
        whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(13, 35, 160, 0.5)" }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowUploadModal(true)}
      >
        <Plus size={18} />
      </motion.button>

      <UploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUpload={handleUpload}
      />
    </>
  );
};

export default AddButton;
