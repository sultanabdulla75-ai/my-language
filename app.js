// منصة لغتي - ملف app.js
// ------------------------------------------------------

// ===== متغير عام للقصة الحالية في القارئ =====
let currentBook = null;

// وقت بدء القراءة الحالي (بالمللي ثانية)
let readingStartAt = null;
let readingStartTime = null;
let hasInteractedWithStory = false;

// ===== Firestore Imports =====
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  updateDoc,

  // 🔔 إشعارات (إضافة مطلوبة)
  query,
  where,
  orderBy,
  onSnapshot
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
    id: 'b1',
    level: 'L1',
    title: 'الصداقة',
    cover: 'https://picsum.photos/seed/b1/160/210',
    text: [
      'في يومٍ جميلٍ التقى سالمٌ وصديقُه راشدٌ في الحديقة.',
      'تحدّثا عن معنى الصداقة، ووعدا أن يساعد كلُّ واحدٍ منهما الآخر.'
    ],
    quiz: [
      {
        q: "أين التقى سالم وراشد؟",
        options: ["في السوق", "في الحديقة", "في المدرسة"],
        correct: 1
      },
      {
        q: "ماذا وعد الصديقان؟",
        options: ["ألا يتكلما", "أن يساعد كل واحد الآخر", "أن يذهبا للبيت"],
        correct: 1
      }
    ]
  },
  {
    id: 'b2',
    level: 'L1',
    title: 'جمل اسميّة',
    cover: 'https://picsum.photos/seed/b2/160/210',
    text: [
      'السماءُ صافيةٌ، والنسيمُ عليلٌ.',
      'المعرفةُ نورٌ، والقارئُ يجد المتعة في الكتب.'
    ],
    quiz: [
      {
        q: "كيف وصف الكاتب السماء؟",
        options: ["غائمة", "صافية", "ماطرة"],
        correct: 1
      },
      {
        q: "ماذا يجد القارئ في الكتب؟",
        options: ["الملل", "المتعة", "الحيرة"],
        correct: 1
      }
    ]
  },
  {
    id: 'b3',
    level: 'L2',
    title: 'قبل وساطير',
    cover: 'https://picsum.photos/seed/b3/160/210',
    text: [
      'اجتمع الأطفالُ حولَ الجدِّ ليستمعوا إلى الحكايات.',
      'من يستمعْ بتأنٍّ يفهمْ العبرةَ ويشاركْ رفاقَه.'
    ],
    quiz: [
      {
        q: "لماذا اجتمع الأطفال حول الجد؟",
        options: ["للعب", "ليستمعوا للحكايات", "للذهاب إلى المدرسة"],
        correct: 1
      }
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

  avatar.src = role === "teacher"
    ? "./img/avatar-teacher-omani.png"
    : "./img/avatar-student-omani.png";
}

// ============================================
// 🔔 إنشاء إشعار
// ============================================
async function createNotification({
  studentId,
  title,
  message,
  icon = "🔔",
  type = "",
  refId = ""
}) {
  if (!window.db || !studentId) return;

  try {
    await setDoc(
      doc(collection(window.db, "notifications")),
      {
        studentId,
        title,
        message,
        icon,
        type,
        refId,
        isRead: false,
        createdAt: Date.now()
      }
    );
  } catch (e) {
    console.error("⚠ فشل إنشاء الإشعار:", e);
  }
}

function toast(msg) {
  alert(msg);
}

// ------------------------------------------------------
// Firestore Helpers (كتب + واجبات + طلاب)
// ------------------------------------------------------

// 📌 تحميل الطلاب من Firestore للصف الخاص بالمعلم
export async function getTeacherStudents(classId) {
  const students = [];
  const stuSnap = await getDocs(
    collection(window.db, "classes", classId, "students")
  );

  stuSnap.forEach(docSnap => {
    const d = docSnap.data();
    students.push({
      id: d.email,
      name: d.name || d.email,
      email: d.email,
      className: d.className || ''
    });
  });

  return students;
}

// 🔹 مزامنة القصص (محلي ↔ سحابة)
export async function syncBooks(classId) {
  if (!classId) {
    console.error("❌ syncBooks: classId مفقود — تم إيقاف المزامنة.");
    return;
  }

  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  if (!window.db) {
    console.error("❌ syncBooks: window.db غير مهيأ.");
    return;
  }

  let snap;
  try {
    snap = await getDocs(
      collection(window.db, "classes", classId, "books")
    );
  } catch (err) {
    console.error("🔥 خطأ أثناء جلب القصص:", err);
    return;
  }

  const cloudBooks = [];
  snap.forEach(d => cloudBooks.push(d.data()));

  // الطالب: تحميل فقط
  if (current.role === "student") {
    BOOKS.length = 0;
    cloudBooks.forEach(b => BOOKS.push(b));
    console.log("📥 الطالب حمّل القصص:", BOOKS.length);
    return;
  }

  // المعلم: مزامنة (إن احتجت لها)
  cloudBooks.forEach(b => {
    if (!BOOKS.some(x => x.id === b.id)) {
      BOOKS.push(b);
    }
  });

  for (const b of BOOKS) {
    const exists = cloudBooks.some(x => x.id === b.id);
    if (!exists) {
      await setDoc(
        doc(window.db, "classes", classId, "books", b.id),
        b
      );
      console.log("⬆️ رفع قصة جديدة:", b.title);
    }
  }

  console.log("🔄 تمت المزامنة بنجاح");
}

// 🔹 حفظ حل الطالب في Firestore (answers + perStudent في assignment)
async function saveAssignmentAnswerToFirestore(
  classId,
  assignId,
  studentId,
  answerData
) {
  if (!window.db) return;

  try {
    const ansRef = doc(
      window.db,
      "classes",
      classId,
      "assignments",
      assignId,
      "answers",
      studentId
    );

    await setDoc(ansRef, answerData, { merge: true });

    // تحديث الحقل في وثيقة الواجب نفسها (perStudent)
    const assignRef = doc(
      window.db,
      "classes",
      classId,
      "assignments",
      assignId
    );

    const snap = await getDoc(assignRef);
    if (!snap.exists()) {
      console.error("❌ الواجب غير موجود!");
      return;
    }

    const data = snap.data();
    data.perStudent = data.perStudent || {};
    data.perStudent[studentId] = {
      ...(data.perStudent[studentId] || {}),
      ...answerData
    };

    await setDoc(assignRef, data, { merge: true });

    console.log("✔ تم حفظ إجابة الطالب في Firestore");
  } catch (e) {
    console.error("❌ خطأ في حفظ الواجب في Firestore:", e);
    toast("⚠ خطأ في حفظ الإجابة");
  }
}

// 🔹 تحميل القصص من Firestore
async function loadBooksFromFirestore(classId) {
  if (!window.db) {
    console.warn("⚠ لا يوجد window.db، سيتم استخدام القصص المحلية.");
    return BOOKS;
  }

  const snap = await getDocs(
    collection(window.db, "classes", classId, "books")
  );

  const arr = [];
  snap.forEach(d => arr.push(d.data()));

  if (arr.length === 0) {
    console.warn("⚠ لا توجد قصص في السحابة. سيتم استخدام القصص المحلية.");
    return BOOKS;
  }

  return arr;
}

// 🔹 استبدال محتوى BOOKS بقصص السحابة عند الحاجة
async function syncBooksWithFirestore(classId) {
  const books = await loadBooksFromFirestore(classId);
  if (books && books.length > 0) {
    BOOKS.length = 0;
    books.forEach(b => BOOKS.push(b));
  }
}

// 🔹 تحميل إجابات الطالب من Firestore ودمجها في الواجبات المحلية
export async function loadStudentAnswersFromFirestore(
  classId,
  studentId
) {
  if (!window.db) return;

  const snap = await getDocs(
    collection(window.db, "classes", classId, "assignments")
  );

  const localAssignments = getAssignments();

  for (const docA of snap.docs) {
    const assignId = docA.id;

    const ansRef = doc(
      window.db,
      "classes",
      classId,
      "assignments",
      assignId,
      "answers",
      studentId
    );

    const ansSnap = await getDoc(ansRef);

    if (ansSnap.exists()) {
      const data = ansSnap.data();
      let idx = localAssignments.findIndex(x => x.id === assignId);

      if (idx !== -1) {
        localAssignments[idx].perStudent =
          localAssignments[idx].perStudent || {};
        localAssignments[idx].perStudent[studentId] = {
          ...localAssignments[idx].perStudent[studentId],
          ...data
        };
      }
    }
  }

  setAssignments(localAssignments);
}

// ===============================
// 🔥 مزامنة الواجبات من Firestore إلى الذاكرة المحلية
// ===============================
export async function syncAssignmentsFromFirestore(classId) {
  if (!window.db) return;

  const snap = await getDocs(
    collection(window.db, "classes", classId, "assignments")
  );

  const list = [];

  snap.forEach(docA => {
    const data = docA.data();
    list.push({
      id: docA.id,
      title: data.title || "",
      desc: data.desc || "",
      level: data.level || "",
      due: data.due || "",
      teacherId: data.teacherId || "",
      classId: classId,
      studentIds: data.studentIds || [],
      perStudent: data.perStudent || {}
    });
  });

  setAssignments(list);
  console.log("✔ تمت مزامنة الواجبات من Firestore");
}

// 🔹 إيجاد classId للطالب من Firestore
async function findClassIdForStudent(studentEmail) {
  if (!window.db || !studentEmail) return null;

  try {
    const classesSnap = await getDocs(collection(window.db, "classes"));

    for (const c of classesSnap.docs) {
      const stuRef = doc(
        window.db,
        "classes",
        c.id,
        "students",
        studentEmail
      );

      const stuSnap = await getDoc(stuRef);
      if (stuSnap.exists()) {
        return c.id;
      }
    }
  } catch (e) {
    console.error("❌ خطأ في findClassIdForStudent:", e);
  }

  return null;
}

// ------------------------------------------------------
// التنقل والتبويبات + لوحة الجانب الأيمن
// ------------------------------------------------------
function showOnly(selector) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#readerView')?.classList.add('hidden');

  const el = document.querySelector(selector);
  if (el) el.classList.remove('hidden');

  $$('#navLinks .pill').forEach(p => {
    if (p.dataset.target === selector) p.classList.add('active');
    else p.classList.remove('active');
  });

  if (selector === '#tab-teacher') {
    renderTeacherDashboard();
    renderAvgProgressChart();
  }
}

function buildNav(role) {
  const nav = document.querySelector('#navLinks');
  if (!nav) return;

  nav.innerHTML = '';

  const items = role === 'teacher'
    ? [
        ['#tab-teacher', 'لوحة المعلم'],
        ['#tab-teacher-students', 'الطلاب'],
        ['#tab-teacher-assignments', 'الواجبات'],
        ['#tab-library', 'المكتبة'],
        ['#tab-reports', 'التقارير']
      ]
    : [
        ['#tab-home', 'الرئيسية'],
        ['#tab-levels', 'المستويات'],
        ['#tab-library', 'المكتبة'],
        ['#tab-assign', 'واجباتي'],
        ['#tab-reports', 'تقاريري']
      ];

  items.forEach(([target, label, i]) => {
    const b = document.createElement('button');
    b.className = 'pill' + (i === 0 ? ' active' : '');
    b.dataset.target = target;
    b.textContent = label;
    b.onclick = () => showOnly(target);
    nav.appendChild(b);
  });

  showOnly(items[0][0]);
}

function updateRail() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  if (current.role === 'teacher') {
    renderTeacherDashboard();
    $('#railBooks').textContent = 0;
    $('#railTime').textContent = '0 د';
    $('#railBadges').textContent = 0;
    $('#railAvg').textContent = '0 د';
    $('#railLastBook').textContent = '—';
    $('#railActs').textContent = 0;
  }
}

function updateRailFromStats(s) {
  const booksBox = document.getElementById("railBooks");
  if (booksBox) booksBox.textContent = s.reads || 0;

  const timeBox = document.getElementById("railTime");
  if (timeBox) timeBox.textContent = (s.minutes || 0) + " د";

  const lastBox = document.getElementById("railLastBook");
  if (lastBox) lastBox.textContent = s.lastBook || "—";

  const actBox = document.getElementById("railActs");
  if (actBox) actBox.textContent = s.activities || 0;

  const avgBox = document.getElementById("railAvg");
  if (avgBox) {
    const avg = s.reads > 0 ? (s.minutes / s.reads).toFixed(1) : 0;
    avgBox.textContent = avg + " د";
  }
}

// ------------------------------------------------------
// Boot
// ------------------------------------------------------
async function startApp() {
  let current = JSON.parse(localStorage.getItem("arp.current") || "null");
  console.log("DEBUG CURRENT =", current);

  if (!current || !current.email) {
    localStorage.removeItem("arp.current");
    $('#authView').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    return;
  }

  if (current.role === 'teacher') {
    $$('.only-teacher').forEach(btn => btn.style.display = 'inline-block');
  } else {
    $$('.only-teacher').forEach(btn => btn.style.display = 'none');
  }

  $('#helloName').textContent = 'مرحبًا ' + current.name + '!';
  $('#userName').textContent = current.name;
  $('#userRoleLabel').textContent =
    current.role === 'teacher' ? 'معلم' : 'طالب';

  setUnifiedAvatar(current.role);

  $('#authView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#readerView').classList.add('hidden');

  buildNav(current.role);
  renderLevels();
  renderBooks('ALL');
  renderStudentAssignments('required');

  if (current.role === 'student') {
    let classId = current.classId || null;

    if (!classId) {
      classId = await findClassIdForStudent(current.email || current.id);
    }

    if (classId) {
      writeJSON(LS.CURRENT, { ...current, classId });
      syncAssignmentsFromFirestore(classId);
      loadStudentAnswersFromFirestore(classId, current.id);
      syncBooksWithFirestore(classId);
    } else {
      console.warn("⚠️ لم يتم العثور على فصل مرتبط بهذا الطالب.");
    }

    listenToReadingStats();
  }

  if (current.role === 'teacher') {
    let classId = current.classId || null;

    if (!classId) {
      const c = getTeacherClass(current.id);
      if (c) classId = c.id;
    }

    if (classId) {
      await syncAssignmentsFromFirestore(classId);
      await syncBooksWithFirestore(classId);
    }
  }

  await renderTeacherStudents();
  await renderTeacherView();

  listenToNotifications();
}

window.startApp = startApp;

// ------------------------------------------------------
// DOM Ready
// ------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  $$('[data-auth]').forEach(btn => btn.onclick = () => {
    $$('[data-auth]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.auth === 'login') {
      $('#loginForm').classList.remove('hidden');
      $('#regForm').classList.add('hidden');
    } else {
      $('#regForm').classList.remove('hidden');
      $('#loginForm').classList.add('hidden');
    }
  });

  $('#loginForm').addEventListener('submit', loginUser);
  $('#regForm').addEventListener('submit', registerUser);

  $('#searchBooks')?.addEventListener('input', () => renderBooks('ALL'));

  $('#logoutBtn')?.addEventListener('click', confirmLogout);

  startApp();
});
