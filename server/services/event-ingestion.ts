import { storage } from "../storage";
import type { Event, EventSource, InsertEvent } from "@shared/schema";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  htmlLink?: string;
}

interface ICalEvent {
  uid: string;
  summary?: string;
  description?: string;
  dtstart?: Date;
  dtend?: Date;
  location?: string;
  url?: string;
}

export class EventIngestionService {
  private static instance: EventIngestionService;

  static getInstance(): EventIngestionService {
    if (!this.instance) {
      this.instance = new EventIngestionService();
    }
    return this.instance;
  }

  async syncSource(source: EventSource): Promise<{ added: number; updated: number; errors: string[] }> {
    console.log(`🔄 Syncing event source: ${source.name} (${source.type})`);
    
    try {
      let result: { added: number; updated: number; errors: string[] };
      
      switch (source.type) {
        case 'google_calendar_public':
          result = await this.syncGoogleCalendarPublic(source);
          break;
        case 'ical':
          result = await this.syncICalFeed(source);
          break;
        case 'manual':
          result = { added: 0, updated: 0, errors: [] };
          break;
        default:
          result = { added: 0, updated: 0, errors: [`Unknown source type: ${source.type}`] };
      }

      await storage.updateEventSource(source.id, {
        lastSyncAt: new Date(),
        lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
        syncError: result.errors.length > 0 ? result.errors.join('; ') : null,
      });

      console.log(`✅ Synced ${source.name}: ${result.added} added, ${result.updated} updated`);
      return result;
    } catch (error: any) {
      console.error(`❌ Failed to sync ${source.name}:`, error);
      
      await storage.updateEventSource(source.id, {
        lastSyncAt: new Date(),
        lastSyncStatus: 'failed',
        syncError: error.message,
      });

      return { added: 0, updated: 0, errors: [error.message] };
    }
  }

  async syncAllSources(userId: string): Promise<{ 
    sourcesProcessed: number; 
    totalAdded: number; 
    totalUpdated: number; 
    errors: string[] 
  }> {
    const sources = await storage.getEventSources(userId);
    const activeSources = sources.filter(s => s.status === 'active');
    
    let totalAdded = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    for (const source of activeSources) {
      const result = await this.syncSource(source);
      totalAdded += result.added;
      totalUpdated += result.updated;
      errors.push(...result.errors);
    }

    return {
      sourcesProcessed: activeSources.length,
      totalAdded,
      totalUpdated,
      errors,
    };
  }

  private async syncGoogleCalendarPublic(source: EventSource): Promise<{ added: number; updated: number; errors: string[] }> {
    const config = source.config as { calendarId?: string; apiKey?: string };
    
    if (!config?.calendarId) {
      return { added: 0, updated: 0, errors: ['Calendar ID is required for Google Calendar sync'] };
    }

    const apiKey = config.apiKey || process.env.GOOGLE_CALENDAR_API_KEY;
    if (!apiKey) {
      return { added: 0, updated: 0, errors: ['Google Calendar API key not configured'] };
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('timeMin', timeMin);
    url.searchParams.append('timeMax', timeMax);
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');
    url.searchParams.append('maxResults', '100');

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Calendar API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const events: GoogleCalendarEvent[] = data.items || [];
      
      let added = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const gcEvent of events) {
        try {
          const existingEvent = await storage.getEventByExternalId(source.userId, source.id, gcEvent.id);
          
          const eventData: InsertEvent = {
            userId: source.userId,
            sourceId: source.id,
            externalId: gcEvent.id,
            title: gcEvent.summary || 'Untitled Event',
            description: gcEvent.description || null,
            startTime: new Date(gcEvent.start.dateTime || gcEvent.start.date || new Date()),
            endTime: gcEvent.end ? new Date(gcEvent.end.dateTime || gcEvent.end.date || new Date()) : null,
            timezone: gcEvent.start.timeZone || 'America/Chicago',
            location: gcEvent.location || null,
            eventUrl: gcEvent.htmlLink || null,
            isAllDay: !gcEvent.start.dateTime,
            visibility: 'public',
            category: this.categorizeEvent(gcEvent.summary || ''),
            rawData: gcEvent as any,
          };

          if (existingEvent) {
            await storage.updateEvent(existingEvent.id, eventData);
            updated++;
          } else {
            await storage.createEvent(eventData);
            added++;
          }
        } catch (eventError: any) {
          errors.push(`Failed to process event ${gcEvent.id}: ${eventError.message}`);
        }
      }

      return { added, updated, errors };
    } catch (error: any) {
      return { added: 0, updated: 0, errors: [error.message] };
    }
  }

  private async syncICalFeed(source: EventSource): Promise<{ added: number; updated: number; errors: string[] }> {
    const config = source.config as { icalUrl?: string };
    
    if (!config?.icalUrl) {
      return { added: 0, updated: 0, errors: ['iCal URL is required'] };
    }

    try {
      const response = await fetch(config.icalUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch iCal feed (${response.status})`);
      }

      const icalData = await response.text();
      const events = this.parseICalData(icalData);
      
      let added = 0;
      let updated = 0;
      const errors: string[] = [];
      
      const now = new Date();
      const futureEvents = events.filter(e => e.dtstart && e.dtstart > now);

      for (const icalEvent of futureEvents) {
        try {
          if (!icalEvent.uid) continue;
          
          const existingEvent = await storage.getEventByExternalId(source.userId, source.id, icalEvent.uid);
          
          const eventData: InsertEvent = {
            userId: source.userId,
            sourceId: source.id,
            externalId: icalEvent.uid,
            title: icalEvent.summary || 'Untitled Event',
            description: icalEvent.description || null,
            startTime: icalEvent.dtstart || new Date(),
            endTime: icalEvent.dtend || null,
            timezone: 'America/Chicago',
            location: icalEvent.location || null,
            eventUrl: icalEvent.url || null,
            isAllDay: false,
            visibility: 'public',
            category: this.categorizeEvent(icalEvent.summary || ''),
            rawData: icalEvent as any,
          };

          if (existingEvent) {
            await storage.updateEvent(existingEvent.id, eventData);
            updated++;
          } else {
            await storage.createEvent(eventData);
            added++;
          }
        } catch (eventError: any) {
          errors.push(`Failed to process iCal event: ${eventError.message}`);
        }
      }

      return { added, updated, errors };
    } catch (error: any) {
      return { added: 0, updated: 0, errors: [error.message] };
    }
  }

  private parseICalData(data: string): ICalEvent[] {
    const events: ICalEvent[] = [];
    const lines = data.split(/\r?\n/);
    
    let currentEvent: Partial<ICalEvent> | null = null;
    let currentProperty = '';
    let currentValue = '';

    for (const line of lines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        currentValue += line.substring(1);
        continue;
      }

      if (currentEvent && currentProperty) {
        this.processICalProperty(currentEvent, currentProperty, currentValue);
      }

      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = {};
      } else if (line.startsWith('END:VEVENT') && currentEvent) {
        if (currentEvent.uid) {
          events.push(currentEvent as ICalEvent);
        }
        currentEvent = null;
      } else if (currentEvent && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const propertyPart = line.substring(0, colonIndex);
        currentProperty = propertyPart.split(';')[0];
        currentValue = line.substring(colonIndex + 1);
      }
    }

    return events;
  }

  private processICalProperty(event: Partial<ICalEvent>, property: string, value: string): void {
    switch (property.toUpperCase()) {
      case 'UID':
        event.uid = value;
        break;
      case 'SUMMARY':
        event.summary = this.unescapeICalValue(value);
        break;
      case 'DESCRIPTION':
        event.description = this.unescapeICalValue(value);
        break;
      case 'LOCATION':
        event.location = this.unescapeICalValue(value);
        break;
      case 'URL':
        event.url = value;
        break;
      case 'DTSTART':
        event.dtstart = this.parseICalDate(value);
        break;
      case 'DTEND':
        event.dtend = this.parseICalDate(value);
        break;
    }
  }

  private parseICalDate(value: string): Date | undefined {
    if (!value) return undefined;
    
    if (value.length === 8) {
      const year = parseInt(value.substring(0, 4));
      const month = parseInt(value.substring(4, 6)) - 1;
      const day = parseInt(value.substring(6, 8));
      return new Date(year, month, day);
    }
    
    if (value.includes('T')) {
      const cleanValue = value.replace('Z', '');
      const year = parseInt(cleanValue.substring(0, 4));
      const month = parseInt(cleanValue.substring(4, 6)) - 1;
      const day = parseInt(cleanValue.substring(6, 8));
      const hour = parseInt(cleanValue.substring(9, 11)) || 0;
      const minute = parseInt(cleanValue.substring(11, 13)) || 0;
      const second = parseInt(cleanValue.substring(13, 15)) || 0;
      
      if (value.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      }
      return new Date(year, month, day, hour, minute, second);
    }
    
    return new Date(value);
  }

  private unescapeICalValue(value: string): string {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  private categorizeEvent(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('open house') || titleLower.includes('home tour') || titleLower.includes('property')) {
      return 'real_estate';
    }
    if (titleLower.includes('market') || titleLower.includes("farmer's") || titleLower.includes('farmers')) {
      return 'market';
    }
    if (titleLower.includes('festival') || titleLower.includes('parade') || titleLower.includes('celebration')) {
      return 'festival';
    }
    if (titleLower.includes('network') || titleLower.includes('mixer') || titleLower.includes('professional')) {
      return 'networking';
    }
    if (titleLower.includes('concert') || titleLower.includes('music') || titleLower.includes('band')) {
      return 'entertainment';
    }
    if (titleLower.includes('sports') || titleLower.includes('game') || titleLower.includes('tournament')) {
      return 'sports';
    }
    if (titleLower.includes('class') || titleLower.includes('workshop') || titleLower.includes('seminar')) {
      return 'education';
    }
    
    return 'community';
  }

  async addManualEvent(userId: string, eventData: {
    title: string;
    description?: string;
    startTime: Date;
    endTime?: Date;
    location?: string;
    category?: string;
  }): Promise<Event> {
    let manualSource = (await storage.getEventSources(userId))
      .find(s => s.type === 'manual');
    
    if (!manualSource) {
      manualSource = await storage.createEventSource({
        userId,
        name: 'Manual Events',
        type: 'manual',
        status: 'active',
      });
    }

    const { nanoid } = await import('nanoid');
    
    return storage.createEvent({
      userId,
      sourceId: manualSource.id,
      externalId: `manual-${nanoid()}`,
      title: eventData.title,
      description: eventData.description || null,
      startTime: eventData.startTime,
      endTime: eventData.endTime || null,
      location: eventData.location || null,
      category: eventData.category || 'community',
      visibility: 'public',
      isAllDay: false,
    });
  }

  getPopularOmahaCalendars(): { name: string; type: string; calendarId?: string; icalUrl?: string }[] {
    return [
      {
        name: 'US Holidays',
        type: 'google_calendar_public',
        calendarId: 'en.usa#holiday@group.v.calendar.google.com',
      },
      {
        name: 'Omaha City Events',
        type: 'ical',
        icalUrl: 'https://www.visitomaha.com/events/rss/',
      },
    ];
  }
}

export const eventIngestionService = EventIngestionService.getInstance();
