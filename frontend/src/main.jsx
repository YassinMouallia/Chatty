import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: `${API}/api` });

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [newUser, setNewUser] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [chatError, setChatError] = useState("");
  const socket = useRef(null);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      loadConversations();
    }
  }, [token]);

  useEffect(() => {
    if (!token || !newUser.trim()) {
      setUserResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setUserResults((await api.get(`/users/?search=${encodeURIComponent(newUser.trim())}`)).data);
      } catch {
        setUserResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [newUser, token]);

  async function authenticate(event) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (registering) {
        await api.post("/auth/register/", { username, password });
        setRegistering(false);
        setPassword("");
      } else {
        const response = await api.post("/auth/token/", { username, password });
        localStorage.setItem("token", response.data.access);
        localStorage.setItem("username", username);
        setToken(response.data.access);
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      const fieldError = error.response?.data && Object.values(error.response.data)[0];
      setAuthError(detail || (Array.isArray(fieldError) ? fieldError[0] : "Unable to complete your request."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadConversations() {
    setConversations((await api.get("/conversations/")).data);
  }

  async function createConversation(name = newUser.trim()) {
    if (!name) return;
    try {
      const conversation = (await api.post("/conversations/", { username: name })).data;
      setNewUser("");
      setUserResults([]);
      await loadConversations();
      openConversation(conversation);
    } catch (error) {
      setChatError(error.response?.data?.detail || "Could not open this conversation.");
    }
  }

  async function openConversation(conversation) {
    setSelected(conversation);
    setChatError("");
    setMessages((await api.get(`/conversations/${conversation.id}/messages/`)).data);
    socket.current?.close();
    const wsBase = API ? API.replace(/^http/, "ws") : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    socket.current = new WebSocket(`${wsBase}/ws/conversations/${conversation.id}/?token=${token}`);
    socket.current.onmessage = event => {
      const packet = JSON.parse(event.data);
      setMessages(current => {
        if (packet.event === "message.deleted") return current.filter(message => message.id !== packet.message.id);
        if (packet.event === "message.updated") return current.map(message => message.id === packet.message.id ? packet.message : message);
        return current.some(message => message.id === packet.message.id) ? current : [...current, packet.message];
      });
    };
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!selected || (!body.trim() && !selectedImage)) return;
    try {
      if (selectedImage) {
        const data = new FormData();
        data.append("body", body);
        data.append("image", selectedImage);
        const message = (await api.post(`/conversations/${selected.id}/messages/`, data)).data;
        setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      } else if (socket.current?.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify({ body }));
      }
      setBody("");
      setSelectedImage(null);
    } catch (error) {
      setChatError(error.response?.data?.detail || "Message could not be sent.");
    }
  }

  async function deleteMessage(messageId) {
    try {
      await api.delete(`/conversations/${selected.id}/messages/${messageId}/`);
      setMessages(current => current.filter(message => message.id !== messageId));
    } catch {
      setChatError("Message could not be deleted.");
    }
  }

  async function togglePin(message) {
    try {
      const updated = (await api.patch(`/conversations/${selected.id}/messages/${message.id}/`, { is_pinned: !message.is_pinned })).data;
      setMessages(current => current.map(item => item.id === updated.id ? updated : item));
    } catch {
      setChatError("Message could not be updated.");
    }
  }

  if (!token) return <main className="auth-shell">
    <section className="auth-brand-panel"><div className="brand-lockup"><img className="brand-logo" src="/assets/chatty.svg" alt="" /><span>Chatty</span></div><div className="brand-copy"><p className="eyebrow">Private conversations, made simple</p><h1>Stay close to the people who matter.</h1><p className="brand-description">Fast, friendly messaging with a calm space for every conversation.</p></div><p className="brand-footer">Simple. Private. Human.</p></section>
    <section className="auth-form-panel"><div className="auth-form-wrap"><div className="mobile-brand"><img className="brand-logo" src="/assets/chatty.svg" alt="" /><span>Chatty</span></div><div className="auth-heading"><p className="eyebrow">{registering ? "Join the conversation" : "Welcome back"}</p><h2>{registering ? "Create your account" : "Sign in to Chatty"}</h2><p>{registering ? "It only takes a moment to get started." : "Pick up where you left off."}</p></div><form onSubmit={authenticate} className="auth-form">{authError && <div className="auth-alert" role="alert">{authError}</div>}<div className="auth-field"><label htmlFor="username">Username</label><input id="username" className="form-control" autoComplete="username" placeholder="Enter your username" value={username} onChange={event => setUsername(event.target.value)} required /></div><div className="auth-field"><label htmlFor="password">Password</label><input id="password" className="form-control" type="password" minLength="8" autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? "At least 8 characters" : "Enter your password"} value={password} onChange={event => setPassword(event.target.value)} required /></div><button className="auth-submit" disabled={authLoading}>{authLoading ? "Please wait..." : registering ? "Create account" : "Sign in"}<span aria-hidden="true">→</span></button></form><p className="auth-switch">{registering ? "Already have an account?" : "New to Chatty?"} <button type="button" onClick={() => { setRegistering(!registering); setAuthError(""); }}>{registering ? "Sign in" : "Create an account"}</button></p><p className="auth-privacy"><span aria-hidden="true">▣</span> Your conversations are yours alone.</p></div></section>
  </main>;

  return <main className="chat-app">
    <header className="app-header">
      <div className="brand-lockup"><img className="brand-logo" src="/assets/chatty.svg" alt="" /><span>Chatty</span></div>
      <div className="header-user"><span className="avatar">{username.charAt(0).toUpperCase()}</span><span>{username}</span><button className="icon-button" onClick={() => { localStorage.clear(); setToken(null); }} aria-label="Sign out">↪</button></div>
    </header>
    <div className="chat-workspace">
      <aside className="conversation-sidebar">
        <div className="sidebar-heading"><div><p className="eyebrow">Your space</p><h1>Messages</h1></div><span className="message-count">{conversations.length}</span></div>
        <form className="user-search" onSubmit={event => { event.preventDefault(); createConversation(); }}>
          <span aria-hidden="true">⌕</span><input aria-label="Search users" placeholder="Search by username" value={newUser} onChange={event => setNewUser(event.target.value)} />
          {userResults.length > 0 && <div className="user-results">{userResults.map(user => <button type="button" key={user.id} onClick={() => createConversation(user.username)}><span className="avatar small">{user.username.charAt(0).toUpperCase()}</span><span>{user.username}</span><span className="result-arrow">→</span></button>)}</div>}
        </form>
        <div className="conversation-list">{conversations.map(conversation => {
          const other = conversation.participants.find(person => person.username !== username) || conversation.participants[0];
          return <button className={`conversation ${selected?.id === conversation.id ? "active" : ""}`} key={conversation.id} onClick={() => openConversation(conversation)}><span className="avatar">{other?.username.charAt(0).toUpperCase()}</span><span className="conversation-copy"><strong>{other?.username}</strong><small>{conversation.last_message?.body || "Start a conversation"}</small></span><span className="conversation-arrow">›</span></button>;
        })}</div>
      </aside>
      <section className="chat-panel">
        {selected ? <>
          <div className="chat-heading"><div className="avatar">{(selected.participants.find(person => person.username !== username) || selected.participants[0]).username.charAt(0).toUpperCase()}</div><div><h2>{(selected.participants.find(person => person.username !== username) || selected.participants[0]).username}</h2><span><i className="online-dot" /> Connected securely</span></div></div>
          <div className="message-stream">
            <div className="conversation-intro"><span className="avatar large">{(selected.participants.find(person => person.username !== username) || selected.participants[0]).username.charAt(0).toUpperCase()}</span><p>This is the beginning of your conversation.</p></div>
            {messages.map(message => <article className={`message ${message.sender.username === username ? "mine" : ""}`} key={message.id}><div className="message-bubble">{message.image_url && <img src={message.image_url} alt="Shared attachment" className="message-image" />}{message.body && <p>{message.body}</p>}<div className="message-meta"><time>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{message.is_pinned && <span title="Pinned message">📌</span>}</div></div><div className="message-actions"><button onClick={() => togglePin(message)}>{message.is_pinned ? "Unpin" : "Pin"}</button>{message.sender.username === username && <button onClick={() => deleteMessage(message.id)}>Delete</button>}</div></article>)}
          </div>
          {chatError && <div className="chat-error">{chatError}</div>}
          <form className="composer" onSubmit={sendMessage}><label className="attachment-button" aria-label="Attach image">＋<input type="file" accept="image/*" onChange={event => setSelectedImage(event.target.files[0] || null)} /></label><div className="composer-input">{selectedImage && <span className="attachment-preview">📷 {selectedImage.name}</span>}<input value={body} onChange={event => setBody(event.target.value)} placeholder="Write a message..." aria-label="Message" /></div><button className="send-button" aria-label="Send message">↑</button></form>
        </> : <div className="empty-chat"><span className="empty-mark">↗</span><h2>Your conversations, your way.</h2><p>Search for someone by username or choose a conversation to start chatting.</p></div>}
      </section>
    </div>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
