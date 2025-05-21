// src/features/interactionForm/interactionFormSlice.js
import { createSlice } from '@reduxjs/toolkit';

const generateUniqueId = () => Date.now() + Math.random().toString(36).substr(2, 9);

const initialState = {
  currentLogDatabaseId: null, // <-- NEW: To store the ID of the currently active/saved log
  hcpName: '',
  interactionType: 'Meeting',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
  attendees: '',
  topicsDiscussed: '',
  materialsSharedSearch: '',
  materialsShared: [], 
  samplesDistributed: [], 
  sentiment: 'Neutral',
  outcomes: '',
  followUpActions: '',
  // productsDiscussed: [], // If you decide to manage this in the form state directly
};

export const interactionFormSlice = createSlice({
  name: 'interactionForm',
  initialState,
  reducers: {
    updateFormField: (state, action) => {
      const { field, value } = action.payload;
      if (Object.prototype.hasOwnProperty.call(state, field)) {
        state[field] = value;
      }
    },
    updateMultipleFormFields: (state, action) => {
      const updates = action.payload;
      for (const field in updates) {
        if (Object.prototype.hasOwnProperty.call(state, field)) {
          if (field === 'materialsShared' && Array.isArray(updates[field])) {
            state.materialsShared = updates[field].map(item => 
              typeof item === 'string' ? { id: generateUniqueId(), name: item } : item
            );
          } else if (field === 'samplesDistributed' && Array.isArray(updates[field])) {
             state.samplesDistributed = updates[field].map(item => 
              typeof item === 'string' ? { id: generateUniqueId(), name: item } : item
            );
          }
          else {
            state[field] = updates[field];
          }
        }
      }
    },
    addMaterial: (state, action) => {
        const materialName = action.payload;
        if (materialName && materialName.trim() !== "") {
            state.materialsShared.push({ id: generateUniqueId(), name: materialName.trim() });
            state.materialsSharedSearch = ''; 
        }
    },
    addSample: (state, action) => {
        const sampleName = action.payload;
        if (sampleName && sampleName.trim() !== "") {
            state.samplesDistributed.push({ id: generateUniqueId(), name: sampleName.trim() });
        }
    },
    resetForm: (state) => {
      // Reset all fields to initial state, INCLUDING currentLogDatabaseId
      Object.assign(state, initialState); 
    },
    updateMaterialSearch: (state, action) => {
        state.materialsSharedSearch = action.payload;
    },
    // --- NEW ACTION to set the database ID of the current log ---
    setCurrentLogDatabaseId: (state, action) => {
      state.currentLogDatabaseId = action.payload;
    }
  },
});

export const { 
    updateFormField, 
    updateMultipleFormFields, 
    addMaterial,
    addSample,
    resetForm,
    updateMaterialSearch,
    setCurrentLogDatabaseId // <-- EXPORT NEW ACTION
} = interactionFormSlice.actions;

export default interactionFormSlice.reducer;
