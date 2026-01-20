/**
 * Migration Script: MySQL → MongoDB
 * 
 * วิธีใช้:
 * 1. npm install mysql2 mongoose dotenv
 * 2. แก้ไข MYSQL_CONFIG ด้านล่าง
 * 3. node scripts/migrate-mysql-to-mongodb.js
 */

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

// ==================== CONFIG ====================

// แก้ไขตรงนี้ให้ตรงกับ MySQL เดิม
const MYSQL_CONFIG = {
  host: 'localhost',
  user: 'subadmin',
  password: 'LB-Us4YdsTU@pkH72RgO!',
  database: 'line_chat_hub',
};

// MongoDB URI จาก .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://owner:W%3AT9%286.8hHe%24CmZC@127.0.0.1:27017/line_chat_hub';

// ==================== SCHEMAS ====================

const UserSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number, // เก็บ ID เดิมไว้ mapping
  name: String,
  email: { type: String, unique: true },
  password: String,
  avatar: String,
  role: { type: String, default: 'user' },
  status: { type: String, default: 'active' },
  email_verified: { type: Boolean, default: false },
  verification_token: String,
  reset_token: String,
  reset_token_expires: Date,
  settings: mongoose.Schema.Types.Mixed,
  bot_api_token: String,
  last_login: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const LineChannelSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  channel_id: String,
  channel_secret: String,
  channel_access_token: String,
  channel_name: String,
  channel_picture_url: String,
  webhook_url: String,
  status: { type: String, default: 'active' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const LineUserSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  channel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineChannel' },
  line_user_id: String,
  display_name: String,
  picture_url: String,
  status_message: String,
  language: String,
  is_blocked: { type: Boolean, default: false },
  is_following: { type: Boolean, default: true },
  tags: [String],
  custom_fields: mongoose.Schema.Types.Mixed,
  last_message_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const ConversationSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  channel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineChannel' },
  line_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineUser' },
  status: { type: String, default: 'unread' },
  priority: { type: String, default: 'normal' },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  notes: String,
  unread_count: { type: Number, default: 0 },
  last_message_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const MessageSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  channel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineChannel' },
  line_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineUser' },
  line_message_id: String,
  direction: String,
  message_type: { type: String, default: 'text' },
  content: String,
  media_url: String,
  media_type: String,
  sticker_id: String,
  package_id: String,
  location: mongoose.Schema.Types.Mixed,
  flex_content: mongoose.Schema.Types.Mixed,
  is_read: { type: Boolean, default: false },
  read_at: Date,
  sent_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  source: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const TagSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  color: { type: String, default: '#06C755' },
  description: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const QuickReplySchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  channel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineChannel' },
  title: String,
  shortcut: String,
  message_type: { type: String, default: 'text' },
  content: String,
  flex_content: mongoose.Schema.Types.Mixed,
  media_url: String,
  is_active: { type: Boolean, default: true },
  use_count: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const AdminPermissionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  channel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineChannel' },
  can_reply: { type: Boolean, default: true },
  can_view_all: { type: Boolean, default: false },
  can_broadcast: { type: Boolean, default: false },
  can_manage_tags: { type: Boolean, default: false },
  status: { type: String, default: 'active' },
  invite_token: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const BroadcastSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  old_id: Number,
  channel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LineChannel' },
  title: String,
  message_type: { type: String, default: 'text' },
  content: String,
  flex_content: mongoose.Schema.Types.Mixed,
  media_url: String,
  target_type: { type: String, default: 'all' },
  target_tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  status: { type: String, default: 'draft' },
  scheduled_at: Date,
  sent_at: Date,
  total_recipients: { type: Number, default: 0 },
  success_count: { type: Number, default: 0 },
  fail_count: { type: Number, default: 0 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ==================== MODELS ====================

const User = mongoose.model('User', UserSchema);
const LineChannel = mongoose.model('LineChannel', LineChannelSchema);
const LineUser = mongoose.model('LineUser', LineUserSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);
const Tag = mongoose.model('Tag', TagSchema);
const QuickReply = mongoose.model('QuickReply', QuickReplySchema);
const AdminPermission = mongoose.model('AdminPermission', AdminPermissionSchema);
const Broadcast = mongoose.model('Broadcast', BroadcastSchema);

// ==================== ID MAPPING ====================

const idMap = {
  users: {},        // old_id -> new ObjectId
  channels: {},     // old_id -> new ObjectId
  line_users: {},   // old_id -> new ObjectId
  conversations: {},// old_id -> new ObjectId
  tags: {},         // old_id -> new ObjectId
};

// ==================== MIGRATION FUNCTIONS ====================

async function migrateUsers(mysqlConn) {
  console.log('\n📦 Migrating Users...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM users');
  console.log(`   Found ${rows.length} users`);
  
  for (const row of rows) {
    const newId = new mongoose.Types.ObjectId();
    idMap.users[row.id] = newId;
    
    // Safe JSON parse helper
    const safeJsonParse = (data) => {
      if (!data) return null;
      if (typeof data === 'object') return data;
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };
    
    await User.create({
      _id: newId,
      old_id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      avatar: row.avatar,
      role: row.role || 'user',
      status: row.status || 'active',
      email_verified: row.email_verified || false,
      verification_token: row.verification_token,
      reset_token: row.reset_token,
      reset_token_expires: row.reset_token_expires,
      settings: safeJsonParse(row.settings) || {},
      bot_api_token: row.bot_api_token,
      last_login: row.last_login,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} users`);
}

async function migrateLineChannels(mysqlConn) {
  console.log('\n📦 Migrating LINE Channels...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM line_channels');
  console.log(`   Found ${rows.length} channels`);
  
  for (const row of rows) {
    const newId = new mongoose.Types.ObjectId();
    idMap.channels[row.id] = newId;
    
    await LineChannel.create({
      _id: newId,
      old_id: row.id,
      user_id: idMap.users[row.user_id],
      channel_id: row.channel_id,
      channel_secret: row.channel_secret,
      channel_access_token: row.channel_access_token,
      channel_name: row.channel_name,
      channel_picture_url: row.channel_picture_url,
      webhook_url: row.webhook_url,
      status: row.status || 'active',
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} channels`);
}

async function migrateLineUsers(mysqlConn) {
  console.log('\n📦 Migrating LINE Users...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM line_users');
  console.log(`   Found ${rows.length} LINE users`);
  
  for (const row of rows) {
    const newId = new mongoose.Types.ObjectId();
    idMap.line_users[row.id] = newId;
    
    // Safe JSON parse helper
    const safeJsonParse = (data) => {
      if (!data) return null;
      if (typeof data === 'object') return data;
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };
    
    await LineUser.create({
      _id: newId,
      old_id: row.id,
      channel_id: idMap.channels[row.channel_id],
      line_user_id: row.line_user_id,
      display_name: row.display_name,
      picture_url: row.picture_url,
      status_message: row.status_message,
      language: row.language,
      is_blocked: row.is_blocked || false,
      is_following: row.is_following !== false,
      tags: safeJsonParse(row.tags) || [],
      custom_fields: safeJsonParse(row.custom_fields) || {},
      last_message_at: row.last_message_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} LINE users`);
}

async function migrateTags(mysqlConn) {
  console.log('\n📦 Migrating Tags...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM tags');
  console.log(`   Found ${rows.length} tags`);
  
  for (const row of rows) {
    const newId = new mongoose.Types.ObjectId();
    idMap.tags[row.id] = newId;
    
    await Tag.create({
      _id: newId,
      old_id: row.id,
      user_id: idMap.users[row.user_id],
      name: row.name,
      color: row.color || '#06C755',
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} tags`);
}

async function migrateConversations(mysqlConn) {
  console.log('\n📦 Migrating Conversations...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM conversations');
  console.log(`   Found ${rows.length} conversations`);
  
  for (const row of rows) {
    const newId = new mongoose.Types.ObjectId();
    idMap.conversations[row.id] = newId;
    
    // Safe JSON parse helper
    const safeJsonParse = (data) => {
      if (!data) return null;
      if (typeof data === 'object') return data;
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };
    
    // Parse tags if stored as JSON
    let tagIds = [];
    const parsedTags = safeJsonParse(row.tags);
    if (parsedTags && Array.isArray(parsedTags)) {
      tagIds = parsedTags.map(id => idMap.tags[id]).filter(Boolean);
    }
    
    await Conversation.create({
      _id: newId,
      old_id: row.id,
      channel_id: idMap.channels[row.channel_id],
      line_user_id: idMap.line_users[row.line_user_id],
      status: row.status || 'unread',
      priority: row.priority || 'normal',
      assigned_to: row.assigned_to ? idMap.users[row.assigned_to] : null,
      tags: tagIds,
      notes: row.notes,
      unread_count: row.unread_count || 0,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} conversations`);
}

async function migrateMessages(mysqlConn) {
  console.log('\n📦 Migrating Messages...');
  
  // ใช้ streaming เพราะอาจมีข้อมูลเยอะ
  const [rows] = await mysqlConn.execute('SELECT COUNT(*) as count FROM messages');
  const totalCount = rows[0].count;
  console.log(`   Found ${totalCount} messages`);
  
  const batchSize = 1000;
  let offset = 0;
  let migrated = 0;
  
  while (offset < totalCount) {
    const [batch] = await mysqlConn.execute(
      `SELECT * FROM messages ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`
    );
    
    const docs = batch.map(row => {
      // Safe JSON parse helper
      const safeJsonParse = (data) => {
        if (!data) return null;
        if (typeof data === 'object') return data;
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      };
      
      return {
        _id: new mongoose.Types.ObjectId(),
        old_id: row.id,
        conversation_id: idMap.conversations[row.conversation_id],
        channel_id: idMap.channels[row.channel_id],
        line_user_id: idMap.line_users[row.line_user_id],
        line_message_id: row.line_message_id,
        direction: row.direction,
        message_type: row.message_type || 'text',
        content: row.content,
        media_url: row.media_url,
        media_type: row.media_type,
        sticker_id: row.sticker_id,
        package_id: row.package_id,
        location: safeJsonParse(row.location),
        flex_content: safeJsonParse(row.flex_content),
        is_read: row.is_read || false,
        read_at: row.read_at,
        sent_by: row.sent_by ? idMap.users[row.sent_by] : null,
        source: row.source,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
    
    await Message.insertMany(docs, { ordered: false });
    
    migrated += batch.length;
    offset += batchSize;
    
    process.stdout.write(`\r   Processing: ${migrated}/${totalCount} (${Math.round(migrated/totalCount*100)}%)`);
  }
  
  console.log(`\n   ✅ Migrated ${migrated} messages`);
}

async function migrateQuickReplies(mysqlConn) {
  console.log('\n📦 Migrating Quick Replies...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM quick_replies');
  console.log(`   Found ${rows.length} quick replies`);
  
  for (const row of rows) {
    // Safe JSON parse helper
    const safeJsonParse = (data) => {
      if (!data) return null;
      if (typeof data === 'object') return data;
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };
    
    await QuickReply.create({
      _id: new mongoose.Types.ObjectId(),
      old_id: row.id,
      user_id: idMap.users[row.user_id],
      channel_id: row.channel_id ? idMap.channels[row.channel_id] : null,
      title: row.title,
      shortcut: row.shortcut,
      message_type: row.message_type || 'text',
      content: row.content,
      flex_content: safeJsonParse(row.flex_content),
      media_url: row.media_url,
      is_active: row.is_active !== false,
      use_count: row.use_count || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} quick replies`);
}

async function migrateAdminPermissions(mysqlConn) {
  console.log('\n📦 Migrating Admin Permissions...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM admin_permissions');
  console.log(`   Found ${rows.length} permissions`);
  
  for (const row of rows) {
    await AdminPermission.create({
      _id: new mongoose.Types.ObjectId(),
      old_id: row.id,
      owner_id: idMap.users[row.owner_id],
      admin_id: row.admin_id ? idMap.users[row.admin_id] : null,
      channel_id: row.channel_id ? idMap.channels[row.channel_id] : null,
      can_reply: row.can_reply !== false,
      can_view_all: row.can_view_all || false,
      can_broadcast: row.can_broadcast || false,
      can_manage_tags: row.can_manage_tags || false,
      status: row.status || 'active',
      invite_token: row.invite_token,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} permissions`);
}

async function migrateBroadcasts(mysqlConn) {
  console.log('\n📦 Migrating Broadcasts...');
  
  const [rows] = await mysqlConn.execute('SELECT * FROM broadcasts');
  console.log(`   Found ${rows.length} broadcasts`);
  
  for (const row of rows) {
    // Safe JSON parse helper
    const safeJsonParse = (data) => {
      if (!data) return null;
      if (typeof data === 'object') return data;
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };
    
    let targetTags = [];
    const parsedTags = safeJsonParse(row.target_tags);
    if (parsedTags && Array.isArray(parsedTags)) {
      targetTags = parsedTags.map(id => idMap.tags[id]).filter(Boolean);
    }
    
    await Broadcast.create({
      _id: new mongoose.Types.ObjectId(),
      old_id: row.id,
      channel_id: idMap.channels[row.channel_id],
      title: row.title,
      message_type: row.message_type || 'text',
      content: row.content,
      flex_content: safeJsonParse(row.flex_content),
      media_url: row.media_url,
      target_type: row.target_type || 'all',
      target_tags: targetTags,
      status: row.status || 'draft',
      scheduled_at: row.scheduled_at,
      sent_at: row.sent_at,
      total_recipients: row.total_recipients || 0,
      success_count: row.success_count || 0,
      fail_count: row.fail_count || 0,
      created_by: row.created_by ? idMap.users[row.created_by] : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  console.log(`   ✅ Migrated ${rows.length} broadcasts`);
}

// ==================== MAIN ====================

async function main() {
  console.log('🚀 Starting MySQL → MongoDB Migration\n');
  console.log('=' .repeat(50));
  
  let mysqlConn;
  
  try {
    // Connect to MySQL
    console.log('📡 Connecting to MySQL...');
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('   ✅ MySQL connected');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('   ✅ MongoDB connected');
    
    // Clear existing data (optional - comment out if you don't want this)
    console.log('\n🗑️  Clearing existing MongoDB data...');
    await Promise.all([
      User.deleteMany({}),
      LineChannel.deleteMany({}),
      LineUser.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Tag.deleteMany({}),
      QuickReply.deleteMany({}),
      AdminPermission.deleteMany({}),
      Broadcast.deleteMany({}),
    ]);
    console.log('   ✅ Cleared');
    
    // Run migrations in order (dependencies matter!)
    await migrateUsers(mysqlConn);
    await migrateLineChannels(mysqlConn);
    await migrateLineUsers(mysqlConn);
    await migrateTags(mysqlConn);
    await migrateConversations(mysqlConn);
    await migrateMessages(mysqlConn);
    await migrateQuickReplies(mysqlConn);
    await migrateAdminPermissions(mysqlConn);
    await migrateBroadcasts(mysqlConn);
    
    // Create indexes
    console.log('\n📊 Creating indexes...');
    await Message.collection.createIndex({ conversation_id: 1, created_at: 1 });
    await Message.collection.createIndex({ channel_id: 1, created_at: -1 });
    await Conversation.collection.createIndex({ channel_id: 1, status: 1, last_message_at: -1 });
    await LineUser.collection.createIndex({ channel_id: 1, line_user_id: 1 }, { unique: true });
    console.log('   ✅ Indexes created');
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Migration completed successfully!');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (mysqlConn) await mysqlConn.end();
    await mongoose.disconnect();
  }
}

main();