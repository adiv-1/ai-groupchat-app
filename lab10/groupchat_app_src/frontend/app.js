const $ = (id) => document.getElementById(id);

const authPanel = $("auth");
const chatPanel = $("chat");
const messagesDiv = $("messages");
const usernameInput = $("username");
const passwordInput = $("password");
const authMsg = $("authMsg");

const signupBtn = $("signupBtn");
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const chatInput = $("chatInput");
const sendBtn = $("sendBtn");

const API = location.origin + "/api";
let token = localStorage.getItem("token") || "";
let currentUser = localStorage.getItem("currentUser") || "";
let ws;
let reconnectTimer = null;

function showAuth() {
  authPanel.classList.remove("hidden");
  chatPanel.classList.add("hidden");
}

function showChat() {
  authPanel.classList.add("hidden");
  chatPanel.classList.remove("hidden");
}

async function callAPI(path, method = "GET", body) {
  const headers = {"Content-Type": "application/json"};
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error((await res.json()).detail || ("HTTP "+res.status));
  return res.json();
}

const userColors = {};
const colorPalette = ["#f472b6","#60a5fa","#34d399","#fbbf24","#a78bfa","#fb923c","#2dd4bf","#e879f9"];
let colorIndex = 0;

function getUserColor(username) {
  if (!userColors[username]) {
    userColors[username] = colorPalette[colorIndex % colorPalette.length];
    colorIndex++;
  }
  return userColors[username];
}

function addMessage(m) {
  const isMine = !m.is_bot && m.username === currentUser;
  const el = document.createElement("div");
  el.className = "message" + (m.is_bot ? " bot" : "") + (isMine ? " mine" : "");
  const meta = document.createElement("div");
  meta.className = "meta";
  const nameSpan = document.createElement("span");
  nameSpan.textContent = m.is_bot ? "LLM Bot" : (m.username || "unknown");
  nameSpan.style.color = m.is_bot ? "#22d3ee" : getUserColor(m.username);
  nameSpan.style.fontWeight = "bold";
  meta.appendChild(nameSpan);
  meta.appendChild(document.createTextNode(" • " + new Date(m.created_at).toLocaleString()));
  const body = document.createElement("div");
  body.textContent = m.content;
  el.appendChild(meta);
  el.appendChild(body);
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function loadMessages() {
  const data = await callAPI("/messages");
  messagesDiv.innerHTML = "";
  for (const m of data.messages) addMessage(m);
}

function connectWS() {
  if (ws) { ws.onclose = null; ws.close(); }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.type === "message") addMessage(data.message);
    } catch (e) {}
  };
  ws.onclose = () => {
    reconnectTimer = setTimeout(connectWS, 2000);
  };
}

signupBtn.onclick = async () => {
  try {
    const out = await callAPI("/signup", "POST", {
      username: usernameInput.value.trim(),
      password: passwordInput.value
    });
    token = out.token;
    currentUser = usernameInput.value.trim();
    localStorage.setItem("token", token);
    localStorage.setItem("currentUser", currentUser);
    await loadMessages();
    connectWS();
    showChat();
  } catch (e) {
    authMsg.textContent = e.message;
  }
};

loginBtn.onclick = async () => {
  try {
    const out = await callAPI("/login", "POST", {
      username: usernameInput.value.trim(),
      password: passwordInput.value
    });
    token = out.token;
    currentUser = usernameInput.value.trim();
    localStorage.setItem("token", token);
    localStorage.setItem("currentUser", currentUser);
    await loadMessages();
    connectWS();
    showChat();
  } catch (e) {
    authMsg.textContent = e.message;
  }
};

logoutBtn.onclick = () => {
  token = "";
  currentUser = "";
  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");
  showAuth();
};

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  await callAPI("/messages", "POST", {content: text});
}

sendBtn.onclick = sendMessage;
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

if (token) {
  loadMessages().then(()=>{
    connectWS();
    showChat();
  }).catch(()=>showAuth());
} else {
  showAuth();
}
