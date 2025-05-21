// src/app/store.js
import { configureStore } from '@reduxjs/toolkit';
import interactionFormReducer from '../features/interactionForm/interactionFormSlice';
import chatReducer from '../features/chat/chatSlice';

export const store = configureStore({
  reducer: {
    interactionForm: interactionFormReducer,
    chat: chatReducer,
    // Add other reducers here as your app grows
  },
  // Middleware is automatically added by configureStore, including redux-thunk for async actions
});
