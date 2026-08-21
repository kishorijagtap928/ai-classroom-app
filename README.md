# Smart Study Buddy

Build a full-stack AI-powered mobile application called "Virtual AI Classroom" using the following STRICT tech stack:

🧱 Tech Stack (DO NOT CHANGE)

Frontend: Flutter (Dart)

Backend: FastAPI (Python, async)

Database: MongoDB (use Motor for async operations)

AI Integration: OpenAI API (GPT) or Gemini API

Authentication: JWT-based authentication system

🎯 Core Objective

Create a mobile app where students can log in, upload/select their syllabus, and learn through an AI teacher that simulates a real classroom experience.

🔐 Authentication System

Implement secure authentication with:

JWT token-based login/signup

Role-based access:

Student

Admin

Password hashing using bcrypt

API Endpoints:

POST /auth/signup

POST /auth/login

👨‍🎓 Student Features

1. Dashboard

Display enrolled syllabus

Show progress tracking (topics completed)

Show quiz scores and weak areas

2. AI Chat Assistant

Real-time chat interface (like WhatsApp)

Use WebSockets (/ws/chat) for streaming AI responses

AI answers must be contextual to student's syllabus

3. Virtual Classroom (Main Feature)

Simulate teaching like a real teacher:

Structured flow:

Introduction

Explanation

Examples

Summary

Quiz

Maintain lesson state per topic

AI must teach step-by-step (not just answer)

4. Syllabus Upload & Parser

Upload syllabus (text or PDF)

Backend parses into structured format:
Board → Grade → Subject → Chapters → Topics

Store in MongoDB

5. Quiz System

Auto-generate MCQs after each topic using AI

Evaluate answers

Store performance in DB

🧑‍💼 Admin Features

Admin Dashboard

View all students

View analytics:

Most asked questions

Weak topics

Average scores

Syllabus Management

Add / Edit / Delete syllabus

Assign syllabus to students

🗄️ MongoDB Schema Design

users

_id, name, email, passwordHash, role, profile

syllabus

_id, board, grade, subject, chapters: [{title, topics[]}]

enrollments

userId, syllabusId, progress, scores

chats

userId, messages, timestamps

analytics

userId, timeSpent, performance

🔌 FastAPI Backend Requirements

Use async FastAPI with Uvicorn

Use Motor for MongoDB async queries

Implement:

REST APIs

WebSocket endpoint: /ws/chat

Use StreamingResponse or WebSockets for AI streaming

📱 Flutter Frontend Requirements

Build clean mobile UI with:

Login/Register screens

Dashboard screen

Chat screen (AI assistant)

Virtual classroom screen

Use:

http or Dio for API calls

web_socket_channel for chat

Provider or Riverpod for state management

🧠 AI Logic Rules

AI must behave like a teacher

Always explain step-by-step

Provide examples

Generate quizzes

Support:

“Explain again differently”

“Teach me like I’m 10”

⚡ Special Features

Real-time AI response streaming

Weak topic detection

Progress tracking system

Gamification (badges, progress bar)

🔐 Security

JWT authentication

Password hashing (bcrypt)

Input validation (Pydantic)

Role-based access control

🚀 Deployment Ready

Backend deployable on Render / Railway

MongoDB Atlas integration

Environment variables (.env for API keys)

📦 Output Requirements

Generate:

Full FastAPI backend code (modular structure)

Full Flutter frontend code

MongoDB models & schema handling

API integration between frontend & backend

Setup instructions

🧪 Bonus (Optional)

Voice input/output (speech-to-text + TTS)

Spaced repetition learning system

Leaderboard or challenge system

Ensure code is clean, modular, and production-ready.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ai-classroom-app.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/46e6c562-f14e-4949-80d4-19cfa8c79765).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
