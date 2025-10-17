<script>
/* === IMPORTANT ===
   Include Firebase compat scripts in your HTML pages BEFORE this app.js:
   <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js"></script>
   Then include firebase-config.js (which defines firebaseConfig) and then this app.js
*/

/* Initialize Firebase */
if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- Booking logic used by book.html ---------- */
async function bookAppointment(e) {
  if (e) e.preventDefault();
  const date = document.getElementById('appoint-date').value;
  const time = document.getElementById('appoint-time').value;
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();

  if (!date || !time || !name || !phone) {
    alert('सभी फ़ील्ड भरें।');
    return;
  }

  try {
    await db.collection('appointments').add({
      date,            // YYYY-MM-DD
      time,            // HH:MM (depending on input type=time)
      name,
      phone,
      status: 'Booked',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Appointment booked successfully!');
    document.getElementById('book-form').reset();
  } catch (err) {
    console.error(err);
    alert('Error booking appointment: ' + err.message);
  }
}

/* ---------- Admin Auth & Panel logic used by admin.html ---------- */

/* Sign up not required for admin typically — we will create admin user via Firebase Auth or sign up here */
async function adminSignUp(email, password) {
  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    alert('Admin user created. Now add admin in Firestore admins collection with this UID: ' + userCred.user.uid);
  } catch (err) {
    alert('SignUp error: ' + err.message);
  }
}

async function adminSignIn(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    alert('SignIn error: ' + err.message);
  }
}

function adminSignOut() {
  auth.signOut();
}

/* Check if logged in user is admin
   Admins collection must have documents with ID = auth.uid (create manually from Console)
*/
async function isAdmin(uid) {
  if (!uid) return false;
  const doc = await db.collection('admins').doc(uid).get();
  return doc.exists;
}

/* Fetch appointments with optional filters */
async function fetchAppointments({ dateFilter = null, statusFilter = null } = {}) {
  let query = db.collection('appointments').orderBy('date').orderBy('time');
  if (dateFilter) {
    query = query.where('date', '==', dateFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }
  const snap = await query.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* Render appointments into table element with id 'appointments-table-body' */
function renderAppointments(list) {
  const tbody = document.getElementById('appointments-table-body');
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="center small">No appointments found</td></tr>';
    return;
  }
  list.forEach(ap => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ap.name}</td>
      <td>${ap.phone}</td>
      <td>${ap.date}</td>
      <td>${ap.time}</td>
      <td>
        <select data-id="${ap.id}" class="status-select">
          <option ${ap.status==='Booked'?'selected':''}>Booked</option>
          <option ${ap.status==='Arrived'?'selected':''}>Arrived</option>
          <option ${ap.status==='Canceled'?'selected':''}>Canceled</option>
        </select>
      </td>
      <td><button data-id="${ap.id}" class="btn btn-delete">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  // attach listeners
  document.querySelectorAll('.status-select').forEach(s => {
    s.addEventListener('change', async (ev) => {
      const id = ev.target.getAttribute('data-id');
      const newStatus = ev.target.value;
      try {
        await db.collection('appointments').doc(id).update({ status: newStatus });
        // optionally show feedback
      } catch (err) { alert('Update failed: ' + err.message); }
    });
  });

  document.querySelectorAll('.btn-delete').forEach(b => {
    b.addEventListener('click', async (ev) => {
      const id = ev.target.getAttribute('data-id');
      if (!confirm('Remove this appointment?')) return;
      try {
        await db.collection('appointments').doc(id).delete();
        ev.target.closest('tr').remove();
      } catch (err) { alert('Delete failed: ' + err.message); }
    });
  });
}

/* Hook up admin UI controls (called on admin.html load) */
function initAdminPanel() {
  const signInForm = document.getElementById('admin-login-form');
  if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value;
      const password = document.getElementById('admin-password').value;
      await adminSignIn(email, password);
    });
  }

  document.getElementById('admin-logout')?.addEventListener('click', adminSignOut);

  document.getElementById('filter-btn')?.addEventListener('click', async () => {
    const date = document.getElementById('filter-date').value;
    const status = document.getElementById('filter-status').value;
    const list = await fetchAppointments({ dateFilter: date || null, statusFilter: status || 'all' });
    renderAppointments(list);
    document.getElementById('count-display').innerText = list.length;
  });

  // initial load: fetch all
  document.getElementById('filter-btn')?.click();
}

/* Auth state change handling */
auth.onAuthStateChanged(async (user) => {
  const loginArea = document.getElementById('admin-login-area');
  const panelArea = document.getElementById('admin-panel-area');
  if (user) {
    const admin = await isAdmin(user.uid);
    if (!admin) {
      alert('This account is not registered as admin. Contact owner to add you in admins collection.');
      await auth.signOut();
      return;
    }
    // show panel
    if (loginArea) loginArea.style.display = 'none';
    if (panelArea) panelArea.style.display = 'block';
    initAdminPanel();
  } else {
    if (loginArea) loginArea.style.display = 'block';
    if (panelArea) panelArea.style.display = 'none';
  }
});

/* Utility: show shop info on index page (hardcoded for now) */
function loadShopInfo() {
  const shopNameEl = document.getElementById('shop-name');
  if (shopNameEl) shopNameEl.innerText = 'Classic Cuts Barber Shop';
  // services: simple listing
  const servicesList = [
    { name:'Regular Haircut', duration:'30 min', price:'₹200' },
    { name:'Styling', duration:'25 min', price:'₹250' },
    { name:'Beard Trim', duration:'15 min', price:'120' },
    { name:'Shave', duration:'20 min', price:'₹150' }
  ];
  const svcContainer = document.getElementById('services-container');
  if (svcContainer) {
    servicesList.forEach(s=>{
      const div = document.createElement('div');
      div.className='card';
      div.innerHTML = `<h3>${s.name}</h3><p class="small">${s.duration} • ${s.price}</p>`;
      svcContainer.appendChild(div);
    });
  }
}

/* call loadShopInfo if exists */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('shop-name')) loadShopInfo();
  if (document.getElementById('book-form')) {
    document.getElementById('book-form').addEventListener('submit', bookAppointment);
  }
});
</script>
