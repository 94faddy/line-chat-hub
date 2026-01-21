//PATH: src/models/Conversation.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IConversation extends Document {
  _id: Types.ObjectId;
  channel_id: Types.ObjectId;
  line_user_id: Types.ObjectId;
  status: 'unread' | 'read' | 'processing' | 'completed' | 'spam';
  assigned_to?: Types.ObjectId;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  last_message_preview?: string;
  last_message_at?: Date;
  unread_count: number;
  tags: Types.ObjectId[];
  notes?: string; // ✅ เพิ่ม notes field
  created_at: Date;
  updated_at: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
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
    status: {
      type: String,
      enum: ['unread', 'read', 'processing', 'completed', 'spam'],
      default: 'unread',
      index: true,
    },
    assigned_to: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    last_message_preview: String,
    last_message_at: {
      type: Date,
      index: true,
    },
    unread_count: {
      type: Number,
      default: 0,
    },
    tags: [{
      type: Schema.Types.ObjectId,
      ref: 'Tag',
    }],
    // ✅ เพิ่ม notes field สำหรับเก็บบันทึกภายใน
    notes: {
      type: String,
      default: null,
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

// Indexes สำหรับ query ที่ใช้บ่อย
ConversationSchema.index({ channel_id: 1, line_user_id: 1 }, { unique: true });
ConversationSchema.index({ channel_id: 1, status: 1, last_message_at: -1 });
ConversationSchema.index({ channel_id: 1, last_message_at: -1 });
ConversationSchema.index({ assigned_to: 1, status: 1 });

// Virtual populate
ConversationSchema.virtual('channel', {
  ref: 'LineChannel',
  localField: 'channel_id',
  foreignField: '_id',
  justOne: true,
});

ConversationSchema.virtual('line_user', {
  ref: 'LineUser',
  localField: 'line_user_id',
  foreignField: '_id',
  justOne: true,
});

const Conversation: Model<IConversation> =
  mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

export default Conversation;
