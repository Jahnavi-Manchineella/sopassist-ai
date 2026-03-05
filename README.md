# 🏦 SOPAssist AI – Banking Knowledge Assistant

SOPAssist AI is an **AI-powered knowledge chatbot designed for banking operations teams**.
It enables employees to quickly retrieve accurate answers from internal **SOPs, policies, and operational documents** using **AI-powered semantic search and Retrieval Augmented Generation (RAG)**.

The system improves operational efficiency, reduces dependency on subject matter experts, and ensures responses are **grounded in verified documentation with citations**.

---

# 🚀 Live Demo

*(Add your public website link here after deployment)*

Example:

https://sopassist-ai.lovable.app

---

# 📌 Problem Statement

Banking operations teams often struggle with:

• Fragmented knowledge across SOP documents
• Difficulty finding compliance information quickly
• Heavy reliance on subject matter experts
• Slow query resolution
• Inconsistent responses across teams

SOPAssist AI addresses these challenges by providing a **centralized AI-powered knowledge retrieval assistant**.

---

# 🧠 Solution Overview

The chatbot uses **Retrieval Augmented Generation (RAG)** to ensure answers come from verified knowledge sources.

Workflow:

1️⃣ Knowledge documents (SOPs, policies) are uploaded
2️⃣ Documents are split into chunks
3️⃣ Embeddings are generated for semantic search
4️⃣ Relevant document sections are retrieved
5️⃣ The AI generates an answer grounded in the retrieved content

This ensures **accurate and context-aware responses**.

---

# 🏗️ System Architecture

Frontend
React + Vite + TypeScript
Tailwind CSS
shadcn UI

Backend / Services
Supabase (Auth + Database)

AI Components
Semantic search with embeddings
Vector retrieval pipeline
LLM-based response generation

---

# ⚙️ Key Features

### 💬 AI Chatbot Interface

Users can ask operational questions in natural language.

Example:

"What is the procedure for customer onboarding?"

---

### 📄 Document Knowledge Retrieval

The chatbot retrieves answers from approved knowledge documents.

---

### 🔎 Semantic Search

Uses embeddings to find the most relevant document sections.

---

### 📑 Citation-Based Responses

Each answer references the source document.

---

### 🧠 Contextual Conversations

Supports follow-up questions and conversation memory.

---

### 📊 Query Logging

Tracks queries and responses for audit and analysis.

---

# 📂 Project Structure

```
sopassist-ai
│
├── public
│   Static assets
│
├── src
│   ├── components
│   ├── pages
│   ├── hooks
│   ├── integrations
│   └── lib
│
├── supabase
│   Database and authentication configuration
│
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

---

# 🛠️ Tech Stack

Frontend

• React
• Vite
• TypeScript
• Tailwind CSS
• shadcn UI

Backend / Services

• Supabase

AI / ML

• Retrieval Augmented Generation (RAG)
• Vector search
• Large Language Models

---

# 📊 Example Workflow

### Step 1 – Upload SOP documents

Example:

Customer_Onboarding_SOP.pdf

---

### Step 2 – Ask a question

```
What are the steps for customer onboarding?
```

---

### Step 3 – AI retrieves relevant document sections

---

### Step 4 – AI generates grounded response

Example response:

```
Customer onboarding includes the following steps:

1. Verify KYC documents
2. Collect identity proof
3. Validate customer address
4. Create customer profile in the banking system

Source:
Customer_Onboarding_SOP.pdf
```

---

# 🔐 Security (POC Level)

• Role-based access (Admin/User)
• Controlled document knowledge sources
• Query audit logging

---

# 💻 Local Development

Clone the repository

```
git clone https://github.com/Jahnavi-Manchineella/sopassist-ai.git
```

Navigate into the project

```
cd sopassist-ai
```

Install dependencies

```
npm install
```

Run development server

```
npm run dev
```

---

# 🌐 Deployment

This project can be deployed using:

Frontend

• Vercel
• Netlify
• Lovable Publish

---

# 🚀 Future Enhancements

• Voice-based AI assistant
• Advanced analytics dashboard
• Document highlighting for citations
• Multi-document knowledge retrieval
• Enterprise authentication (SSO)

---

# 👩‍💻 Author

Jahnavi Manchineella

AI / Software Engineering Student

---

⭐ If you find this project useful, consider giving it a star on GitHub!
