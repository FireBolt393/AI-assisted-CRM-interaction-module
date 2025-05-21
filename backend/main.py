# main.py
import os
import json
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field as PydanticField
from typing import List, Optional, Dict, Any, TypedDict
from datetime import date as d, time as t

import mysql.connector
from mysql.connector import Error as MySQLError

from groq import Groq
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage

load_dotenv()

# --- Database Configuration & Connection ---
DB_HOST = 'localhost'
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

def get_db_connection():
    print(f"Attempting DB connection with: HOST='{DB_HOST}', USER='{DB_USER}', DB_NAME='{DB_NAME}'")
    missing_vars = []
    if not DB_HOST: missing_vars.append("DB_HOST")
    if not DB_USER: missing_vars.append("DB_USER")
    if DB_PASSWORD is None: missing_vars.append("DB_PASSWORD (it's None, should be at least an empty string \"\" if no password)")
    if not DB_NAME: missing_vars.append("DB_NAME")
    if missing_vars:
        print(f"ERROR: The following database configuration variables are missing or not loaded correctly from .env: {', '.join(missing_vars)}")
        return None
    try:
        conn = mysql.connector.connect(
            host=DB_HOST, user=DB_USER, password=DB_PASSWORD, database=DB_NAME, connection_timeout=10
        )
        if conn.is_connected():
            return conn
        return None
    except MySQLError as e:
        print(f"MySQL Connection Error: {e.errno} - {e.msg}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during DB connection: {e}")
        return None

# --- Pydantic Models ---
class MaterialItem(BaseModel):
    id: Any 
    name: str

class InteractionLogBase(BaseModel):
    hcpName: Optional[str] = PydanticField(None)
    interactionType: Optional[str] = PydanticField(None)
    date: Optional[d] = PydanticField(None) 
    time: Optional[t] = PydanticField(None) 
    attendees: Optional[str] = PydanticField(None)
    topicsDiscussed: Optional[str] = PydanticField(None)
    materialsShared: Optional[List[MaterialItem]] = PydanticField(default_factory=list)
    samplesDistributed: Optional[List[MaterialItem]] = PydanticField(default_factory=list)
    sentiment: Optional[str] = PydanticField(None)
    outcomes: Optional[str] = PydanticField(None)
    followUpActions: Optional[str] = PydanticField(None)
    chatSessionId: Optional[str] = PydanticField(None)
    productsDiscussed: Optional[List[str]] = PydanticField(default_factory=list)

class InteractionLogCreate(InteractionLogBase):
    id: Optional[int] = PydanticField(None)

class InteractionLogResponse(InteractionLogBase):
    id: int 
    message: Optional[str] = None

class AIChatMessage(BaseModel):
    hcp_id: Optional[str] = PydanticField(None)
    session_id: Optional[str] = PydanticField(None)
    user_message: str = PydanticField(...)

class AIChatResponse(BaseModel):
    ai_response: str = PydanticField(...) 
    extracted_data: Optional[Dict[str, Any]] = PydanticField(None) 
    is_complete: bool = PydanticField(False)
    final_action_type: Optional[str] = PydanticField(None)
    session_id: Optional[str] = PydanticField(None)


# --- LangGraph Agent Setup ---

class InteractionAgentState(TypedDict):
    messages: List[BaseMessage]
    current_extracted_fields: Dict[str, Any] 
    last_llm_parsed_json: Optional[Dict[str, Any]]
    tool_output: Optional[str] 
    current_action_type: Optional[str] 

try:
    groq_api_key_env = os.environ.get("GROQ_API_KEY")
    if not groq_api_key_env: print("WARNING: GROQ_API_KEY not found."); groq_client = None
    else: groq_client = Groq(api_key=groq_api_key_env)
except Exception as e: print(f"Error initializing Groq client: {e}"); groq_client = None

# --- MODIFIED LLM_SYSTEM_PROMPT with all tool types ---
LLM_SYSTEM_PROMPT = (
    "You are an AI assistant for pharmaceutical field reps helping log HCP interactions and access sales-related information. "
    "Your goal is a natural conversation while extracting details for a form or invoking tools. "
    "ALWAYS respond with a JSON object with two top-level keys: "
    "1. 'conversational_reply': Your natural language response. "
    "2. 'action_details': A JSON object describing the primary action derived from the user's message. "
    "   The 'action_details' object MUST have a 'type' field. Possible 'type' values: "
    "   - 'EXTRACT_INFO': User is providing new info for the interaction log. Include 'extracted_fields' sub-object with: "
    "     'hcpName', 'interactionType', 'date' (YYYY-MM-DD), 'time' (HH:MM 24h), 'topicsDiscussed', "
    "     'productsDiscussed' (array), 'materialsShared' (array), 'samplesDistributed' (array), "
    "     'sentiment' ('Positive', 'Neutral', 'Negative'), 'outcomes', 'followUpActions'. "
    "   - 'EDIT_FIELD': User wants to change a detail. Include: 'field_to_edit', 'new_value'. "
    "   - 'RETRIEVE_HCP_PROFILE': User asks for HCP info. Include: 'hcp_name' (string). "
    "   - 'SUGGEST_NEXT_ACTION': User asks for suggestions. Include: 'hcp_name' (optional string, for context if available). "
    "   - 'QUERY_PRODUCT_INFO': User asks about a product. Include: 'product_name' (string), 'query_details' (string, e.g., 'dosage', 'side effects', 'efficacy data'). "
    "   - 'GENERAL_QUERY': For other questions not fitting other types. "
    "   - 'NEED_MORE_INFO': If parameters for a tool are missing (e.g., user says 'get profile' but no HCP name). Include 'missing_parameter' (e.g., 'hcp_name'). "
    "Only include fields if clearly present. If no specific fields for EXTRACT_INFO, 'extracted_fields' can be {}. "
    "Date format YYYY-MM-DD, Time format HH:MM (24h)."
)

# --- Tool Functions (Placeholders) ---
def run_retrieve_hcp_profile_tool(hcp_name: Optional[str]) -> str:
    print(f"--- TOOL CALLED: Retrieve HCP Profile for: {hcp_name} ---")
    if not hcp_name:
        return "To retrieve an HCP profile, please tell me the HCP's name."
    return f"Simulated profile for {hcp_name}: Specialty - Cardiology, Institution - City General"

def run_suggest_next_action_tool(hcp_name: Optional[str] = None) -> str:
    print(f"--- TOOL CALLED: Suggest Next Best Action (Context HCP: {hcp_name}) ---")
    suggestions = [
        "Schedule a follow-up meeting in 2 weeks to discuss trial results.",
        "Send the latest OncoBoost Phase III PDF.",
        "Consider adding this HCP to the upcoming advisory board invite list."
    ]
    if hcp_name:
        return f"For {hcp_name}, consider: {suggestions[0]}"
    return f"Here are some general next best actions: {suggestions[1]}"

def run_query_product_info_tool(product_name: Optional[str], query_details: Optional[str]) -> str:
    print(f"--- TOOL CALLED: Query Product Info for: {product_name}, Details: {query_details} ---")
    if not product_name:
        return "Which product are you asking about?"
    if not query_details: # If query_details is general, LLM might have to infer or this tool can ask.
        return f"What specifically about {product_name} would you like to know (e.g., dosage, side effects, efficacy data)?"
    return f"Simulated info for {product_name} regarding '{query_details}': Standard dose is 10mg daily. Clinical trials show 75% efficacy in target population. Common side effects include mild nausea."


# --- LangGraph Nodes ---
def call_llm_node(state: InteractionAgentState) -> Dict[str, Any]:
    print("--- Agent Node: call_llm_node ---")
    if not groq_client: return {"last_llm_parsed_json": {"conversational_reply": "AI service unavailable.", "action_details": {"type": "ERROR", "detail": "GroqClientNotInit"}}, "current_action_type": "ERROR"}
    current_messages_from_state = state.get("messages", [])
    last_user_message_content = current_messages_from_state[-1].content if current_messages_from_state and isinstance(current_messages_from_state[-1], HumanMessage) else ""
    if not last_user_message_content: return {"last_llm_parsed_json": {"conversational_reply": "No user message to process.", "action_details": {"type": "ERROR", "detail": "NoUserMessageInState"}}, "current_action_type": "ERROR"}
    messages_for_groq_api = [{"role": "system", "content": LLM_SYSTEM_PROMPT},{"role": "user", "content": last_user_message_content}]
    try:
        chat_completion = groq_client.chat.completions.create(messages=messages_for_groq_api, model="gemma2-9b-it", temperature=0.5, max_tokens=1024,)
        groq_raw_response = chat_completion.choices[0].message.content
        cleaned_response_str = groq_raw_response
        if groq_raw_response: 
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", groq_raw_response)
            if match: cleaned_response_str = match.group(1).strip()
            else:
                cleaned_response_str = groq_raw_response.strip()
                if cleaned_response_str.startswith("```") and cleaned_response_str.endswith("```"): cleaned_response_str = cleaned_response_str[3:-3].strip()
        try:
            parsed_llm_output = json.loads(cleaned_response_str)
            action_type_from_llm = parsed_llm_output.get("action_details", {}).get("type", "UNKNOWN_ACTION")
            return {"last_llm_parsed_json": parsed_llm_output, "current_action_type": action_type_from_llm}
        except json.JSONDecodeError:
            print(f"ERROR: LLM JSONDecodeError: {cleaned_response_str}")
            return {"last_llm_parsed_json": {"conversational_reply": cleaned_response_str, "action_details": {"type": "ERROR", "detail": "LLMBadJSON"}}, "current_action_type": "ERROR"}
    except Exception as e:
        print(f"ERROR during LLM call: {e}")
        return {"last_llm_parsed_json": {"conversational_reply": f"Error communicating with AI: {str(e)}", "action_details": {"type": "ERROR", "detail": str(e)}}, "current_action_type": "ERROR"}

# --- Tool Execution Nodes ---
def execute_retrieve_hcp_profile_node(state: InteractionAgentState) -> Dict[str, str]:
    print("--- Agent Node: execute_retrieve_hcp_profile_node ---")
    action_details = state.get("last_llm_parsed_json", {}).get("action_details", {})
    hcp_name = action_details.get("hcp_name")
    tool_result = run_retrieve_hcp_profile_tool(hcp_name)
    return {"tool_output": tool_result, "current_action_type": "RETRIEVE_HCP_PROFILE_EXECUTED"}

def execute_suggest_next_action_node(state: InteractionAgentState) -> Dict[str, str]:
    print("--- Agent Node: execute_suggest_next_action_node ---")
    action_details = state.get("last_llm_parsed_json", {}).get("action_details", {})
    hcp_name = action_details.get("hcp_name") # Optional for this tool
    tool_result = run_suggest_next_action_tool(hcp_name)
    return {"tool_output": tool_result, "current_action_type": "SUGGEST_NEXT_ACTION_EXECUTED"}

def execute_query_product_info_node(state: InteractionAgentState) -> Dict[str, str]:
    print("--- Agent Node: execute_query_product_info_node ---")
    action_details = state.get("last_llm_parsed_json", {}).get("action_details", {})
    product_name = action_details.get("product_name")
    query_details = action_details.get("query_details")
    tool_result = run_query_product_info_tool(product_name, query_details)
    return {"tool_output": tool_result, "current_action_type": "QUERY_PRODUCT_INFO_EXECUTED"}

def process_direct_updates_node(state: InteractionAgentState) -> Dict[str, Any]:
    print("--- Agent Node: process_direct_updates_node ---")
    action_details = state.get("last_llm_parsed_json", {}).get("action_details", {})
    action_type = action_details.get("type") 
    current_fields = dict(state.get("current_extracted_fields", {}))
    if action_type == "EXTRACT_INFO":
        extracted = action_details.get("extracted_fields")
        if isinstance(extracted, dict): current_fields.update(extracted)
    elif action_type == "EDIT_FIELD":
        field_to_edit = action_details.get("field_to_edit"); new_value = action_details.get("new_value")
        if field_to_edit and new_value is not None: current_fields[field_to_edit] = new_value
    return {"current_extracted_fields": current_fields, "current_action_type": action_type}

def prepare_final_response_node(state: InteractionAgentState) -> InteractionAgentState:
    print("--- Agent Node: prepare_final_response_node ---")
    llm_output = state.get("last_llm_parsed_json", {})
    tool_result = state.get("tool_output")
    final_reply_content = tool_result if tool_result else llm_output.get("conversational_reply", "I'm not sure how to respond.")
    updated_messages = list(state.get("messages", []))
    updated_messages.append(AIMessage(content=final_reply_content))
    return {
        "messages": updated_messages,
        "current_extracted_fields": state.get("current_extracted_fields", {}),
        "last_llm_parsed_json": llm_output,
        "tool_output": tool_result, # Clear tool output after use or pass if needed
        "current_action_type": state.get("current_action_type") 
    }

def route_action_node(state: InteractionAgentState) -> str:
    print("--- Agent Node: route_action_node ---")
    action_type = state.get("current_action_type", "UNKNOWN_ACTION") # This was set by call_llm_node
    print(f"Routing based on action_type from state: {action_type}")
    if action_type == "RETRIEVE_HCP_PROFILE": return "execute_retrieve_hcp_profile_node"
    elif action_type == "SUGGEST_NEXT_ACTION": return "execute_suggest_next_action_node"
    elif action_type == "QUERY_PRODUCT_INFO": return "execute_query_product_info_node"
    elif action_type in ["EXTRACT_INFO", "EDIT_FIELD"]: return "process_direct_updates_node"
    else: return "prepare_final_response_node" # Default/fallback

# Graph Definition
workflow = StateGraph(InteractionAgentState)
workflow.add_node("call_llm", call_llm_node)
workflow.add_node("execute_retrieve_hcp_profile_node", execute_retrieve_hcp_profile_node)
workflow.add_node("execute_suggest_next_action_node", execute_suggest_next_action_node) # New node
workflow.add_node("execute_query_product_info_node", execute_query_product_info_node)   # New node
workflow.add_node("process_direct_updates_node", process_direct_updates_node)
workflow.add_node("prepare_final_response_node", prepare_final_response_node)
workflow.set_entry_point("call_llm")
workflow.add_conditional_edges(
    "call_llm", route_action_node,
    {
        "execute_retrieve_hcp_profile_node": "execute_retrieve_hcp_profile_node",
        "execute_suggest_next_action_node": "execute_suggest_next_action_node", # New route
        "execute_query_product_info_node": "execute_query_product_info_node",   # New route
        "process_direct_updates_node": "process_direct_updates_node",
        "prepare_final_response_node": "prepare_final_response_node"
    }
)
workflow.add_edge("execute_retrieve_hcp_profile_node", "prepare_final_response_node")
workflow.add_edge("execute_suggest_next_action_node", "prepare_final_response_node") # New edge
workflow.add_edge("execute_query_product_info_node", "prepare_final_response_node")   # New edge
workflow.add_edge("process_direct_updates_node", "prepare_final_response_node")
workflow.add_edge("prepare_final_response_node", END)
hcp_interaction_agent = workflow.compile()

# --- FastAPI App (Keep as is) ---
app = FastAPI(title="AI-First HCP CRM Backend", version="0.1.0")
origins = [ "http://localhost:5173", "http://localhost:3000" ]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
async def read_root(): return {"message": "Welcome!"}

@app.post("/interactions/log_structured", response_model=InteractionLogResponse)
async def log_or_update_structured_interaction(interaction_data: InteractionLogCreate):
    # (Your existing log_structured endpoint - keep as is)
    # ... (ensure this part is complete from previous steps) ...
    print("Received structured interaction data:")
    print(f"Data ID: {interaction_data.id}, HCP: {interaction_data.hcpName}") 
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=503, detail="Database connection failed.")
    cursor = None; interaction_id_to_return = interaction_data.id 
    try:
        cursor = conn.cursor()
        if interaction_data.id is not None:
            cursor.execute("SELECT id FROM interaction_logs WHERE id = %s", (interaction_data.id,))
            if cursor.fetchone() is None: conn.rollback(); raise HTTPException(status_code=404, detail=f"Log ID {interaction_data.id} not found for update.")
            sql_update_interaction_log = """UPDATE interaction_logs SET
                    hcpName = %s, interactionType = %s, interactionDate = %s, interactionTime = %s, attendees = %s, 
                    topicsDiscussed = %s, sentiment = %s, outcomes = %s, followUpActions = %s, chatSessionId = %s
                    WHERE id = %s"""
            log_values = (interaction_data.hcpName, interaction_data.interactionType, interaction_data.date, interaction_data.time,
                interaction_data.attendees, interaction_data.topicsDiscussed, interaction_data.sentiment, interaction_data.outcomes,
                interaction_data.followUpActions, interaction_data.chatSessionId, interaction_data.id)
            cursor.execute(sql_update_interaction_log, log_values)
            for table_name in ["interaction_materials_shared", "interaction_samples_distributed", "interaction_products_discussed_ai"]:
                cursor.execute(f"DELETE FROM {table_name} WHERE interaction_log_id = %s", (interaction_data.id,))
        else:
            sql_insert_interaction_log = """INSERT INTO interaction_logs (hcpName, interactionType, interactionDate, interactionTime, attendees,
                topicsDiscussed, sentiment, outcomes, followUpActions, chatSessionId) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            log_values = (interaction_data.hcpName, interaction_data.interactionType, interaction_data.date, interaction_data.time,
                interaction_data.attendees, interaction_data.topicsDiscussed, interaction_data.sentiment, interaction_data.outcomes,
                interaction_data.followUpActions, interaction_data.chatSessionId)
            cursor.execute(sql_insert_interaction_log, log_values)
            interaction_id_to_return = cursor.lastrowid

        if interaction_data.materialsShared and interaction_id_to_return:
            sql_materials = "INSERT INTO interaction_materials_shared (interaction_log_id, material_name) VALUES (%s, %s)"
            cursor.executemany(sql_materials, [(interaction_id_to_return, m.name) for m in interaction_data.materialsShared])
        if interaction_data.samplesDistributed and interaction_id_to_return:
            sql_samples = "INSERT INTO interaction_samples_distributed (interaction_log_id, sample_name) VALUES (%s, %s)"
            cursor.executemany(sql_samples, [(interaction_id_to_return, s.name) for s in interaction_data.samplesDistributed])
        if interaction_data.productsDiscussed and interaction_id_to_return:
            sql_products_ai = "INSERT INTO interaction_products_discussed_ai (interaction_log_id, product_name) VALUES (%s, %s)"
            cursor.executemany(sql_products_ai, [(interaction_id_to_return, p) for p in interaction_data.productsDiscussed])
        conn.commit() 
        response_data = interaction_data.model_dump(); response_data["id"] = interaction_id_to_return
        response_data["message"] = f"Interaction log (ID: {interaction_id_to_return}) {'updated' if interaction_data.id else 'saved'} successfully."
        return InteractionLogResponse(**response_data)
    except MySQLError as e: print(f"DB error: {e}"); conn.rollback(); raise HTTPException(status_code=500, detail=f"Database error: {e.msg}")
    except HTTPException as he: conn.rollback(); raise he
    except Exception as e: print(f"Unexpected error: {e}"); conn.rollback(); raise HTTPException(status_code=500, detail=f"Unexpected server error: {str(e)}")
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

@app.post("/interactions/log_chat_message", response_model=AIChatResponse)
async def langgraph_chat_endpoint(chat_message: AIChatMessage):
    print("\n--- LangGraph Endpoint: Received AI chat message from frontend ---")
    print(chat_message.model_dump_json(indent=2))
    
    initial_agent_input_state: InteractionAgentState = {
        "messages": [HumanMessage(content=chat_message.user_message)],
        "current_extracted_fields": {}, 
        "last_llm_parsed_json": None,
        "tool_output": None,
        "current_action_type": None 
    }

    try:
        final_state = hcp_interaction_agent.invoke(initial_agent_input_state)
        print(f"--- LangGraph Endpoint: Agent final state --- \n{final_state}")
        
        ai_conversational_reply = "Could not determine AI reply."
        if final_state.get("messages") and final_state["messages"] and isinstance(final_state["messages"][-1], AIMessage):
            ai_conversational_reply = final_state["messages"][-1].content
        
        current_extracted_data = final_state.get("current_extracted_fields")
        final_action_type_from_agent = final_state.get("current_action_type", "UNKNOWN")

        return AIChatResponse(
            ai_response=ai_conversational_reply,
            extracted_data=current_extracted_data,
            is_complete=False, 
            final_action_type=final_action_type_from_agent,
            session_id=chat_message.session_id or f"session_lg_{os.urandom(8).hex()}"
        )
    except Exception as e:
        print(f"ERROR: Exception during LangGraph agent invocation: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing message with AI agent: {str(e)}")
