
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname,resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:false
});

const initDb = async () => {
  try {
    // Create tables and ensure the 'unique_pattern' constraint is added
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        sender VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        pattern TEXT NOT NULL,
        response TEXT NOT NULL,
        CONSTRAINT unique_pattern UNIQUE (pattern)  -- Ensures unique constraint
      );

      CREATE TABLE IF NOT EXISTS user_data (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        data_key VARCHAR(100) NOT NULL,
        data_value TEXT NOT NULL
      );
    `);

    // Insert sample user data
    await pool.query(`
      INSERT INTO user_data (category, data_key, data_value)
      VALUES 
        ('personal', 'name', 'John Doe'),
        ('personal', 'email', 'john@example.com'),
        ('preferences', 'theme', 'dark'),
        ('preferences', 'language', 'english')
      ON CONFLICT DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO responses (pattern, response)
      VALUES 
        ('hello', 'Hi there! I''m your chatbot assistant. How can I help you today?'),
        ('help', 'I can assist you with general questions, provide information, or just chat. What would you like to know?'),
        ('bye', 'Goodbye! Have a great day! Feel free to come back if you need anything.'),
        ('show data', 'Here''s the data you requested: {data}'),
        ('search', 'I''ll help you search for: {query}')
      ON CONFLICT (pattern) DO UPDATE 
      SET response = EXCLUDED.response;
    `);
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};





initDb();

const saveMessage = async (content, sender) => {
  try {
    const query = 'INSERT INTO messages (content, sender) VALUES ($1, $2) RETURNING *';
    const values = [content, sender];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }
};

const searchUserData = async (query) => {
  try {
    const searchQuery = `
      SELECT * FROM user_data 
      WHERE 
        LOWER(category) LIKE LOWER($1) OR 
        LOWER(data_key) LIKE LOWER($1) OR 
        LOWER(data_value) LIKE LOWER($1)
    `;
    const result = await pool.query(searchQuery, [`%${query}%`]);
    return result.rows;
  } catch (error) {
    console.error('Error searching data:', error);
    throw new Error('Failed to search data');
  }
};

const findResponse = async (message) => {
  try {
    // Check if it's a data query
    const searchTerms = message.toLowerCase().match(/search for|find|show|get|query/);
    if (searchTerms) {
      const query = message.toLowerCase().replace(/search for|find|show|get|query/g, '').trim();
      const data = await searchUserData(query);
      
      if (data.length > 0) {
        return {
          type: 'data',
          content: data
        };
      }
    }

    // Regular chatbot response
    const exactQuery = 'SELECT response FROM responses WHERE lower($1) LIKE lower(pattern) || \'%\' LIMIT 1';
    let result = await pool.query(exactQuery, [message.toLowerCase()]);

    if (!result.rows.length) {
      const fuzzyQuery = 'SELECT response FROM responses WHERE $1 ILIKE \'%\' || pattern || \'%\' LIMIT 1';
      result = await pool.query(fuzzyQuery, [message.toLowerCase()]);
    }

    return {
      type: 'text',
      content: result.rows[0]?.response || "I'm not sure how to respond to that. Could you please rephrase or ask something else?"
    };
  } catch (error) {
    console.error('Error finding response:', error);
    throw new Error('Failed to process response');
  }
};

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    await saveMessage(message, 'user');
    
    const response = await findResponse(message);
    const reply = response.type === 'data' 
      ? { type: 'data', content: response.content }
      : { type: 'text', content: response.content };
    
    await saveMessage(JSON.stringify(reply), 'bot');
    
    res.json(reply);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Existing endpoints remain the same
app.get('/api/messages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT * FROM messages ORDER BY timestamp ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM messages');
    const totalMessages = parseInt(countResult.rows[0].count);

    res.json({
      messages: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

app.delete('/api/messages', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE messages');
    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});






