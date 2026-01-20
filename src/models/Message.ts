import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversation_id: Types.ObjectId;
  channel_id: Types.ObjectId;
  line_user_id: Types.ObjectId;
  message_id?: string; // LINE message ID
  bot_message_id?: string;
  direction: 'incoming' | 'outgoing';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | 'template' | 'flex';
  content?: string;
  flex_content?: any;
  media_url?: string;
  media_type?: string;
  sticker_id?: string;
  package_id?: string;
  reply_token?: string;
  sent_by?: Types.ObjectId;
  source_type: 'manual' | 'auto_reply' | 'bot_reply' | 'broadcast';
  is_read: boolean;
  read_at?: Date;
  delivered_at?: Date;
  error_message?: string;
  created_at: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineChannel',
      required: true,
      index: true,
    },
    line_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineUser',
      required: true,
      index: true,
    },
    message_id: {
      type: String,
      sparse: true,
      index: true,
    },
    bot_message_id: {
      type: String,
      sparse: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['incoming', 'outgoing'],
      required: true,
      index: true,
    },
    message_type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'sticker', 'template', 'flex'],
      required: true,
    },
    content: String,
    flex_content: Schema.Types.Mixed,
    media_url: String,
    media_type: String,
    sticker_id: String,
    package_id: String,
    reply_token: String,
    sent_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    source_type: {
      type: String,
      enum: ['manual', 'auto_reply', 'bot_reply', 'broadcast'],
      default: 'manual',
      index: true,
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },
    read_at: Date,
    delivered_at: Date,
    error_message: String,
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // ใช้ created_at แบบ manual
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ⭐ Indexes ที่สำคัญสำหรับ Performance กับล้านข้อความ
// Compound indexes สำหรับ queries ที่ใช้บ่อย
MessageSchema.index({ conversation_id: 1, created_at: 1 }); // ดึงข้อความตาม conversation
MessageSchema.index({ conversation_id: 1, created_at: -1 }); // ดึงข้อความล่าสุด
MessageSchema.index({ channel_id: 1, created_at: -1 }); // ดึงข้อความตาม channel
MessageSchema.index({ channel_id: 1, direction: 1, created_at: -1 }); // นับข้อความ incoming/outgoing

// TTL Index - ลบข้อความเก่าอัตโนมัติหลัง 1 ปี (optional)
// MessageSchema.index({ created_at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Text index สำหรับค้นหาข้อความ
MessageSchema.index({ content: 'text' });

const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
