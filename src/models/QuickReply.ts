// src/models/QuickReply.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IQuickReplyMessage {
  type: 'text' | 'image' | 'flex';
  content: string;
  flex_content?: any;
  media_url?: string;
}

export interface IQuickReply extends Document {
  _id: Types.ObjectId;
  channel_id: Types.ObjectId;
  created_by: Types.ObjectId;
  title: string;
  shortcut?: string;
  // Legacy fields (optional)
  message_type?: 'text' | 'image' | 'template' | 'flex';
  content?: string;
  flex_content?: any;
  media_url?: string;
  // New: Multiple messages
  messages?: IQuickReplyMessage[];
  is_active: boolean;
  use_count: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

const QuickReplyMessageSchema = new Schema<IQuickReplyMessage>(
  {
    type: {
      type: String,
      enum: ['text', 'image', 'flex'],
      required: true,
      default: 'text',
    },
    content: {
      type: String,
      required: true,
    },
    flex_content: Schema.Types.Mixed,
    media_url: String,
  },
  { _id: false }
);

const QuickReplySchema = new Schema<IQuickReply>(
  {
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineChannel',
      required: true,
      index: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    shortcut: {
      type: String,
      trim: true,
      index: true,
    },
    // Legacy fields - ไม่บังคับ
    message_type: {
      type: String,
      enum: ['text', 'image', 'template', 'flex'],
    },
    content: String,  // ไม่มี required
    flex_content: Schema.Types.Mixed,
    media_url: String,
    // New: Multiple messages array
    messages: [QuickReplyMessageSchema],
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    use_count: {
      type: Number,
      default: 0,
    },
    sort_order: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

QuickReplySchema.index({ channel_id: 1, is_active: 1, sort_order: 1 });
QuickReplySchema.index({ channel_id: 1, shortcut: 1 });

// ลบ model เก่าถ้ามี
if (mongoose.models.QuickReply) {
  delete mongoose.models.QuickReply;
}

const QuickReply: Model<IQuickReply> = mongoose.model<IQuickReply>('QuickReply', QuickReplySchema);

export default QuickReply;