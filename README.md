# AI-First HCP CRM: Interaction Logging Module (Blueprint)

## Project Overview

This project serves as a blueprint and proof-of-concept for an AI-First Customer Relationship Management (CRM) system, specifically focusing on the Healthcare Professional (HCP) interaction logging module. It demonstrates how a conversational AI assistant can streamline the process for Life Science field representatives to log their engagements with HCPs, extract key information, and pre-fill structured forms.

The system features a React frontend, a Python (FastAPI) backend, and a LangGraph-based AI agent leveraging Groq's `gemma2-9b-it` LLM for natural language understanding and interaction. Data persistence is handled by a MySQL database.

**Note:** This project is currently a demonstration of core functionalities and a conceptual framework. Several advanced features, including robust user authentication and fully implemented AI tools, are outlined as future enhancements.

## Key Features Implemented & Conceptualized

* **Dual Interaction Logging Interface (Frontend):**
    * Structured form for traditional data entry.
    * Conversational AI chat interface for logging interactions using natural language.
* **AI-Powered Field Extraction (Backend + AI):**
    * User's chat input is processed by a LangGraph agent using `gemma2-9b-it`.
    * The AI extracts key entities (HCP name, date, time, topics, sentiment, materials, follow-ups, etc.).
    * These extracted details are used to pre-fill the structured form fields on the frontend.
* **Conceptual AI Edit Functionality (Backend + AI):**
    * The LangGraph agent is designed to understand natural language requests to edit previously extracted information (held in the agent's current state).
    * The frontend UI reflects these AI-driven edits to the form data.
* **Database Interaction (Backend):**
    * Logged interactions (from the structured form, potentially populated by AI) are saved to a MySQL database.
    * Includes basic logic to either insert new interaction logs or update existing ones if an ID is provided (Note: frontend currently primarily supports inserting new logs after each AI-assisted logging session).
* **Conceptual AI Agent Tools (Backend - Placeholders):**
    * **Retrieve HCP Profile:** Agent can identify requests for HCP information. (Currently returns dummy data).
    * **Suggest Next Best Action:** Agent can identify requests for suggestions. (Currently returns dummy data).
    * **Query Product Information:** Agent can identify requests for product details. (Currently returns dummy data).

## Tech Stack

* **Frontend:**
    * React UI
    * Redux (for state management)
    * Tailwind CSS
    * `lucide-react` (for icons)
    * Font: Google Inter
* **Backend:**
    * Python
    * FastAPI
    * `mysql-connector-python` (for MySQL interaction)
* **AI:**
    * LangGraph (AI Agent Framework)
    * Groq API with `gemma2-9b-it` LLM
* **Database:**
    * MySQL

## Project Status & Future Enhancements (To-Do)

This project is a functional **blueprint** demonstrating the core AI-assisted interaction logging workflow. Several key areas are marked for future implementation to develop this into a full-fledged application:

* **User Authentication & Authorization:**
    * Implement a robust user login system (e.g., using JWT - JSON Web Tokens).
    * Associate interaction logs with specific, authenticated users in the database.
    * Secure endpoints and ensure users can only access and edit their own relevant data.
* **Full Implementation of AI Agent Tools:**
    * **Retrieve HCP Profile:** Connect the tool to the MySQL database to fetch real HCP data.
    * **Suggest Next Best Action:** Develop the logic (rule-based or ML-based) and database integration for providing meaningful, context-aware suggestions.
    * **Query Product Information:** Integrate with a product database or knowledge base to provide accurate answers.
    * Implement the other conceptualized tools (e.g., Profile Augmentation, Territory Optimizer, etc.).
* **Database - True Edit Functionality:**
    * Refine the frontend and backend logic to robustly support updating *existing specific* database records for interactions, rather than primarily creating new ones after each "Log" action. This involves the frontend managing the ID of the currently edited log and choosing between POST (create) and PUT (update) requests.
* **Stateful LangGraph Agent:**
    * Implement persistent state management for the LangGraph agent across multiple user interactions within a session (e.g., using Redis or a database for agent state). Currently, the agent state for `current_extracted_fields` is largely reset per `/log_chat_message` call.
* **Comprehensive HCP Module Features:**
    * Build out other CRM functionalities outlined in Task 2 (Campaigns, Call Planning UI, full KOL Management, etc.).
* **Advanced Error Handling & UI/UX Refinements:**
    * More sophisticated error handling and user feedback mechanisms.
    * Enhanced UI for displaying lists, search results, etc.
* **Testing:** Comprehensive unit, integration, and end-to-end tests.
* **Deployment:** Setup for deploying the frontend and backend.

## Setup and Installation

**(Note: Ensure you have Node.js, npm/yarn, Python, pip, and a MySQL server installed and running.)**

**1. Backend (`main.py` - FastAPI):**

   a. **Clone the repository (if applicable) and navigate to the backend directory.**

   b. **Create and activate a Python virtual environment:**
      ```bash
      python -m venv venv
      # Windows
      venv\Scripts\activate
      # macOS/Linux
      source venv/bin/activate
      ```

   c. **Install Python dependencies:**
      ```bash
      pip install fastapi "uvicorn[standard]" pydantic mysql-connector-python python-dotenv groq langgraph langchain_core
      ```

   d. **Set up the `.env` file:**
      Create a `.env` file in the backend's root directory with your credentials:
      ```env
      GROQ_API_KEY="YOUR_GROQ_API_KEY"
      DB_HOST="localhost"
      DB_USER="your_mysql_user"
      DB_PASSWORD="your_mysql_password"
      DB_NAME="your_database_name"
      ```
      Replace placeholders with your actual details.

   e. **Database Setup:**
      * Ensure your MySQL server is running.
      * Create the database specified in `DB_NAME`.
      * Create the necessary tables using the SQL schema provided (see `database_schema.sql` or previous instructions for table creation SQL: `interaction_logs`, `interaction_materials_shared`, etc.).

   f. **Run the backend server:**
      ```bash
      uvicorn main:app --reload
      ```
      The backend will typically run on `http://127.0.0.1:8000`.

**2. Frontend (`App.jsx` - React with Vite):**

   a. **Navigate to the frontend directory.**

   b. **Install Node.js dependencies:**
      ```bash
      npm install
      # or
      # yarn install
      ```
      Ensure you have installed: `react`, `react-dom`, `react-redux`, `@reduxjs/toolkit`, `lucide-react`, `tailwindcss`.

   c. **Configure Tailwind CSS:**
      Ensure `tailwind.config.js` and your main CSS file (e.g., `src/index.css` with `@import "tailwindcss";` or `@tailwind` directives) are correctly set up.

   d. **Ensure Font is Linked:**
      The "Inter" font should be linked in your `public/index.html` or main CSS file.

   e. **Run the frontend development server:**
      ```bash
      npm run dev
      # or
      # yarn dev
      ```
      The frontend will typically run on `http://localhost:5173`.

## How to Use

1.  Ensure both the backend and frontend servers are running.
2.  Open your browser and navigate to the frontend URL (e.g., `http://localhost:5173`).
3.  Use the chat interface on the right to describe an HCP interaction. The AI should respond and attempt to populate the form fields on the left.
4.  Manually fill in or correct any fields on the left as needed.
5.  Click the "Log" button (in the chat panel) to submit the chat message for AI processing and then automatically save the entire form's content (including AI-populated and manually entered data) to the database.
