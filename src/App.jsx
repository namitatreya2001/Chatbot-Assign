import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import process from 'process';


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/messages`);
      setMessages(response.data.messages.map(msg => ({
        ...msg,
        content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
      })));
    } catch (error) {
      setError('Failed to load chat history');
      console.error('Error loading chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await axios.delete(`${BACKEND_URL}/api/messages`);
      setMessages([]);
    } catch (error) {
      setError('Failed to clear chat history');
      console.error('Error clearing chat history:', error);
    }
  };

  const renderDataTable = (data) => (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Category</th>
            <th className="px-4 py-2 text-left">Key</th>
            <th className="px-4 py-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-t">
              <td className="px-4 py-2">{item.category}</td>
              <td className="px-4 py-2">{item.data_key}</td>
              <td className="px-4 py-2">{item.data_value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderMessageContent = (message) => {
    if (typeof message.content === 'string') {
      return <p className="text-lg">{message.content}</p>;
    }

    if (message.content.type === 'data') {
      return renderDataTable(message.content.content);
    }

    return <p className="text-lg">{message.content.content}</p>;
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage = {
      content: inputMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setError(null);

    try {
      setLoading(true);
      const response = await axios.post(`${BACKEND_URL}/api/chat`, {
        message: inputMessage
      });

      const botMessage = {
        content: response.data,
        sender: 'bot',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 
                      error.message || 
                      'Sorry, I encountered an error. Please try again.';
      
      setError(errorMsg);
      
      const errorMessage = {
        content: errorMsg,
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="animate-pulse text-2xl text-indigo-600 font-semibold">
          Loading chat history...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-r from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                AI Assistant
              </h1>
            </div>
          </div>
          <button
            onClick={clearHistory}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 transition-colors duration-200 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            Clear History
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-lg rounded-2xl p-5 ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-blue-200'
                    : 'bg-white text-gray-800 shadow-lg'
                } shadow-lg transform hover:scale-[1.02] transition-transform duration-200`}
              >
                {renderMessageContent(message)}
                <span className={`text-xs mt-2 block ${
                  message.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-4xl mx-auto w-full px-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4 rounded-r-lg">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t border-indigo-100 shadow-lg">
        <div className="max-w-4xl mx-auto flex gap-4">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 p-4 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-lg transition-shadow duration-200"
          />
          <button
            type="submit"
            disabled={loading}
            className={`px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transform hover:scale-105 transition-all duration-200 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Sending...</span>
              </div>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;