# 💬 Convox — Real-Time Chat Application

Convox is a full-stack real-time chat application built using the MERN stack. It allows users to communicate instantly with secure authentication and a modern chat interface.

---

## 🚀 Features

* 🔐 User Authentication (JWT-based)
* 🔑 Secure Login & Signup (Password hashing with bcrypt)
* 💬 One-to-One Chat System
* 📩 Real-Time Messaging (Socket.IO - upcoming)
* 📜 Chat History (Load previous messages)
* 🧠 Smart Chat Creation (No duplicate chats)
* 📊 Latest Message Preview
* ⚡ Fast and responsive backend

---

## 🛠️ Tech Stack

### Backend:

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT (Authentication)
* bcrypt (Password hashing)

### Frontend (Planned / In Progress):

* React.js
* Axios
* Context API / Redux

---

## 📁 Folder Structure

```
/backend
  /controllers
  /models
  /routes
  /middleware
  /config
  server.js
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

---

## 🚀 Installation & Setup

### 1. Clone the repository

```
git clone https://github.com/your-username/convox.git
cd convox/backend
```

### 2. Install dependencies

```
npm install
```

### 3. Run the server

```
npm run dev
```

Server will run on:

```
http://localhost:5000
```

---

## 🔗 API Endpoints

### 🔐 Auth Routes

* POST `/api/users/register` → Register user
* POST `/api/users/login` → Login user

### 💬 Chat Routes

* POST `/api/chat` → Create or access chat
* GET `/api/chat` → Fetch all chats

### 📩 Message Routes

* POST `/api/message` → Send message
* GET `/api/message/:chatId` → Get all messages

---

## 🧠 Learning Highlights

* REST API Design
* Authentication & Authorization (JWT)
* MongoDB Schema Design & Relationships
* Backend Architecture (MVC Pattern)
* Real-time communication (Socket.IO - upcoming)

---

## 🔥 Upcoming Features

* 🌐 Real-Time Messaging (Socket.IO)
* 🟢 Online/Offline Status
* ✍️ Typing Indicator
* 📸 File/Image Sharing
* 🔐 Google Authentication
* 🎨 Modern Chat UI

---

## 🤝 Contribution

Contributions are welcome! Feel free to fork the repo and submit pull requests.

---

## 📌 Author

Aditya Prabhat Gupta
MERN Stack Developer

---

## ⭐ Show Your Support

If you like this project, give it a ⭐ on GitHub!

---
