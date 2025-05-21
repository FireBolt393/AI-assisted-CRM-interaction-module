// src/features/chat/chatSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const generateUniqueId = () => Date.now() + Math.random().toString(36).substr(2, 9);
const CHAT_SESSION_ID_KEY = 'hcpChatSessionId'; // Key for sessionStorage

// Function to get initial session ID from sessionStorage
const getInitialSessionId = () => {
  try {
    const storedSessionId = sessionStorage.getItem(CHAT_SESSION_ID_KEY);
    return storedSessionId ? storedSessionId : null;
  } catch (e) {
    console.error("Could not access sessionStorage:", e);
    return null;
  }
};

const initialState = {
  messages: [
    { 
      id: 1, 
      sender: 'system', 
      text: 'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.' 
    }
  ],
  chatSessionId: getInitialSessionId(), // Load from sessionStorage
  isSending: false,
  error: null,
  aiChatInput: '',
};

export const sendMessageToAI = createAsyncThunk(
  'chat/sendMessageToAI',
  async ({ userMessage, sessionId }, { rejectWithValue }) => {
    try {
      const response = await fetch('http://localhost:8000/interactions/log_chat_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: userMessage,
          session_id: sessionId, // Send the current session ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown API error" }));
        return rejectWithValue(errorData.detail || response.statusText);
      }
      const data = await response.json();
      return data; 
    } catch (error) {
      return rejectWithValue(error.message || "Network error");
    }
  }
);


export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addChatMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    updateChatInput: (state, action) => {
      state.aiChatInput = action.payload;
    },
    clearChatError: (state) => {
      state.error = null;
    },
    setChatSession: (state, action) => {
      const newSessionId = action.payload;
      state.chatSessionId = newSessionId;
      try {
        if (newSessionId) {
          sessionStorage.setItem(CHAT_SESSION_ID_KEY, newSessionId);
        } else {
          sessionStorage.removeItem(CHAT_SESSION_ID_KEY);
        }
      } catch (e) {
        console.error("Could not access sessionStorage to save ID:", e);
      }
    },
    // Action to clear all chat messages
    clearChatMessages: (state) => {
      state.messages = [
        { 
          id: generateUniqueId(), // Use a new ID for the initial system message
          sender: 'system', 
          text: 'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.' 
        }
      ];
      // Optionally, you might want to reset the session ID here too, or handle it separately.
      // If you want to clear the session on form submission and chat clear:
      // state.chatSessionId = null; 
      // try { sessionStorage.removeItem(CHAT_SESSION_ID_KEY); } catch(e) { console.error(e); }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessageToAI.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendMessageToAI.fulfilled, (state, action) => {
        state.isSending = false;
        const aiReply = {
          id: generateUniqueId(),
          sender: 'system',
          text: action.payload.ai_response,
        };
        state.messages.push(aiReply);
        
        if (action.payload.session_id && action.payload.session_id !== state.chatSessionId) {
          state.chatSessionId = action.payload.session_id;
          try {
            sessionStorage.setItem(CHAT_SESSION_ID_KEY, action.payload.session_id);
          } catch (e) {
            console.error("Could not access sessionStorage to save ID:", e);
          }
        }
      })
      .addCase(sendMessageToAI.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload; 
        const errorMessage = {
            id: generateUniqueId(),
            sender: 'system',
            text: `Error: ${action.payload || 'Failed to get AI response.'}`
        };
        state.messages.push(errorMessage);
      });
  },
});

// Ensure clearChatMessages is exported here
export const { 
    addChatMessage, 
    updateChatInput, 
    clearChatError, 
    setChatSession,
    clearChatMessages // <-- Make sure this line is present
} = chatSlice.actions;

export default chatSlice.reducer;
