import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ILineUser extends Document {
  _id: Types.ObjectId;
  channel_id: Types.ObjectId;
  line_user_id: string;
  display_name?: string;
  picture_url?: string;
  status_message?: string;
  language?: string;
  tags?: string[];
  notes?: string;
  is_blocked: boolean;
  is_spam: boolean;
  follow_status: 'following' | 'unfollowed' | 'blocked' | 'unknown';
  last_message_at?: Date;
  // ✅ เพิ่มรองรับ Group/Room
  source_type: 'user' | 'group' | 'room';
  group_id?: string; // LINE Group ID (ถ้าเป็น group)
  room_id?: string;  // LINE Room ID (ถ้าเป็น room)
  member_count?: number; // จำนวนสมาชิกในกลุ่ม
  created_at: Date;
  updated_at: Date;
}

const LineUserSchema = new Schema<ILineUser>(
  {
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineChannel',
      required: true,
      index: true,
    },
    line_user_id: {
      type: String,
      required: true,
      index: true,
    },
    display_name: {
      type: String,
      default: null,
    },
    picture_url: String,
    status_message: String,
    language: {
      type: String,
      default: 'th',
    },
    tags: [String],
    notes: String,
    is_blocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_spam: {
      type: Boolean,
      default: false,
      index: true,
    },
    follow_status: {
      type: String,
      enum: ['following', 'unfollowed', 'blocked', 'unknown'],
      default: 'unknown',
      index: true,
    },
    last_message_at: {
      type: Date,
      index: true,
    },
    // ✅ เพิ่มรองรับ Group/Room
    source_type: {
      type: String,
      enum: ['user', 'group', 'room'],
      default: 'user',
      index: true,
    },
    group_id: {
      type: String,
      sparse: true,
      index: true,
    },
    room_id: {
      type: String,
      sparse: true,
      index: true,
    },
    member_count: {
      type: Number,
      default: 0,
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

// Compound index for unique LINE user per channel
LineUserSchema.index({ channel_id: 1, line_user_id: 1 }, { unique: true });
LineUserSchema.index({ channel_id: 1, is_blocked: 1 });
LineUserSchema.index({ channel_id: 1, last_message_at: -1 });

const LineUser: Model<ILineUser> =
  mongoose.models.LineUser || mongoose.model<ILineUser>('LineUser', LineUserSchema);

export default LineUser;