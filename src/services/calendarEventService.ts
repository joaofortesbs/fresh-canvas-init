
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  isOnline?: boolean;
  meetingLink?: string;
  type?: string;
  discipline?: string;
  professor?: string;
  reminders?: string[];
  repeat?: string;
  visibility?: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
}

// Converter objeto para esquema da tabela
const formatEventForDB = (event: any) => {
  return {
    id: event.id || uuidv4(),
    title: event.title,
    description: event.description || '',
    start_date: event.startDate,
    end_date: event.endDate || event.startDate,
    start_time: event.startTime || '',
    end_time: event.endTime || '',
    location: event.location || '',
    is_online: event.isOnline || false,
    meeting_link: event.meetingLink || '',
    type: event.type || 'evento',
    discipline: event.discipline || '',
    professor: event.professor || '',
    reminders: event.reminders || [],
    repeat: event.repeat || 'none',
    visibility: event.visibility || 'private',
    user_id: event.userId,
    created_at: event.createdAt || new Date().toISOString(),
    updated_at: event.updatedAt || new Date().toISOString()
  };
};

// Converter esquema da tabela para objeto da interface
const formatDBEventForApp = (dbEvent: any): CalendarEvent => {
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    startDate: dbEvent.start_date,
    endDate: dbEvent.end_date,
    startTime: dbEvent.start_time,
    endTime: dbEvent.end_time,
    location: dbEvent.location,
    isOnline: dbEvent.is_online,
    meetingLink: dbEvent.meeting_link,
    type: dbEvent.type,
    discipline: dbEvent.discipline,
    professor: dbEvent.professor,
    reminders: dbEvent.reminders,
    repeat: dbEvent.repeat,
    visibility: dbEvent.visibility,
    userId: dbEvent.user_id,
    createdAt: dbEvent.created_at,
    updatedAt: dbEvent.updated_at
  };
};

// Adicionar um novo evento
export const addEvent = async (event: Omit<CalendarEvent, "id" | "createdAt">): Promise<CalendarEvent | null> => {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("Usuário não autenticado");
      // Fallback para armazenamento local
      const eventWithMeta = {
        ...event,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      };
      return saveEventLocally(eventWithMeta);
    }

    const eventWithMeta = {
      ...event,
      id: uuidv4(),
      userId: user.id,
      createdAt: new Date().toISOString(),
    };

    const dbEvent = formatEventForDB(eventWithMeta);

    const { data, error } = await supabase
      .from("calendar_events")
      .insert(dbEvent)
      .select()
      .single();

    if (error) {
      console.error("Erro ao adicionar evento no DB:", error);
      // Fallback para armazenamento local
      return saveEventLocally(eventWithMeta);
    }

    const formattedEvent = formatDBEventForApp(data);

    // Notificar a interface sobre o novo evento
    try {
      window.dispatchEvent(new CustomEvent('event-added', { 
        detail: { event: formattedEvent }
      }));
      window.dispatchEvent(new CustomEvent('agenda-events-updated'));
    } catch (e) {
      console.warn("Não foi possível emitir evento de atualização:", e);
    }

    return formattedEvent;
  } catch (error) {
    console.error("Erro ao adicionar evento:", error);
    // Fallback para armazenamento local
    const eventWithMeta = {
      ...event,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    return saveEventLocally(eventWithMeta);
  }
};

// Obter todos os eventos de um usuário
export const getEventsByUserId = async (userId?: string): Promise<CalendarEvent[]> => {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log("Usuário não autenticado, carregando eventos locais");
      return getLocalEvents('anonymous');
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Erro ao buscar eventos do usuário no DB:", error);
      // Fallback para armazenamento local
      return getLocalEvents(user.id);
    }

    const formattedEvents = (data || []).map(formatDBEventForApp);

    // Mesclar com eventos locais se existirem
    const localEvents = getLocalEvents(user.id);
    const localOnlyEvents = localEvents.filter(le => 
      !formattedEvents.some(fe => fe.id === le.id)
    );

    return [...formattedEvents, ...localOnlyEvents];
  } catch (error) {
    console.error("Erro ao buscar eventos do usuário:", error);
    return getLocalEvents('anonymous');
  }
};

// Obter todos os eventos
export const getAllEvents = async (): Promise<CalendarEvent[]> => {
  return getEventsByUserId();
};

// Atualizar um evento existente
export const updateEvent = async (event: CalendarEvent): Promise<CalendarEvent | null> => {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("Usuário não autenticado");
      return updateEventLocally(event);
    }

    if (!event.id) {
      console.error("ID é obrigatório para atualizar um evento");
      return null;
    }

    if (event.id.startsWith('local-')) {
      // Para eventos locais, atualizar apenas no localStorage
      return updateEventLocally(event);
    }

    const dbEvent = formatEventForDB({
      ...event,
      userId: user.id,
      updatedAt: new Date().toISOString()
    });

    const { data, error } = await supabase
      .from("calendar_events")
      .update(dbEvent)
      .eq("id", event.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar evento:", error);
      // Fallback para armazenamento local
      return updateEventLocally(event);
    }

    return formatDBEventForApp(data);
  } catch (error) {
    console.error("Erro ao atualizar evento:", error);
    return updateEventLocally(event);
  }
};

// Remover um evento
export const deleteEvent = async (eventId: string): Promise<boolean> => {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("Usuário não autenticado");
      return deleteEventLocally(eventId);
    }

    if (!eventId) {
      console.error("ID é obrigatório para excluir um evento");
      return false;
    }

    if (eventId.startsWith('local-')) {
      // Para eventos locais, excluir apenas no localStorage
      return deleteEventLocally(eventId);
    }

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", eventId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erro ao remover evento:", error);
      // Fallback para armazenamento local
      return deleteEventLocally(eventId);
    }

    return true;
  } catch (error) {
    console.error("Erro ao remover evento:", error);
    return deleteEventLocally(eventId);
  }
};

// Funções para armazenamento local como backup
const EVENTS_STORAGE_KEY = "calendar_events";

// Salvar todos os eventos localmente
const saveEventsLocally = (events: CalendarEvent[]) => {
  try {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch (error) {
    console.error("Erro ao salvar eventos localmente:", error);
    return false;
  }
};

// Inicializar o armazenamento local se não existir
export const initLocalStorage = () => {
  if (!localStorage.getItem(EVENTS_STORAGE_KEY)) {
    saveEventsLocally([]);
  }
};

// Obter todos os eventos armazenados localmente
export const getAllLocalEvents = (): CalendarEvent[] => {
  try {
    const eventsJson = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!eventsJson) return [];
    return JSON.parse(eventsJson);
  } catch (error) {
    console.error("Erro ao obter todos os eventos locais:", error);
    return [];
  }
};

// Obter eventos locais para um usuário específico
const getLocalEvents = (userId: string): CalendarEvent[] => {
  try {
    if (!userId) return [];
    const eventsJson = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!eventsJson) return [];
    const events: CalendarEvent[] = JSON.parse(eventsJson);
    return events.filter(event => event.userId === userId);
  } catch (error) {
    console.error("Erro ao obter eventos locais:", error);
    return [];
  }
};

// Salvar um evento localmente
const saveEventLocally = (event: any) => {
  try {
    const allEvents = getAllLocalEvents();
    const newEvent = {
      ...event,
      id: event.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: event.createdAt || new Date().toISOString(),
    };

    // Remover qualquer duplicata
    const filteredEvents = allEvents.filter(e => e.id !== newEvent.id);
    saveEventsLocally([...filteredEvents, newEvent]);
    return newEvent;
  } catch (error) {
    console.error("Erro ao salvar evento localmente:", error);
    return null;
  }
};

// Atualizar um evento localmente
const updateEventLocally = (event: CalendarEvent) => {
  try {
    const allEvents = getAllLocalEvents();
    const updatedEvents = allEvents.map(e => 
      e.id === event.id ? { ...event, updatedAt: new Date().toISOString() } : e
    );
    saveEventsLocally(updatedEvents);
    return event;
  } catch (error) {
    console.error("Erro ao atualizar evento localmente:", error);
    return null;
  }
};

// Remover um evento localmente
const deleteEventLocally = (eventId: string) => {
  try {
    const allEvents = getAllLocalEvents();
    const updatedEvents = allEvents.filter(e => e.id !== eventId);
    saveEventsLocally(updatedEvents);
    return true;
  } catch (error) {
    console.error("Erro ao remover evento localmente:", error);
    return false;
  }
};

// Sincronizar eventos locais com o banco de dados
export const syncLocalEvents = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log("Usuário não autenticado para sincronização");
      return;
    }

    const localEvents = getLocalEvents(user.id);
    const localOnlyEvents = localEvents.filter(e => e.id.startsWith('local-'));

    for (const event of localOnlyEvents) {
      const { id, ...eventData } = event;
      const result = await addEvent({ ...eventData, userId: user.id });
      if (result) {
        console.log("Evento sincronizado:", id, "->", result.id);
      }
    }

    // Limpar eventos locais sincronizados
    if (localOnlyEvents.length > 0) {
      const allEvents = getAllLocalEvents();
      const remainingEvents = allEvents.filter(e => !e.id.startsWith('local-') || e.userId !== user.id);
      saveEventsLocally(remainingEvents);
    }
  } catch (error) {
    console.error("Erro ao sincronizar eventos locais:", error);
  }
};
