import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserSettings {
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

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  password: string;
  avatar?: string;
  role: 'super_admin' | 'admin' | 'user';
  status: 'pending' | 'active' | 'suspended';
  settings?: IUserSettings;
  verification_token?: string;
  reset_token?: string;
  reset_token_expires?: Date;
  bot_api_token?: string;
  email_verified_at?: Date;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: String,
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'user'],
      default: 'user',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
      index: true,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    verification_token: String,
    reset_token: String,
    reset_token_expires: Date,
    bot_api_token: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple nulls
      index: true,
    },
    email_verified_at: Date,
    last_login: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Check if model exists before creating
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
