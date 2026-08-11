const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ganavishekhar2005_db_user:ojsDMZQHcLKWNSVv@userdetails.mhhdnqw.mongodb.net/placify?retryWrites=true&w=majority';

const userSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  salt: { type: String, required: true },
  chosen_domain: { type: String, default: 'fullstack' },
  timeline_weeks: { type: Number, default: 4 },
  daily_hours: { type: Number, default: 2.0 },
  current_skill_level: { type: String, default: 'UNASSESSED' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema, 'Registration');

async function initDatabase() {
  console.log('🔌 Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas successfully!');
    
    // Insert initial record to populate database in Compass
    const existing = await User.findOne({ email: 'admin@placify.ai' });
    if (!existing) {
      await User.create({
        user_id: 'usr_system_init',
        name: 'Placify System Administrator',
        email: 'admin@placify.ai',
        password_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        salt: '00000000000000000000000000000000',
        chosen_domain: 'fullstack',
        timeline_weeks: 4,
        daily_hours: 2.0,
        current_skill_level: 'ADMIN'
      });
      console.log('🎉 Successfully created "placify" database and "users" collection in MongoDB Atlas!');
    } else {
      console.log('✅ "placify" database and "users" collection are already active in MongoDB Atlas!');
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

initDatabase();
