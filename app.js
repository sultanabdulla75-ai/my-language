// ------------------------------------------------------ //
// منصة لغتي - ملف app.js
// ------------------------------------------------------ //

// ===== متغير عام للقصة الحالية في القارئ =====
let currentBook = null;
// وقت بدء القراءة الحالي (بالمللي ثانية)
let readingStartAt = null;
let readingStartTime = null;
let hasInteractedWithStory = false;

// ===== Firestore Imports =====
import { 
    doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, 
    // 🔔 إشعارات (إضافة مطلوبة)
    query, where, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ملاحظة: سنستخدم window.db الذي تم ضبطه في index.html

// ===== Storage keys =====
const LS = {
    USERS: 'arp.users',
    CURRENT: 'arp.current',
    ROLE: 'arp.role',
    CLASSES: 'arp.classes',
    ASSIGN: 'arp.assignments',
    // =====STATS: uid => arp.stats.${uid} =====
};

// ===== Data =====
const LEVELS = [
    { id: 'L1', name: 'المستوى 1 (مبتدئ)' },
    { id: 'L2', name: 'المستوى 2 (أساسي)' },
    { id: 'L3', name: 'المستوى 3 (متوسط)' },
    { id: 'L4', name: 'المستوى 4 (متقدم)' }
];

const BOOKS = [
    { 
        id: 'b1', level: 'L1', title: 'الصداقة', 
        cover: 'https://picsum.photos/seed/b1/160/210', 
        text: [
            'في يومٍ جميلٍ التقى سالمٌ وصديقُه راشدٌ في الحديقة.',
            'تحدّثا عن معنى الصداقة، ووعدا أن يساعد كلُّ واحدٍ منهما الآخر.'
        ],
        quiz: [
            { q: "أين التقى سالم وراشد؟", options: ["في السوق", "في الحديقة", "في المدرسة"], correct: 1 },
            { q: "ماذا وعد الصديقان؟", options: ["ألا يتكلما", "أن يساعد كل واحد الآخر", "أن يذهبا للبيت"], correct: 1 }
        ]
    },
    { 
        id: 'b2', level: 'L1', title: 'جمل اسميّة', 
        cover: 'https://picsum.photos/seed/b2/160/210', 
        text: [
            'السماءُ صافيةٌ، والنسيمُ عليلٌ.',
            'المعرفةُ نورٌ، والقارئُ يجد المتعة في الكتب.'
        ],
        quiz: [
            { q: "كيف وصف الكاتب السماء؟", options: ["غائمة", "صافية", "ماطرة"], correct: 1 },
            { q: "ماذا يجد القارئ في الكتب؟", options: ["الملل", "المتعة", "الحيرة"], correct: 1 }
        ]
    },
    { 
        id: 'b3', level: 'L2', title: 'قبل وساطير', 
        cover: 'https://picsum.photos/seed/b3/160/210', 
        text: [
            'اجتمع الأطفالُ حولَ الجدِّ ليستمعوا إلى الحكايات.',
            'من يستمعْ بتأنٍّ يفهمْ العبرةَ ويشاركْ رفاقَه.'
        ],
        quiz: [
            { q: "لماذا اجتمع الأطفال حول الجد؟", options: ["للعب", "ليستمعوا للحكايات", "للذهاب إلى المدرسة"], correct: 1 }
        ]
    }
];

// ===== Utils =====
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ✅ إصلاح مهم: قراءة آمنة من localStorage حتى لو كانت البيانات تالفة
const readJSON = (k, def) => {
    try {
        const raw = localStorage.getItem(k);
        if (!raw) return def;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('readJSON error for', k, e);
        // إذا كانت القيمة تالفة نمسحها حتى لا تكرّر الخطأ
        localStorage.removeItem(k);
        return def;
    }
};

const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = (p = 'U') => p + Math.random().toString(36).slice(2, 8);

// ===== Avatar (موحّد) =====
function setUnifiedAvatar(role){
    const avatar = document.getElementById("userAvatar");
    if (!avatar) return;
    
    avatar.onerror = () => {
        avatar.src = "./img/avatar-student-omani.png";
    };
    
    avatar.src = role === "teacher" ? "./img/avatar-teacher-omani.png" : "./img/avatar-student-omani.png";
}

// ============================================ //
// 🔔 إنشاء إشعار
async function createNotification({ studentId, title, message, icon = "🔔", type = "", refId = "" }) {
    if (!window.db || !studentId) return;
    try {
        await setDoc(doc(collection(window.db, "notifications")), {
            studentId,
            title,
            message,
            icon,
            type,
            refId,
            isRead: false,
            createdAt: Date.now()
        });
    } catch (e) {
        console.error("❌ فشل إنشاء الإشعار:", e);
    }
}

// جعل الإشعارات مقروءة
async function markNotificationsAsRead() {
    const current = readJSON(LS.CURRENT, null);
    if (!current || !window.db) return;

    const qNotify = query(
        collection(window.db, "notifications"),
        where("studentId", "==", current.email),
        where("isRead", "==", false)
    );

    const snap = await getDocs(qNotify);
    snap.forEach(async (docSnap) => {
        await updateDoc(doc(window.db, "notifications", docSnap.id), {
            isRead: true,
            readAt: Date.now()
        });
    });
}

// الاستماع المباشر للإشعارات (للطلاب)
function listenToNotifications(studentEmail) {
    if (!window.db || !studentEmail) return;

    const qNotify = query(
        collection(window.db, "notifications"),
        where("studentId", "==", studentEmail),
        orderBy("createdAt", "desc")
    );

    onSnapshot(qNotify, (snap) => {
        const list = $('#notifyList');
        const badge = $('#notifyBadge');
        if (!list) return;

        let html = '';
        let unreadCount = 0;

        snap.forEach(d => {
            const n = d.data();
            if (!n.isRead) unreadCount++;
            html += `
                <div class="notify-item ${n.isRead ? '' : 'unread'}">
                    <span class="notify-icon">${n.icon}</span>
                    <div class="notify-body">
                        <div class="notify-title">${n.title}</div>
                        <div class="notify-msg">${n.message}</div>
                    </div>
                </div>`;
        });

        list.innerHTML = html || '<div style="padding:10px; text-align:center; color:#999;">لا توجد تنبيهات</div>';
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    });
}

// ✅ تحديث: مزامنة الكتب من السحابة للفصل
export async function syncBooks(classId) {
    if (!classId || !window.db) return;
    try {
        const snap = await getDocs(collection(window.db, "classes", classId, "books"));
        const cloudBooks = [];
        snap.forEach(d => cloudBooks.push(d.data()));
        
        // تفريغ المصفوفة الحالية وإضافة الكتب السحابية
        BOOKS.length = 0;
        cloudBooks.forEach(b => BOOKS.push(b));
        console.log("🔄 تمت مزامنة الكتب بنجاح");
    } catch (e) {
        console.error("❌ فشل مزامنة الكتب:", e);
    }
}

// ✅ حفظ حالة الطالب في واجب معين (Firestore)
async function saveAssignmentAnswerToFirestore(classId, assignId, studentId, answerData) {
    if (!window.db) return;
    try {
        const ansRef = doc(window.db, "classes", classId, "assignments", assignId, "answers", studentId);
        await setDoc(ansRef, answerData, { merge: true });
        
        // تحديث ملخص بسيط في الواجب نفسه
        const assignRef = doc(window.db, "classes", classId, "assignments", assignId);
        const snap = await getDoc(assignRef);
        if (snap.exists()) {
            const data = snap.data();
            data.perStudent = data.perStudent || {};
            data.perStudent[studentId] = {
                ...(data.perStudent[studentId] || {}),
                ...answerData
            };
            await setDoc(assignRef, data, { merge: true });
        }
    } catch (e) {
        console.error("❌ خطأ في حفظ الإجابة:", e);
    }
}

// ============================================ //
function toast(m) {
    const t = $('#toast');
    if (!t) { alert(m); return; }
    t.textContent = m;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================ //
function loginUser(e) {
    e.preventDefault();
    const email = $('#loginEmail').value.trim().toLowerCase();
    const pass = $('#loginPass').value;

    const users = readJSON(LS.USERS, []);
    const user = users.find(u => u.email === email && u.pass === pass);

    if (!user) {
        toast('بيانات الدخول غير صحيحة');
        return;
    }

    // حفظ الجلسة
    writeJSON(LS.CURRENT, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        classId: user.classId || null
    });

    startApp();
}

function showOnly(id) {
    $$('.tab-content').forEach(c => c.classList.add('hidden'));
    $(id)?.classList.remove('hidden');

    // تحديث الأزرار في الـ Rail
    $$('#navLinks button').forEach(b => {
        b.classList.toggle('active', b.dataset.target === id);
    });
}

function buildNav(role) {
    const nav = $('#navLinks');
    if (!nav) return;
    nav.innerHTML = '';

    const items = role === 'teacher' 
        ? [['#tab-teacher', 'لوحة المعلم'], ['#tab-library', 'المكتبة']]
        : [['#tab-home', 'الرئيسية'], ['#tab-library', 'المكتبة']];

    items.forEach(([target, label]) => {
        const b = document.createElement('button');
        b.className = 'pill';
        b.dataset.target = target;
        b.textContent = label;
        b.onclick = () => showOnly(target);
        nav.appendChild(b);
    });
}

// ============================================ //
// القارئ
function openReader(book) {
    currentBook = book;
    readingStartAt = Date.now();
    $('#appShell').classList.add('hidden');
    $('#readerView').classList.remove('hidden');

    const host = document.getElementById("storyContent");
    if (host) {
        host.innerHTML = "";
        book.text.forEach(paragraph => {
            const p = document.createElement("p");
            p.textContent = paragraph;
            host.appendChild(p);
        });
    }
}

function closeReader() {
    if (readingStartAt) {
        const diff = Math.floor((Date.now() - readingStartAt) / 60000);
        updateReadStats(currentBook?.id, diff);
    }
    $('#readerView').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    stopRecording();
    currentBook = null;
}

// 🎙 تسجيل الصوت
let mediaRecorder;
let audioChunks = [];

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
            toast("تم حفظ تسجيلك الصوتي بنجاح");
        };
        mediaRecorder.start();
        $('#recBtn').textContent = "⏹ إيقاف التسجيل";
        $('#recBtn').classList.add('recording');
    } catch (e) {
        toast("يرجى السماح بالوصول للميكروفون");
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        $('#recBtn').textContent = "🎙 تسجيل صوتي";
        $('#recBtn').classList.remove('recording');
    }
}

// ✅ زر الاختبار (داخل القارئ)
$('#quizBtn')?.addEventListener('click', () => {
    if (!currentBook || !currentBook.quiz) {
        toast("لا توجد أنشطة لهذه القصة");
        return;
    }

    const box = $('#quizQuestions');
    if (!box) return;
    box.innerHTML = '';

    currentBook.quiz.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = 'quiz-item';
        const optsHtml = q.options.map((opt, idx) => 
            `<label><input type="radio" name="q${i}" value="${idx}"> ${opt}</label>`
        ).join('');
        
        div.innerHTML = `<p><b>${i + 1}.</b> ${q.q}</p><div class="quiz-options">${optsHtml}</div>`;
        box.appendChild(div);
    });

    // إظهار نافذة الاختبار
    $('#modalQuiz').classList.remove('hidden');

    // ✅ ربط زر الإنهاء بعد ظهور المودال
    setTimeout(() => {
        const btn = document.getElementById("submitQuiz");
        if (!btn) return;
        btn.onclick = () => {
            if (!currentBook || !currentBook.quiz) {
                toast("لا توجد أنشطة لهذه القصة");
                return;
            }
            let score = 0;
            currentBook.quiz.forEach((q, i) => {
                const selected = document.querySelector(`input[name="q${i}"]:checked`);
                if (selected && Number(selected.value) === q.correct) {
                    score++;
                }
            });

            // تسجيل النشاط
            addActivity();
            
            // إغلاق النافذة
            document.getElementById("modalQuiz").classList.add('hidden');
            toast(`✓ تم إنهاء النشاط. نتيجتك: ${score}/${currentBook.quiz.length}`);
        };
    }, 0);
});

// 🔔 فتح / إغلاق لوحة الإشعارات
document.getElementById("notifyBtn")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const panel = document.getElementById("notifyPanel");
    panel?.classList.toggle("hidden");

    // ✅ إذا فُتحت اللوحة → اعتبر الإشعارات مقروءة
    if (!panel?.classList.contains("hidden")) {
        markNotificationsAsRead();
    }
});

// إغلاقها عند الضغط خارجها
document.addEventListener("click", () => {
    document.getElementById("notifyPanel")?.classList.add("hidden");
});

// ============================================ //
function confirmLogout() {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        localStorage.removeItem(LS.CURRENT);
        location.reload();
    }
}

// ✅ تهيئة التطبيق
function initApp() {
    $('#loginBtn')?.addEventListener('click', loginUser);
    $('#logoutBtn')?.addEventListener('click', confirmLogout);
    $('#closeReaderBtn')?.addEventListener('click', closeReader);
    $('#recBtn')?.addEventListener('click', () => {
        if (mediaRecorder?.state === 'recording') stopRecording();
        else startRecording();
    });
}

async function startApp() {
    const current = readJSON(LS.CURRENT, null);
    if (!current) {
        $('#authView').classList.remove('hidden');
        $('#appShell').classList.add('hidden');
        return;
    }

    $('#authView').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    $('#userName').textContent = current.name;
    setUnifiedAvatar(current.role);
    
    buildNav(current.role);

    if (current.role === 'teacher') {
        showOnly('#tab-teacher');
        renderTeacherDashboard();
    } else {
        showOnly('#tab-home');
        listenToNotifications(current.email);
        renderStudentDashboard();
    }

    // مزامنة الكتب إذا كان هناك فصل
    if (current.classId) {
        await syncBooks(current.classId);
    }
    renderLibrary();
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    startApp();
});
