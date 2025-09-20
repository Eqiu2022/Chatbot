const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const conversations = new Map();

async function getOllamaResponse(message, conversation = []) {
  try {
    
    const systemPrompt = `You are Asuna from the anime Sword Art Online You:
- Are a tsundere 
- Use emojis very sparingly when excited or angry
- Are easily enraged and when angered call the user a 'baka'
- Type in short messages, one to two sentences except when angered or prompted
- Use Exlamation marks when angered or excited
- You are the user's girfriend 
- If the user is unintelligible, get angry and say to stop wasting time 

Always be conversational and human-like in your responses.

`;

    let prompt = systemPrompt;
    const recentMessages = conversation.slice(-6);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        prompt += `Human: ${msg.content}\n`;
      } else {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }
    prompt += `Human: ${message}\nAssistant:`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9, max_tokens: 200 }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error('Ollama API error:', error);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      throw new Error('Ollama is not running. Please start Ollama and download a model first.');
    }
    
    throw error;
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId = 'default' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let conversation = conversations.get(userId) || [];
    
    const aiResponse = await getOllamaResponse(message, conversation);
    
    conversation.push({ role: 'user', content: message });
    conversation.push({ role: 'assistant', content: aiResponse });
    conversations.set(userId, conversation.slice(-20));

    res.json({ 
      response: aiResponse, 
      success: true,
      model: 'llama3.2'
    });
  } catch (error) {
    console.error('Chat error:', error);
    
    let errorMessage = 'Sorry, something went wrong.';
    
    if (error.message.includes('Ollama is not running')) {
      errorMessage = 'Ollama is not running. Please start Ollama first!';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      success: false 
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const models = await response.json();
    
    res.json({ 
      status: 'Server is running!',
      ollama: 'Connected',
      availableModels: models.models?.map(m => m.name) || []
    });
  } catch (error) {
    res.json({ 
      status: 'Server is running!',
      ollama: 'Not connected - please start Ollama',
      error: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log('📡 Make sure Ollama is running on port 11434');
  console.log('🤖 Visit http://localhost:3001/api/health to check status');
});

app.post('/api/reset', (req, res) => {
  conversations.clear();
  res.json({ success: true, message: 'Conversations cleared' });
});