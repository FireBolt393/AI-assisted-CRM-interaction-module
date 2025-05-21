import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Search, Plus, Mic, ChevronDown, CalendarDays, Clock, MessageSquare, Send, Sparkles, FileText, Users, CheckCircle2, Circle
} from 'lucide-react';

import {
  updateFormField,
  updateMultipleFormFields,
  addMaterial,
  addSample,
  updateMaterialSearch,
  resetForm
} from './features/interactionForm/interactionFormSlice'; 

import {
  addChatMessage,
  updateChatInput,
  sendMessageToAI,
  setChatSession, 
  clearChatMessages 
} from './features/chat/chatSlice'; 


// Helper components (FormField, TextAreaField, RadioButton) remain the same
const FormField = ({ label, children, className = "" }) => (
  <div className={`mb-4 ${className}`}>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const TextAreaField = ({ label, placeholder, rows = 3, value, onChange, name }) => (
  <FormField label={label}>
    <textarea
      name={name}
      rows={rows}
      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 placeholder-gray-400"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  </FormField>
);

const RadioButton = ({ id, name, value, label, checked, onChange, color }) => (
  <label htmlFor={id} className={`flex items-center space-x-2 px-3 sm:px-4 py-2 border rounded-md cursor-pointer transition-colors duration-150 ${checked ? `${color} text-white` : 'bg-gray-50 hover:bg-gray-100 border-gray-300 text-gray-700'}`}>
    {checked ? <CheckCircle2 size={20} /> : <Circle size={20} className="text-gray-400" />}
    <span className="text-sm font-medium">{label}</span>
    <input
      id={id}
      name={name}
      type="radio"
      value={value}
      checked={checked}
      onChange={onChange}
      className="hidden"
    />
  </label>
);

const generateUniqueId = () => Date.now() + Math.random().toString(36).substr(2, 9);
const generateChatSessionId = () => `frontend_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const App = () => { 
  const dispatch = useDispatch();
  const currentFormDataFromStore = useSelector((state) => state.interactionForm); 
  const { 
    messages: aiChatMessages, 
    chatSessionId, 
    isSending: isAiResponding, 
    aiChatInput
  } = useSelector((state) => state.chat);

  const [isSubmittingFinalLog, setIsSubmittingFinalLog] = React.useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "materialsSharedSearch") {
        dispatch(updateMaterialSearch(value));
    } else {
        dispatch(updateFormField({ field: name, value }));
    }
  };

  const handleSentimentChange = (e) => {
    dispatch(updateFormField({ field: e.target.name, value: e.target.value }));
  };
  
  const handleAddMaterialToList = () => {
    if (currentFormDataFromStore.materialsSharedSearch.trim() !== "") {
      dispatch(addMaterial(currentFormDataFromStore.materialsSharedSearch.trim()));
    }
  };

  const handleAddSampleToList = (sampleName) => {
     dispatch(addSample(sampleName));
  };
  
  const handleAiChatInputChange = (e) => {
    dispatch(updateChatInput(e.target.value));
  };

  const handleLogAiChatAndSubmit = async () => {
    const userMessageText = aiChatInput.trim();
    if (isAiResponding || isSubmittingFinalLog) return; 
    if (userMessageText === '' && !Object.values(currentFormDataFromStore).some(val => (Array.isArray(val) ? val.length > 0 : val && String(val).trim() !== ''))) {
        alert("Error: Please enter chat message or form details to log.");
        return;
    }

    let aiExtractedDataForCurrentTurn = null;
    let currentChatSessionIdForSubmission = chatSessionId; 
    let finalActionTypeFromAI = null;

    if (userMessageText !== '') {
        const newUserMessage = { 
          id: generateUniqueId(), sender: 'user', text: userMessageText 
        };
        dispatch(addChatMessage(newUserMessage));
        dispatch(updateChatInput(''));

        if (!currentChatSessionIdForSubmission) {
          currentChatSessionIdForSubmission = generateChatSessionId();
          dispatch(setChatSession(currentChatSessionIdForSubmission)); 
        }
        
        const resultAction = await dispatch(sendMessageToAI({ 
          userMessage: userMessageText, 
          sessionId: currentChatSessionIdForSubmission 
        }));

        if (sendMessageToAI.fulfilled.match(resultAction)) {
            const payload = resultAction.payload;
            finalActionTypeFromAI = payload.final_action_type; 

            if (payload.extracted_data) {
                aiExtractedDataForCurrentTurn = payload.extracted_data;
                console.log("AI Extracted Data (Raw from Backend):", aiExtractedDataForCurrentTurn);

                // --- KEY MAPPING LOGIC ---
                const updatesToForm = {};
                const keyMap = {
                    "hcp_name": "hcpName",
                    "interaction_date": "date",
                    "interaction_time": "time",
                    "interaction_type": "interactionType",
                    "key_topics": "topicsDiscussed", // Assuming your form uses topicsDiscussed
                    "discussed_products": "productsDiscussed", // Assuming your form uses productsDiscussed
                    "materials_shared": "materialsShared",
                    "samples_distributed": "samplesDistributed",
                    "next_steps": "followUpActions"
                    // Add other mappings if AI uses different keys than your form state
                };

                for (const rawKey in aiExtractedDataForCurrentTurn) {
                    const formKey = keyMap[rawKey] || rawKey; // Use mapped key or raw key if no map
                    const value = aiExtractedDataForCurrentTurn[rawKey];

                    if (value !== null && value !== undefined) {
                      if (formKey === 'date') {
                        if (value && typeof value === 'string' && value.toLowerCase() !== 'yyyy-mm-dd' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          updatesToForm[formKey] = value;
                        } else if (!value.match(/^\d{4}-\d{2}-\d{2}$/)) { // If format is wrong, don't update
                            console.warn(`AI returned invalid date format for 'date': ${value}`);
                        } else {
                            updatesToForm[formKey] = value; // Assume correct format if not the placeholder
                        }
                      } else if (formKey === 'time') {
                          if (value && typeof value === 'string' && value.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
                              updatesToForm[formKey] = value;
                          } else {
                              console.warn(`AI returned invalid time format for 'time': ${value}`);
                          }
                      } else if ((formKey === 'materialsShared' || formKey === 'samplesDistributed' || formKey === 'productsDiscussed') && Array.isArray(value)) {
                        updatesToForm[formKey] = value; // Send array of strings to reducer
                      } else if (Object.prototype.hasOwnProperty.call(currentFormDataFromStore, formKey)) {
                        updatesToForm[formKey] = String(value);
                      } else {
                        // If key is not in form but we want to keep it (e.g. for finalPayload)
                        // This part might not be needed if all relevant keys are in initialFormState
                        console.log(`AI extracted unmapped key '${rawKey}' (mapped to '${formKey}') with value:`, value);
                        // updatesToForm[formKey] = String(value); // Optionally add it if it's a new field
                      }
                    }
                }
                // --- END OF KEY MAPPING LOGIC ---

                if (Object.keys(updatesToForm).length > 0) {
                    console.log("Dispatching updateMultipleFormFields with mapped updates:", updatesToForm);
                    dispatch(updateMultipleFormFields(updatesToForm));
                }
            }
            if (payload.session_id && payload.session_id !== currentChatSessionIdForSubmission) {
                dispatch(setChatSession(payload.session_id));
                currentChatSessionIdForSubmission = payload.session_id;
            }
        } else if (sendMessageToAI.rejected.match(resultAction)) {
            alert(`Error: AI processing failed. ${resultAction.payload || ''}`);
            return; 
        }
    } else { 
        if (!currentChatSessionIdForSubmission) {
            currentChatSessionIdForSubmission = generateChatSessionId();
            dispatch(setChatSession(currentChatSessionIdForSubmission));
        }
        finalActionTypeFromAI = "MANUAL_FORM_SUBMIT"; 
    }

    const toolActionTypes = [
        "RETRIEVE_HCP_PROFILE_EXECUTED", "SUGGEST_NEXT_ACTION_EXECUTED", "QUERY_PRODUCT_INFO_EXECUTED",   
        "RETRIEVE_HCP_PROFILE", "SUGGEST_NEXT_ACTION", "QUERY_PRODUCT_INFO",
        "NEED_MORE_INFO", "GENERAL_QUERY"                  
    ];

    if (finalActionTypeFromAI && toolActionTypes.includes(finalActionTypeFromAI)) {
        console.log(`Action type '${finalActionTypeFromAI}' identified. Skipping database submission.`);
        return; 
    }
    
    setIsSubmittingFinalLog(true);
    
    let payloadForDb = { ...currentFormDataFromStore }; 
    if (aiExtractedDataForCurrentTurn) { 
        // Re-apply mapped data to ensure payloadForDb has the latest
        const mappedAiData = {};
        const keyMap = { /* Same keyMap as above */
            "hcp_name": "hcpName", "interaction_date": "date", "interaction_time": "time",
            "interaction_type": "interactionType", "key_topics": "topicsDiscussed",
            "discussed_products": "productsDiscussed", "materials_shared": "materialsShared",
            "samples_distributed": "samplesDistributed", "next_steps": "followUpActions"
        };
        for (const rawKey in aiExtractedDataForCurrentTurn) {
            const formKey = keyMap[rawKey] || rawKey;
            mappedAiData[formKey] = aiExtractedDataForCurrentTurn[rawKey];
        }

        for (const key in mappedAiData) {
            const value = mappedAiData[key];
            if (value !== null && value !== undefined) {
                 if ((key === 'materialsShared' || key === 'samplesDistributed') && Array.isArray(value)) {
                    payloadForDb[key] = value.map(name => ({ id: generateUniqueId(), name: String(name) }));
                } else if (key === 'productsDiscussed' && Array.isArray(value)) {
                    payloadForDb[key] = value.map(p => String(p));
                } else if (Object.prototype.hasOwnProperty.call(payloadForDb, key) || 
                           (key === 'productsDiscussed')) { 
                    payloadForDb[key] = String(value);
                }
            }
        }
    }
    
    payloadForDb.id = currentFormDataFromStore.currentLogDatabaseId; // Ensure ID for update is included
    payloadForDb.hcpName = payloadForDb.hcpName || null;
    payloadForDb.interactionType = payloadForDb.interactionType || null;
    payloadForDb.date = payloadForDb.date || null;
    payloadForDb.time = payloadForDb.time || null;
    payloadForDb.attendees = payloadForDb.attendees || null;
    payloadForDb.topicsDiscussed = payloadForDb.topicsDiscussed || null;
    payloadForDb.materialsShared = Array.isArray(payloadForDb.materialsShared) ? payloadForDb.materialsShared.filter(m => m && m.name) : [];
    payloadForDb.samplesDistributed = Array.isArray(payloadForDb.samplesDistributed) ? payloadForDb.samplesDistributed.filter(s => s && s.name) : [];
    payloadForDb.sentiment = payloadForDb.sentiment || null;
    payloadForDb.outcomes = payloadForDb.outcomes || null;
    payloadForDb.followUpActions = payloadForDb.followUpActions || null;
    payloadForDb.chatSessionId = currentChatSessionIdForSubmission;
    payloadForDb.productsDiscussed = Array.isArray(payloadForDb.productsDiscussed) ? payloadForDb.productsDiscussed : [];

    console.log("Submitting final interaction data to /log_structured:", JSON.stringify(payloadForDb, null, 2));

    try {
      const response = await fetch('http://localhost:8000/interactions/log_structured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadForDb),
      });
      const responseData = await response.json();
      if (!response.ok) {
        console.error('Final Submission Error - Status:', response.status, 'Response Data:', responseData);
        let errorDetail = "Failed to submit interaction.";
        if (responseData.detail) {
            if (Array.isArray(responseData.detail)) {
                errorDetail = responseData.detail.map(err => `${err.loc.join(' -> ')}: ${err.msg}`).join('; ');
            } else if (typeof responseData.detail === 'string') {
                errorDetail = responseData.detail;
            }
        }
        console.error('Detailed Pydantic Validation Errors:', JSON.stringify(responseData.detail, null, 2));
        alert(`Error: ${errorDetail}`);
      } else {
        console.log('Final Submission Successful:', responseData);
        alert(responseData.message || "Interaction logged successfully!");
        
        if (responseData.id && responseData.id !== currentFormDataFromStore.currentLogDatabaseId) {
            // dispatch(setCurrentLogDatabaseId(responseData.id));
        }
        // dispatch(resetForm()); // Keep commented for now
        // dispatch(clearChatMessages()); 
        console.log("Form and chat NOT reset. User can view the submitted state.");
      }
    } catch (error) {
      console.error('Network or other error during final submission:', error);
      alert("Network error during submission. Please try again.");
    } finally {
      setIsSubmittingFinalLog(false);
    }
  };

  const overallIsProcessing = isAiResponding || isSubmittingFinalLog;

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
      {/* Notification component usage is REMOVED */}
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">Log HCP Interaction</h1>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Interaction Details Form */}
        <div className="lg:w-2/3 bg-white p-6 rounded-lg shadow-xl">
          {/* ... (All form fields JSX - no changes needed here for this specific update) ... */}
          <h2 className="text-xl font-semibold text-gray-700 mb-6 border-b pb-3">Interaction Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <FormField label="HCP Name">
              <div className="relative">
                <input type="text" name="hcpName" value={currentFormDataFromStore.hcpName} onChange={handleInputChange} placeholder="Search or select HCP" className="mt-1 block w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 placeholder-gray-400"/>
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              </div>
            </FormField>
            <FormField label="Interaction Type">
              <div className="relative">
                <select name="interactionType" value={currentFormDataFromStore.interactionType} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 appearance-none">
                  <option>Meeting</option><option>Virtual Call</option><option>Email</option><option>Conference Discussion</option><option>Phone Call</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
              </div>
            </FormField>
            <FormField label="Date">
               <div className="relative">
                <input type="date" name="date" value={currentFormDataFromStore.date} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"/>
                 <CalendarDays className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18}/>
              </div>
            </FormField>
            <FormField label="Time">
              <div className="relative">
                <input type="time" name="time" value={currentFormDataFromStore.time} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"/>
                <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18}/>
              </div>
            </FormField>
          </div>
          <FormField label="Attendees" className="md:col-span-2">
            <div className="relative">
              <input type="text" name="attendees" value={currentFormDataFromStore.attendees} onChange={handleInputChange} placeholder="Enter names or search" className="mt-1 block w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 placeholder-gray-400"/>
              <Users className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </FormField>
          <div className="relative">
            <TextAreaField label="Topics Discussed" name="topicsDiscussed" placeholder="Enter key discussion points..." value={currentFormDataFromStore.topicsDiscussed} onChange={handleInputChange}/>
            <Mic className="absolute right-3 bottom-5 text-gray-400 hover:text-indigo-600 cursor-pointer" size={20} />
          </div>
          <button type="button" className="flex items-center text-sm text-white bg-slate-700 hover:bg-slate-800 font-medium py-2 px-3 rounded-md mb-4 -mt-2 ml-1 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 shadow">
            <Sparkles size={16} className="mr-1.5" /> Summarize from Voice Note (Requires Consent)
          </button>
          <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50/50">
            <h3 className="text-md font-semibold text-gray-700 mb-3">Materials Shared/Samples Distributed</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-600 mb-1">Materials Shared</label>
              <div className="flex items-center gap-2 mb-1">
                <input type="text" name="materialsSharedSearch" placeholder="Search materials..." value={currentFormDataFromStore.materialsSharedSearch} onChange={handleInputChange} className="flex-grow mt-1 block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 placeholder-gray-400"/>
                <button type="button" onClick={handleAddMaterialToList} className="flex items-center justify-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap">
                  <Search size={16} className="mr-1.5" /> Search/Add
                </button>
              </div>
              {currentFormDataFromStore.materialsShared.length === 0 ? (<p className="text-xs text-gray-500 italic">No materials added.</p>) : (
                <ul className="list-disc list-inside pl-1 text-sm text-gray-600">{currentFormDataFromStore.materialsShared.map(material => <li key={material.id}>{material.name}</li>)}</ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Samples Distributed</label>
               <div className="flex items-center gap-2 mb-1 flex-wrap">
                 <button type="button" onClick={() => handleAddSampleToList('CardiaBoost Sample')} className="flex items-center justify-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap mb-1 sm:mb-0">
                    <Plus size={16} className="mr-1.5" /> Add CardiaBoost
                  </button>
                   <button type="button" onClick={() => handleAddSampleToList('ProLipid Sample')} className="flex items-center justify-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap mb-1 sm:mb-0">
                    <Plus size={16} className="mr-1.5" /> Add ProLipid
                  </button>
              </div>
              {currentFormDataFromStore.samplesDistributed.length === 0 ? (<p className="text-xs text-gray-500 italic">No samples added.</p>) : (
                <ul className="list-disc list-inside pl-1 text-sm text-gray-600">{currentFormDataFromStore.samplesDistributed.map(sample => <li key={sample.id}>{sample.name}</li>)}</ul>
              )}
            </div>
          </div>
          <FormField label="Observed/Inferred HCP Sentiment">
            <div className="flex flex-wrap space-x-2 sm:space-x-3 mt-2">
              <RadioButton id="sentiment-positive" name="sentiment" value="Positive" label="Positive" checked={currentFormDataFromStore.sentiment === 'Positive'} onChange={handleSentimentChange} color="bg-green-500 border-green-500"/>
              <RadioButton id="sentiment-neutral" name="sentiment" value="Neutral" label="Neutral" checked={currentFormDataFromStore.sentiment === 'Neutral'} onChange={handleSentimentChange} color="bg-blue-500 border-blue-500"/>
              <RadioButton id="sentiment-negative" name="sentiment" value="Negative" label="Negative" checked={currentFormDataFromStore.sentiment === 'Negative'} onChange={handleSentimentChange} color="bg-red-500 border-red-500"/>
            </div>
          </FormField>
          <TextAreaField label="Outcomes" name="outcomes" placeholder="Key outcomes or agreements..." value={currentFormDataFromStore.outcomes} onChange={handleInputChange}/>
          <TextAreaField label="Follow-up Actions" name="followUpActions" placeholder="Enter next steps or tasks..." value={currentFormDataFromStore.followUpActions} onChange={handleInputChange}/>
          
        </div>

        {/* Right Column: AI Assistant */}
        <div className="lg:w-1/3 bg-white p-6 rounded-lg shadow-xl flex flex-col" style={{maxHeight: 'calc(100vh - 50px)'}}>
          {/* ... (AI Assistant JSX) ... */}
          <div className="flex items-center mb-4">
            <MessageSquare size={24} className="text-indigo-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-700">AI Assistant</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Log interaction via chat</p>
          <div className="flex-grow bg-gray-50 p-3 rounded-md mb-4 overflow-y-auto border border-gray-200 min-h-[200px]">
            {aiChatMessages.map((msg) => (
              <div key={msg.id} className={`mb-2 text-sm flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span className={`inline-block p-2 rounded-lg max-w-[80%] break-words ${msg.sender === 'user' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {msg.text}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-auto">
            <div className="flex items-center mb-4">
              <input type="text" name="aiChatInput" value={aiChatInput} onChange={handleAiChatInputChange} placeholder={overallIsProcessing ? "Processing..." : "Describe Interaction..."} className="flex-grow mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 placeholder-gray-400" onKeyDown={(e) => e.key === 'Enter' && handleLogAiChatAndSubmit()} disabled={overallIsProcessing}/>
              <button type="button" onClick={handleLogAiChatAndSubmit} className={`flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white h-[42px] ${overallIsProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800 focus:ring-slate-500'} focus:outline-none focus:ring-2 focus:ring-offset-2`} disabled={overallIsProcessing}>
                {overallIsProcessing ? (<svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (<Send size={18} className="mr-0 sm:mr-2" />)}
                <span className="hidden sm:inline">{overallIsProcessing ? "Processing..." : "Log"}</span>
              </button>
            </div>
            <div className="border-t pt-4">
              <h3 className="text-md font-semibold text-gray-700 mb-2">AI Suggested Follow-ups:</h3>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center text-indigo-700 hover:underline cursor-pointer p-1 rounded hover:bg-indigo-50"><FileText size={16} className="mr-2 text-indigo-500 flex-shrink-0" /> Schedule follow-up meeting in 2 weeks</li>
                <li className="flex items-center text-indigo-700 hover:underline cursor-pointer p-1 rounded hover:bg-indigo-50"><FileText size={16} className="mr-2 text-indigo-500 flex-shrink-0" /> Send OncoBoost Phase III PDF</li>
                <li className="flex items-center text-indigo-700 hover:underline cursor-pointer p-1 rounded hover:bg-indigo-50"><FileText size={16} className="mr-2 text-indigo-500 flex-shrink-0" /> Add Dr. Sharma to advisory board invite list</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
