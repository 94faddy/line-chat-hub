export interface User {
  id: number;
  email: string;
  name: string;
  password?: string;
  avatar?: string;
  role: 'super_admin' | 'admin' | 'user';
  status: 'pending' | 'active' | 'suspended';
  settings?: UserSettings;
  email_verified_at?: Date;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserSettings {
  notifications?: {
    email_new_message?: boolean;
    email_daily_report?: boolean;
    browser_notifications?: boolean;
    sound_enabled?: boolean;
  };
  chat?: {
    auto_assign?: boolean;
    auto_reply_enabled?: boolean;
    working_hours_only?: boolean;
    working_hours_start?: string;
    working_hours_end?: string;
  };
  general?: {
    timezone?: string;
    language?: string;
    date_format?: string;
  };
}

export interface UserWithPassword extends User {
  password: string;
}

export interface LineChannel {
  id: number;
  user_id: number;
  channel_name: string;
  channel_id: string;
  channel_secret: string;
  channel_access_token: string;
  webhook_url?: string;
  basic_id?: string;
  picture_url?: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface LineUser {
  id: number;
  channel_id: number;
  line_user_id: string;
  display_name?: string;
  picture_url?: string;
  status_message?: string;
  language?: string;
  tags?: string[];
  notes?: string;
  is_blocked: boolean;
  is_spam: boolean;
  last_message_at?: Date;
  created_at: Date;
  updated_at: Date;
  channel?: LineChannel;
}

export interface Conversation {
  id: number;
  channel_id: number;
  line_user_id: number;
  status: 'unread' | 'read' | 'processing' | 'completed' | 'spam';
  assigned_to?: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  last_message_preview?: string;
  last_message_at?: Date;
  unread_count: number;
  created_at: Date;
  updated_at: Date;
  channel?: LineChannel;
  line_user?: LineUser;
  tags?: Tag[];
}

export interface Message {
  id: number;
  conversation_id: number;
  channel_id: number;
  line_user_id: number;
  message_id?: string;
  direction: 'incoming' | 'outgoing';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | 'template' | 'flex';
  content?: string;
  media_url?: string;
  media_type?: string;
  sticker_id?: string;
  package_id?: string;
  reply_token?: string;
  sent_by?: number;
  is_read: boolean;
  read_at?: Date;
  delivered_at?: Date;
  error_message?: string;
  created_at: Date;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  description?: string;
  created_at: Date;
}

export interface QuickReply {
  id: number;
  user_id: number;
  channel_id?: number;
  title: string;
  shortcut?: string;
  message_type: 'text' | 'image' | 'template';
  content: string;
  media_url?: string;
  is_global: boolean;
  use_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface AdminPermission {
  id: number;
  owner_id: number;
  admin_id: number;
  channel_id?: number;
  permissions?: {
    can_reply: boolean;
    can_view: boolean;
    can_tag: boolean;
    can_assign: boolean;
  };
  status: 'pending' | 'active' | 'revoked';
  invited_at: Date;
  accepted_at?: Date;
  created_at: Date;
  updated_at: Date;
  owner?: User;
  admin?: User;
  channel?: LineChannel;
}

export interface AutoReply {
  id: number;
  user_id: number;
  channel_id?: number;
  name: string;
  trigger_type: 'keyword' | 'first_message' | 'schedule';
  trigger_keywords?: string[];
  message_type: 'text' | 'image' | 'template' | 'flex';
  content: string;
  media_url?: string;
  is_active: boolean;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface Broadcast {
  id: number;
  user_id: number;
  channel_id: number;
  name: string;
  message_type: 'text' | 'image' | 'template' | 'flex';
  content: string;
  media_url?: string;
  target_count: number;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConversationWithDetails extends Conversation {
  channel: LineChannel;
  line_user: LineUser;
  tags: Tag[];
  last_message?: Message;
}

export interface DashboardStats {
  total_channels: number;
  total_conversations: number;
  unread_conversations: number;
  total_messages_today: number;
  total_users: number;
}
