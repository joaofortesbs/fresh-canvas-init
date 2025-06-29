
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  conteudo: string;
  enviado_em: string;
  user_id: string;
  profiles?: {
    display_name?: string;
    email?: string;
    avatar_url?: string;
    full_name?: string;
  };
}

interface ChatSectionProps {
  groupId: string;
  currentUser: any;
}

export default function ChatSection({ groupId, currentUser }: ChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Map<string, any>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !groupId) {
      console.log('Usuário ou grupo não disponível');
      return;
    }

    loadMessages();
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        console.log('Removendo canal Realtime:', channelRef.current);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [groupId, currentUser]);

  const loadUserProfiles = async (userIds: string[]) => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, email, avatar_url')
        .in('id', userIds);

      if (error) {
        console.error('Erro ao carregar perfis:', error);
        return;
      }

      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
      setUserProfiles(profileMap);
    } catch (error) {
      console.error('Erro ao carregar perfis de usuário:', error);
    }
  };

  const loadMessages = async () => {
    if (!currentUser || !groupId) {
      console.log('Usuário ou grupo não disponível para carregar mensagens');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Carregando mensagens para grupo:', groupId, 'usuário:', currentUser.id);

      // Primeiro verificar se o usuário é membro do grupo
      const { data: membership, error: membershipError } = await supabase
        .from('membros_grupos')
        .select('*')
        .eq('grupo_id', groupId)
        .eq('user_id', currentUser.id)
        .single();

      if (membershipError || !membership) {
        console.error('Usuário não é membro do grupo:', membershipError);
        toast({
          title: "Acesso negado",
          description: "Você não é membro deste grupo",
          variant: "destructive"
        });
        return;
      }

      console.log('Verificação de membresia aprovada');

      // Carregar mensagens da tabela mensagens_chat_grupos
      const { data: messagesData, error: messagesError } = await supabase
        .from('mensagens_chat_grupos')
        .select('id, conteudo, enviado_em, user_id')
        .eq('grupo_id', groupId)
        .order('enviado_em', { ascending: true });

      if (messagesError) {
        console.error('Erro ao carregar mensagens:', messagesError);
        toast({
          title: "Erro",
          description: "Erro ao carregar mensagens do chat",
          variant: "destructive"
        });
        return;
      }

      console.log('Mensagens carregadas:', messagesData?.length || 0);
      
      // Carregar perfis dos usuários das mensagens
      if (messagesData && messagesData.length > 0) {
        const userIds = [...new Set(messagesData.map(msg => msg.user_id))];
        await loadUserProfiles(userIds);
      }

      setMessages(messagesData || []);

    } catch (error) {
      console.error('Erro inesperado ao carregar mensagens:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar mensagens",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!currentUser || !groupId) {
      console.log('Não é possível configurar Realtime sem usuário ou grupo');
      return;
    }

    // Limpar canal existente se houver
    if (channelRef.current) {
      console.log('Removendo canal existente:', channelRef.current);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log('Configurando novo canal Realtime para grupo:', groupId);
    
    const channel = supabase
      .channel(`chat-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens_chat_grupos',
        filter: `grupo_id=eq.${groupId}`
      }, async (payload) => {
        console.log('Nova mensagem recebida via Realtime:', payload);
        
        try {
          const newMessage: ChatMessage = payload.new;
          
          // Carregar perfil do usuário se não estiver no cache
          if (!userProfiles.has(newMessage.user_id)) {
            await loadUserProfiles([newMessage.user_id]);
          }

          setMessages(prev => [...prev, newMessage]);
          
          // Scroll para a nova mensagem
          setTimeout(scrollToBottom, 100);
        } catch (error) {
          console.error('Erro ao processar nova mensagem do Realtime:', error);
          // Adicionar mensagem mesmo sem profile
          setMessages(prev => [...prev, payload.new]);
          setTimeout(scrollToBottom, 100);
        }
      })
      .subscribe((status) => {
        console.log('Status da assinatura Realtime:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Realtime conectado com sucesso para grupo:', groupId);
        } else if (status === 'CLOSED') {
          console.log('Conexão Realtime fechada para grupo:', groupId);
        }
      });

    channelRef.current = channel;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading || !currentUser || !groupId) {
      console.log('Condições inválidas para envio de mensagem');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Enviando mensagem para grupo:', groupId, 'usuário:', currentUser.id);
      console.log('Conteúdo da mensagem:', newMessage.trim());
      
      const { data, error } = await supabase
        .from('mensagens_chat_grupos')
        .insert({
          grupo_id: groupId,
          user_id: currentUser.id,
          conteudo: newMessage.trim()
        })
        .select();

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        toast({
          title: "Erro",
          description: "Erro ao enviar mensagem: " + error.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Mensagem enviada com sucesso:', data);
      setNewMessage('');
      
      // A nova mensagem será adicionada automaticamente via Realtime
      
    } catch (error) {
      console.error('Erro inesperado ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUserDisplayName = (message: ChatMessage) => {
    if (message.user_id === currentUser?.id) {
      return 'Você';
    }
    
    const profile = userProfiles.get(message.user_id);
    if (profile) {
      return profile.display_name || profile.full_name || profile.email || 'Usuário';
    }
    
    return 'Usuário';
  };

  const getUserAvatar = (message: ChatMessage) => {
    const profile = userProfiles.get(message.user_id);
    if (profile?.avatar_url) {
      return profile.avatar_url;
    }
    
    // Gerar avatar com inicial do nome
    const displayName = getUserDisplayName(message);
    const initials = displayName.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=FF6B00&color=fff&size=40`;
  };

  if (!currentUser) {
    return (
      <div className="chat-section h-full flex items-center justify-center">
        <div className="text-center text-gray-400 py-8">
          <p>Faça login para acessar o chat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-section h-full flex flex-col bg-[#001427]">
      <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-3 max-h-96">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">
            <p>Carregando mensagens...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>Nenhuma mensagem ainda. Seja o primeiro a conversar!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.user_id === currentUser?.id;
            return (
              <div
                key={message.id}
                className={`chat-message flex items-start gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className="flex-shrink-0">
                  <img
                    src={getUserAvatar(message)}
                    alt={getUserDisplayName(message)}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                </div>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwnMessage
                      ? 'bg-[#FF6B00] text-white rounded-br-none'
                      : 'bg-[#2a4066] text-white rounded-bl-none'
                  }`}
                >
                  <div className="message-header flex items-center gap-2 mb-1">
                    <span className="sender font-medium text-xs">
                      {getUserDisplayName(message)}
                    </span>
                    <span className="timestamp text-xs opacity-70">
                      {formatTime(message.enviado_em)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {message.conteudo}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input p-4 border-t border-gray-600">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1 bg-[#1a2a44] border-gray-600 text-white placeholder-gray-400"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !newMessage.trim()}
            className="bg-[#FF6B00] hover:bg-[#FF8C40] text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
