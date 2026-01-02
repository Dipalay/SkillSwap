// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics, logEvent } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
const analytics = getAnalytics(app);


// ================= CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyCBZps0bzkPnqUsgjiP8sY3oozFaC3Sa0s",
    authDomain: "skillswap21374206967.firebaseapp.com",
    projectId: "skillswap21374206967",
    storageBucket: "skillswap21374206967.firebasestorage.app",
    messagingSenderId: "949227335902",
    appId: "1:949227335902:web:8940d0b7e7b1cab677d24f"
};

initializeApp(firebaseConfig);

const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

let currentChatId = null;
const userNames = {};

// ================= UI ACTIONS =================
document.getElementById("loginBtn").onclick = async () => {
    await signInWithPopup(auth, provider);
};

document.getElementById("logoutBtn").onclick = async () => {
    await signOut(auth);
};

// ================= AUTH STATE =================
let feedUnsub = null;
let recentUnsub = null;
let unreadUnsub = null;
let chatUnsub = null;

onAuthStateChanged(auth, async user => {
    if (!user) {
        cleanupListeners();
        resetUI();
        return;
    }
    document.getElementById("logoutBtn").hidden = false;
    document.getElementById("profile").hidden = false;

    await ensureUserProfile(user);
    listenUserNames();
    listenFeed(user.uid);
    listenRecentUsers(user.uid);
    listenUnreadChats(user.uid);
});

// ================= PROFILE =================
async function ensureUserProfile(user) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        await setDoc(ref, {
            name: user.displayName || "Użytkownik",
            year: "",
            teach: [],
            learn: [],
            createdAt: Date.now(),
                     lastActive: Date.now()
        });
    } else {
        await updateDoc(ref, { lastActive: Date.now() });
    }
}

document.getElementById("saveProfile").onclick = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const nameInput = document.getElementById("name");
    const yearInput = document.getElementById("year");
    const teachInput = document.getElementById("teach");
    const learnInput = document.getElementById("learn");

    const name = nameInput.value.trim();
    const year = yearInput.value.trim();
    const teach = teachInput.value.trim();
    const learn = learnInput.value.trim();

    if (!name || !teach || !learn) {
        alert("Uzupełnij imię, umiejętności i czego chcesz się nauczyć");
        return;
    }

    await updateDoc(doc(db, "users", user.uid), {
        name,
        year,
        teach: teach.split(",").map(s => s.trim()).filter(Boolean),
                    learn: learn.split(",").map(s => s.trim()).filter(Boolean),
                    lastActive: Date.now()
    });
};


// ================= FEED (REALTIME) =================
function listenFeed(myId) {
    if (feedUnsub) feedUnsub();

    const feed = document.getElementById("feed");

    feedUnsub = onSnapshot(collection(db, "users"), snapshot => {
        feed.innerHTML = "";

        let me = null;
        snapshot.forEach(d => {
            if (d.id === myId) me = d.data();
        });

            if (!me || !me.teach.length || !me.learn.length) {
                feed.innerHTML = "<p>Uzupełnij profil, aby zobaczyć dopasowania.</p>";
                return;
            }

            renderMyProfile(me);

            snapshot.forEach(d => {
                if (d.id === myId) return;
                const u = d.data();
                if (!u.teach?.length || !u.learn?.length) return;

                const match =
                me.learn.some(x => u.teach.includes(x)) &&
                me.teach.some(x => u.learn.includes(x));

                if (!match) return;

                feed.appendChild(createUserCard(u, d.id));
            });
    });
}

// ================= RECENT USERS =================
function listenRecentUsers(myId) {
    if (recentUnsub) recentUnsub();

    const list = document.getElementById("recentList");

    const q = query(
        collection(db, "users"),
                    orderBy("lastActive", "desc"),
                    limit(5)
    );

    recentUnsub = onSnapshot(q, snapshot => {
        list.innerHTML = "";

        snapshot.forEach(d => {
            if (d.id === myId) return;
            list.appendChild(createUserCard(d.data(), d.id));
        });
    });
}

// ================= UNREAD MESSAGES =================
const messageListeners = {};
const unreadMap = {};

function listenUnreadChats(myId) {
    if (unreadUnsub) unreadUnsub();

    const box = document.getElementById("unreadList");

    unreadUnsub = onSnapshot(collection(db, "chats"), snapshot => {


        snapshot.forEach(chatDoc => {
            const chat = chatDoc.data();
            if (!chat.users?.includes(myId)) return;

            const otherId = chat.users.find(id => id !== myId);
            const lastRead = chat.lastRead?.[myId] || 0;

            if (messageListeners[chatDoc.id]) return;

            const q = query(
                collection(db, "chats", chatDoc.id, "messages"),
                            orderBy("time", "desc"),
                            limit(1)
            );

            messageListeners[chatDoc.id] = onSnapshot(q, snap => {
                let hasUnread = false;

                snap.forEach(m => {
                    const msg = m.data();
                    if (
                        msg.from !== myId &&
                        msg.time?.toMillis() > lastRead
                    ) {
                        hasUnread = true;
                    }
                });

                if (hasUnread) {
                    unreadMap[chatDoc.id] = otherId;
                } else {
                    delete unreadMap[chatDoc.id];
                }

                renderUnreadUI();
            });

        });
    });
}

function renderUnreadUI() {
    const box = document.getElementById("unreadList");
    box.innerHTML = "";

    const entries = Object.entries(unreadMap);

    if (!entries.length) {
        box.innerHTML = "<p>Brak nowych wiadomości.</p>";
        return;
    }

    entries.forEach(([chatId, otherId]) => {
        const div = document.createElement("div");
        div.textContent = `💬 ${userNames[otherId] || "Użytkownik"}`;
        div.onclick = async () => {
            // 🔥 NATYCHMIAST usuwamy z lokalnego stanu
            delete unreadMap[chatId];
            renderUnreadUI();

            await openChat(otherId);
        };

        box.appendChild(div);
    });
}


// ================= CHAT =================
async function openChat(otherUserId) {
    const chat = document.getElementById("chat");
    if (!chat) return;

    const user = auth.currentUser;
    if (!user) return;

    const myId = user.uid;

    // 🔒 stabilne ID czatu (bez duplikatów)
    const chatId = [myId, otherUserId].sort().join("_");
    currentChatId = chatId;

    // 👉 pokaż czat
    chat.hidden = false;

    // 👉 mobile: blokuj scroll tła
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
        document.body.classList.add("chat-open");
    }

    // 🔥 utwórz czat jeśli nie istnieje
    const chatRef = doc(db, "chats", chatId);
    await setDoc(
        chatRef,
        {
            users: [myId, otherUserId],
            createdAt: serverTimestamp(),
                 lastRead: {
                     [myId]: Date.now(),
                 [otherUserId]: 0
                 }
        },
        { merge: true }
    );

    // 👉 zacznij nasłuch wiadomości
    listenMessages();

    // 👉 oznacz jako przeczytane (dla mnie)
    await updateDoc(chatRef, {
        [`lastRead.${myId}`]: Date.now()
    });
}


async function markChatAsRead(chatId) {
    const myId = auth.currentUser.uid;
    await updateDoc(doc(db, "chats", chatId), {
        [`lastRead.${myId}`]: Date.now()
    });
}


function listenMessages() {
    if (chatUnsub) chatUnsub();

    const messages = document.getElementById("messages");
    const myId = auth.currentUser.uid;
    const chatId = currentChatId;

    const q = query(
        collection(db, "chats", chatId, "messages"),
                    orderBy("time")
    );

    chatUnsub = onSnapshot(q, async snapshot => {
        const myId = auth.currentUser.uid;

        // czy użytkownik jest przy dole?
        const shouldScroll =
        messages.scrollTop + messages.clientHeight >=
        messages.scrollHeight - 50;

        messages.innerHTML = "";

        snapshot.forEach(d => {
            const m = d.data();
            const div = document.createElement("div");
            div.className = "message " + (m.from === myId ? "me" : "other");
            div.textContent = m.text;
            messages.appendChild(div);
        });

        // 🔥 auto-scroll tylko jeśli user był na dole
        if (shouldScroll) {
            messages.scrollTop = messages.scrollHeight;
        }


        // 🔥 DOPIERO TERAZ: użytkownik FAKTYCZNIE widzi wiadomości
        await updateDoc(doc(db, "chats", chatId), {
            [`lastRead.${myId}`]: Date.now()
        });
    });
}


document.getElementById("sendMsg").onclick = async () => {
    if (!currentChatId || !msgInput.value.trim()) return;

    await addDoc(collection(db, "chats", currentChatId, "messages"), {
        text: msgInput.value.trim(),
                 from: auth.currentUser.uid,
                 time: serverTimestamp()
    });

    msgInput.value = "";
};

document.addEventListener("DOMContentLoaded", () => {
    const msgInput = document.getElementById("msgInput");
    if (!msgInput) return;
    msgInput.addEventListener("keydown", (e) => {
        const isMobile = window.matchMedia("(max-width: 768px)").matches;

        if (!isMobile && e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            document.getElementById("sendMsg").click();
        }
    });
});



// ================= HELPERS =================
function listenUserNames() {
    onSnapshot(collection(db, "users"), snap => {
        snap.forEach(d => {
            userNames[d.id] = d.data().name;
        });
    });
}

function createUserCard(u, uid) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
    <strong>${u.name || "Użytkownik"}</strong><br>
    <small>Rok: ${u.year || "-"}</small><br>
    <small><b>Uczy:</b> ${u.teach.join(", ")}</small><br>
    <small><b>Chce się nauczyć:</b> ${u.learn.join(", ")}</small><br>
    `;

    const btn = document.createElement("button");
    btn.textContent = "Napisz";
    btn.onclick = () => openChat(uid);

    card.appendChild(btn);
    return card;
}

function renderMyProfile(me) {
    myProfile.hidden = false;
    myProfileContent.innerHTML = `
    <strong>${me.name}</strong><br>
    <small>Uczę: ${me.teach.join(", ")}</small><br>
    <small>Chcę się nauczyć: ${me.learn.join(", ")}</small>
    `;
}

function cleanupListeners() {
    feedUnsub?.();
    recentUnsub?.();
    unreadUnsub?.();
    chatUnsub?.();
}

function resetUI() {
    feed.innerHTML = "";
    recentList.innerHTML = "";
    unreadList.innerHTML = "";
    chat.hidden = true;
    myProfile.hidden = true;
    document.getElementById("logoutBtn").hidden = true;
    document.getElementById("profile").hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
    const chat = document.getElementById("chat");
    const closeChatBtn = document.getElementById("closeChat");
    const closeChatDesktopBtn = document.getElementById("closeChatDesktop");

    function closeChat() {
        if (!chat) return;
        chat.hidden = true;
        document.body.classList.remove("chat-open");
        currentChatId = null;
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener("click", (e) => {
            e.preventDefault();
            closeChat();
        });
    }

    if (closeChatDesktopBtn) {
        closeChatDesktopBtn.addEventListener("click", (e) => {
            e.preventDefault();
            closeChat();
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const ad = document.getElementById("facemashAd");
    if (!ad) return;

    ad.addEventListener("click", () => {
        window.open("facemash.html", "_blank");
    });
});
logEvent(analytics, "page_view_test");







