/* Tbose Tutors Admin Control Panel Logic */

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const loginView = document.getElementById('admin-login-view');
    const dashboardView = document.getElementById('admin-dashboard-view');
    const passwordInput = document.getElementById('admin-password-input');
    const loginSubmit = document.getElementById('admin-login-submit');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('admin-logout-btn');

    // Sidebar navigation
    const tabs = document.querySelectorAll('.admin-tab');
    const panels = document.querySelectorAll('.admin-tab-panel');

    // Database Roster Elements
    const attendeesTableBody = document.getElementById('attendees-table-body');
    const dbSearchInput = document.getElementById('db-search-input');
    const filterModeSelect = document.getElementById('filter-mode-select');
    const filterPlanSelect = document.getElementById('filter-plan-select');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    // Gate scanner validation elements
    const scannerInput = document.getElementById('scanner-input');
    const scannerSubmit = document.getElementById('scanner-submit');
    const scannerResultBox = document.getElementById('scanner-result-box');

    // Resource manager elements
    const uploadForm = document.getElementById('resource-upload-form');
    const resourceFile = document.getElementById('resource-file');
    const dropzoneArea = document.getElementById('dropzone-area');
    const fileNameSelected = document.getElementById('file-name-selected');
    const adminResourcesList = document.getElementById('admin-resources-list');
    const uploadSubmitBtn = document.getElementById('upload-submit-btn');

    // Announcements & Messaging Elements
    const announcementForm = document.getElementById('announcement-form');
    const announcementTitle = document.getElementById('announcement-title');
    const announcementTarget = document.getElementById('announcement-target');
    const announcementContent = document.getElementById('announcement-content');
    const announcementSendEmail = document.getElementById('announcement-send-email');
    const adminAnnouncementsList = document.getElementById('admin-announcements-list');
    const announcementSubmitBtn = document.getElementById('announcement-submit-btn');

    // Announcement Detail Modal Elements
    const noticeModal = document.getElementById('notice-modal');
    const noticeModalCloseBtn = document.getElementById('notice-modal-close-btn');
    const noticeModalTitle = document.getElementById('notice-modal-title');
    const noticeModalMeta = document.getElementById('notice-modal-meta');
    const noticeModalContent = document.getElementById('notice-modal-content');
    const noticeModalEmailStatus = document.getElementById('notice-modal-email-status');
    const noticeModalDeleteBtn = document.getElementById('notice-modal-delete-btn');

    const seeMoreAnnouncementsContainer = document.getElementById('see-more-announcements-container');
    const seeMoreAnnouncementsBtn = document.getElementById('see-more-announcements-btn');

    let cachedAttendees = [];
    let cachedAnnouncements = [];
    let showAllAnnouncements = false;
    let adminPassword = sessionStorage.getItem('adminPass') || '';

    // 2. Lockscreen Access Control
    if (adminPassword) {
        verifyAndLoadDashboard();
    }

    loginSubmit.addEventListener('click', () => {
        const password = passwordInput.value.trim();
        if (!password) {
            loginError.textContent = 'Please enter a password.';
            loginError.style.display = 'block';
            return;
        }
        adminPassword = password;
        verifyAndLoadDashboard();
    });

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginSubmit.click();
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminPass');
        adminPassword = '';
        dashboardView.style.display = 'none';
        logoutBtn.style.display = 'none';
        loginView.style.display = 'flex';
        passwordInput.value = '';
    });

    async function verifyAndLoadDashboard() {
        loginError.style.display = 'none';
        try {
            // Check credentials by calling attendees endpoint
            const res = await fetch('/api/attendees', {
                headers: { 'Authorization': adminPassword }
            });

            if (!res.ok) {
                const data = await res.json();
                loginError.textContent = data.error || 'Invalid credentials.';
                loginError.style.display = 'block';
                sessionStorage.removeItem('adminPass');
                return;
            }

            const list = await res.json();
            cachedAttendees = list;
            sessionStorage.setItem('adminPass', adminPassword);

            // Switch views
            loginView.style.display = 'none';
            dashboardView.style.display = 'flex';
            logoutBtn.style.display = 'block';

            // Load panel data
            renderAttendeesTable(cachedAttendees);
            loadResourcesList();
            loadAnnouncementsList();
        } catch (err) {
            console.error(err);
            loginError.textContent = 'Network connection failed.';
            loginError.style.display = 'block';
        }
    }

    // 3. Tab Switches Lifecycle
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            panels.forEach(panel => {
                if (panel.id === `panel-${targetTab}`) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });

            // Reload database table when opening database tab
            if (targetTab === 'registrants') {
                verifyAndLoadDashboard();
            } else if (targetTab === 'messaging') {
                loadAnnouncementsList();
            }
        });
    });

    // 4. Registrants Database Rendering & Filtering
    function renderAttendeesTable(attendees) {
        attendeesTableBody.innerHTML = '';
        
        if (attendees.length === 0) {
            attendeesTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 20px;">No students registered.</td></tr>`;
            return;
        }

        attendees.forEach(student => {
            const row = document.createElement('tr');

            const regDate = new Date(student.registeredAt).toLocaleDateString('en-NG', {
                year: 'numeric', month: 'short', day: 'numeric'
            });

            const planBadge = student.paymentType === 'full' ? 'status-badge paid' : 'status-badge part';
            const modeBadge = student.attendanceMode === 'physical' ? 'attendance-badge' : 'attendance-badge';

            row.innerHTML = `
                <td style="font-family: monospace; font-weight: bold; color: var(--primary-color);">${student.ticketId}</td>
                <td style="font-weight: 600;">${student.fullName}</td>
                <td>${student.phone}</td>
                <td>${student.email}</td>
                <td><span class="attendance-badge" style="border: 1px solid var(--border-color);">${student.attendanceMode.toUpperCase()}</span></td>
                <td><span class="${planBadge}">${student.paymentType.toUpperCase()}</span></td>
                <td style="font-weight: bold;">₦${student.amountPaid.toLocaleString()}</td>
                <td style="${student.balance > 0 ? 'color: var(--error-color); font-weight: bold;' : 'color: var(--success-color); font-weight: bold;'}">
                    ₦${student.balance.toLocaleString()}
                </td>
                <td style="font-size: 0.8rem; color: var(--text-secondary);">${regDate}</td>
            `;
            attendeesTableBody.appendChild(row);
        });
    }

    // Filters Search Inputs Listener
    function applyFilters() {
        const query = dbSearchInput.value.toLowerCase().trim();
        const modeFilter = filterModeSelect.value;
        const planFilter = filterPlanSelect.value;

        const filtered = cachedAttendees.filter(student => {
            const matchesSearch = student.fullName.toLowerCase().includes(query) || 
                                  student.phone.includes(query) || 
                                  student.ticketId.toLowerCase().includes(query) ||
                                  student.email.toLowerCase().includes(query);

            const matchesMode = !modeFilter || student.attendanceMode === modeFilter;
            const matchesPlan = !planFilter || student.paymentType === planFilter;

            return matchesSearch && matchesMode && matchesPlan;
        });

        renderAttendeesTable(filtered);
    }

    dbSearchInput.addEventListener('input', applyFilters);
    filterModeSelect.addEventListener('change', applyFilters);
    filterPlanSelect.addEventListener('change', applyFilters);

    // CSV Roster Export
    exportCsvBtn.addEventListener('click', () => {
        if (cachedAttendees.length === 0) {
            alert('No records available to export.');
            return;
        }

        const headers = ['Ticket ID', 'Full Name', 'Phone', 'Email', 'Attendance Mode', 'Payment Plan', 'Amount Paid (NGN)', 'Balance (NGN)', 'Registered At'];
        
        const rows = cachedAttendees.map(student => [
            student.ticketId,
            student.fullName,
            student.phone,
            student.email,
            student.attendanceMode,
            student.paymentType,
            student.amountPaid,
            student.balance,
            student.registeredAt
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `tbose_tutors_roster_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 5. Gate Entrance Code Verification
    async function verifyGateTicket() {
        const ticketId = scannerInput.value.trim().toUpperCase();
        scannerResultBox.style.display = 'none';

        if (!ticketId) {
            alert('Please enter a ticket ID.');
            return;
        }

        try {
            const res = await fetch('/api/verify-ticket', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': adminPassword 
                },
                body: JSON.stringify({ ticketId })
            });

            if (!res.ok) {
                alert('Connection verification failed.');
                return;
            }

            const data = await res.json();
            scannerResultBox.innerHTML = '';
            
            if (!data.valid) {
                scannerResultBox.className = 'scanner-results-card fail-alert';
                scannerResultBox.innerHTML = `
                    <div style="font-size: 2.5rem; margin-bottom: 15px;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <h3>TICKET INVALID</h3>
                    <p style="margin-top: 10px;">The scanned Ticket ID <strong>${ticketId}</strong> was not found in the registrants database.</p>
                `;
            } else {
                const hasBalance = data.balance > 0;
                if (hasBalance) {
                    scannerResultBox.className = 'scanner-results-card warn-alert';
                    scannerResultBox.innerHTML = `
                        <div style="font-size: 2.5rem; margin-bottom: 15px;"><i class="fa-solid fa-hourglass-half"></i></div>
                        <h3>INSTALLMENT PASS - BALANCE OWED</h3>
                        <div style="font-size: 2rem; font-weight: 800; margin: 15px 0;">₦${data.balance.toLocaleString()} DUE</div>
                        <div class="divider" style="background: rgba(0,0,0,0.15); margin: 15px 0;"></div>
                        <div style="text-align: left; font-size: 0.95rem; line-height: 1.6;">
                            <p><strong>Student:</strong> ${data.fullName}</p>
                            <p><strong>Phone:</strong> ${data.phone}</p>
                            <p><strong>Mode:</strong> ${data.attendanceMode.toUpperCase()}</p>
                            <p><strong>Paid:</strong> ₦${data.amountPaid.toLocaleString()} (Part Plan)</p>
                        </div>
                        <p style="margin-top: 15px; font-weight: bold; color: var(--error-color);">⚠️ Restrict Entry. Student must pay balance via portal or cash to clear pass.</p>
                    `;
                } else {
                    scannerResultBox.className = 'scanner-results-card success-alert';
                    scannerResultBox.innerHTML = `
                        <div style="font-size: 2.5rem; margin-bottom: 15px;"><i class="fa-solid fa-circle-check"></i></div>
                        <h3>ENTRY GRANTED - PAID IN FULL</h3>
                        <div style="font-size: 1.5rem; font-weight: bold; margin: 10px 0; color: var(--success-color);">VALID PASS</div>
                        <div class="divider" style="background: rgba(22, 163, 74, 0.2); margin: 15px 0;"></div>
                        <div style="text-align: left; font-size: 0.95rem; line-height: 1.6;">
                            <p><strong>Student:</strong> ${data.fullName}</p>
                            <p><strong>Phone:</strong> ${data.phone}</p>
                            <p><strong>Mode:</strong> ${data.attendanceMode.toUpperCase()}</p>
                            <p><strong>Payment Status:</strong> COMPLETED (₦25,000)</p>
                        </div>
                    `;
                }
            }
            scannerResultBox.style.display = 'block';
        } catch (err) {
            console.error(err);
            alert('Server error verifying gate ticket pass.');
        }
    }

    scannerSubmit.addEventListener('click', verifyGateTicket);
    scannerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verifyGateTicket();
        }
    });

    // 6. Resources Manager Uploads & File Management
    dropzoneArea.addEventListener('click', () => {
        resourceFile.click();
    });

    resourceFile.addEventListener('change', () => {
        if (resourceFile.files.length > 0) {
            fileNameSelected.textContent = `Selected: ${resourceFile.files[0].name}`;
            fileNameSelected.style.color = 'var(--primary-color)';
            fileNameSelected.style.fontWeight = 'bold';
        } else {
            fileNameSelected.textContent = 'No file selected';
            fileNameSelected.style.color = 'var(--text-light)';
        }
    });

    // Drag and drop setup
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzoneArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzoneArea.style.borderColor = 'var(--accent-color)';
            dropzoneArea.style.background = 'var(--accent-light)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzoneArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzoneArea.style.borderColor = 'var(--border-color)';
            dropzoneArea.style.background = 'none';
        }, false);
    });

    dropzoneArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            resourceFile.files = files;
            fileNameSelected.textContent = `Selected: ${files[0].name}`;
            fileNameSelected.style.color = 'var(--primary-color)';
            fileNameSelected.style.fontWeight = 'bold';
        }
    });

    // Handle Upload File Form submit
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('resource-title').value.trim();
        const category = document.getElementById('resource-category').value;
        const file = resourceFile.files[0];

        if (!file || !title || !category) {
            alert('Please fill out all fields and select a file.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('file', file);

        uploadSubmitBtn.disabled = true;
        uploadSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading...';

        try {
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'Authorization': adminPassword },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                alert(`Upload failed: ${errData.error || 'Unknown error.'}`);
                uploadSubmitBtn.disabled = false;
                uploadSubmitBtn.innerHTML = 'Upload and Publish <i class="fa-solid fa-upload"></i>';
                return;
            }

            // Success
            alert('File successfully published to study portal!');
            uploadForm.reset();
            fileNameSelected.textContent = 'No file selected';
            fileNameSelected.style.color = 'var(--text-light)';
            
            // Reload resource lists
            loadResourcesList();
        } catch (err) {
            console.error(err);
            alert('Connection failure publishing resource file.');
        } finally {
            uploadSubmitBtn.disabled = false;
            uploadSubmitBtn.innerHTML = 'Upload and Publish <i class="fa-solid fa-upload"></i>';
        }
    });

    // Load Resources List Table
    async function loadResourcesList() {
        try {
            const res = await fetch('/api/resources');
            if (!res.ok) {
                console.error('Failed to query resources api.');
                return;
            }

            const list = await res.json();
            adminResourcesList.innerHTML = '';

            if (list.length === 0) {
                adminResourcesList.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 15px;">No files published.</td></tr>`;
                return;
            }

            list.forEach(file => {
                const tr = document.createElement('tr');
                const uploadDate = new Date(file.uploadedAt).toLocaleDateString('en-NG', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });

                let prettyCategory = file.category.replace('_', ' ').toUpperCase();

                tr.innerHTML = `
                    <td style="font-weight: 600;">${file.title}</td>
                    <td><span class="attendance-badge" style="background: #e2e8f0; color: #475569; border: none;">${prettyCategory}</span></td>
                    <td style="font-family: monospace;">${file.fileSize}</td>
                    <td style="font-size: 0.8rem; color: var(--text-secondary);">${uploadDate}</td>
                    <td>
                        <button class="btn btn-ghost delete-file-btn" data-id="${file.id}" style="color: var(--error-color); border-color: var(--error-color); padding: 4px 8px; font-size: 0.8rem;">
                            <i class="fa-solid fa-trash-can"></i> Delete
                        </button>
                    </td>
                `;
                adminResourcesList.appendChild(tr);
            });

            // Bind click delete buttons
            document.querySelectorAll('.delete-file-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (!confirm('Are you sure you want to delete this resource file? It will be removed from the server and portals.')) {
                        return;
                    }

                    try {
                        const deleteRes = await fetch(`/api/admin/resources/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': adminPassword }
                        });

                        if (deleteRes.ok) {
                            alert('Resource deleted successfully.');
                            loadResourcesList();
                        } else {
                            const errData = await deleteRes.json();
                            alert(`Delete failed: ${errData.error || 'Server error.'}`);
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Connection error deleting resource.');
                    }
                });
            });
        } catch (err) {
            console.error(err);
        }
    }

    // 7. Announcements & Messaging Logic
    announcementForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = announcementTitle.value.trim();
        const targetGroup = announcementTarget.value;
        const content = announcementContent.value.trim();
        const sendEmail = announcementSendEmail.checked;

        if (!title || !targetGroup || !content) {
            alert('Please fill out all required fields.');
            return;
        }

        announcementSubmitBtn.disabled = true;
        announcementSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Publishing...';

        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': adminPassword 
                },
                body: JSON.stringify({
                    title,
                    targetGroup,
                    content,
                    sendEmail
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                alert(`Failed to publish announcement: ${errData.error || 'Unknown error.'}`);
                return;
            }

            alert('Announcement published successfully' + (sendEmail ? ' and email blast scheduled in the background!' : '!'));
            announcementForm.reset();
            loadAnnouncementsList();
        } catch (err) {
            console.error(err);
            alert('Connection failure publishing announcement.');
        } finally {
            announcementSubmitBtn.disabled = false;
            announcementSubmitBtn.innerHTML = 'Publish Notice <i class="fa-solid fa-paper-plane"></i>';
        }
    });

    let refreshTimer = null;

    async function loadAnnouncementsList() {
        try {
            const res = await fetch('/api/admin/announcements', {
                headers: { 'Authorization': adminPassword }
            });

            if (!res.ok) {
                console.error('Failed to query announcements api.');
                return;
            }

            const list = await res.json();
            cachedAnnouncements = list;
            adminAnnouncementsList.innerHTML = '';

            if (list.length === 0) {
                adminAnnouncementsList.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding: 15px;">No announcements published.</td></tr>`;
                seeMoreAnnouncementsContainer.style.display = 'none';
                return;
            }

            list.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

            // See More / Cap Capping Logic
            const limit = 4;
            const hasMore = list.length > limit;
            if (hasMore) {
                seeMoreAnnouncementsContainer.style.display = 'block';
                if (showAllAnnouncements) {
                    seeMoreAnnouncementsBtn.innerHTML = 'See Less <i class="fa-solid fa-chevron-up"></i>';
                } else {
                    seeMoreAnnouncementsBtn.innerHTML = `See More (${list.length - limit} more) <i class="fa-solid fa-chevron-down"></i>`;
                }
            } else {
                seeMoreAnnouncementsContainer.style.display = 'none';
            }

            const itemsToShow = showAllAnnouncements ? list : list.slice(0, limit);

            let activeSending = false;

            itemsToShow.forEach(notice => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', notice.id);
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => {
                    openNoticeDetailsModal(notice.id);
                });
                
                const sentDate = new Date(notice.sentAt).toLocaleDateString('en-NG', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                let prettyAudience = notice.targetGroup.replace('_', ' ').toUpperCase();
                if (notice.targetGroup === 'all') prettyAudience = 'ALL STUDENTS';
                else if (notice.targetGroup === 'physical') prettyAudience = 'PHYSICAL CLASS';
                else if (notice.targetGroup === 'online') prettyAudience = 'ONLINE CLASS';
                else if (notice.targetGroup === 'balance_due') prettyAudience = 'BALANCES DUE';

                let emailBlastStatus = '';
                if (!notice.sendEmail) {
                    emailBlastStatus = '<span style="color: var(--text-secondary);"><i class="fa-solid fa-ban"></i> No Email</span>';
                } else if (notice.emailStatus === 'pending') {
                    emailBlastStatus = '<span class="status-badge" style="background-color: #cbd5e1; color: #475569;"><i class="fa-solid fa-circle-notch fa-spin"></i> Pending</span>';
                    activeSending = true;
                } else if (notice.emailStatus === 'sending') {
                    const sent = notice.emailsSent || 0;
                    const total = notice.emailsTotal || 0;
                    emailBlastStatus = `<span class="status-badge part" style="animation: pulse-border 1.5s infinite;"><i class="fa-solid fa-spinner fa-spin"></i> Sending (${sent}/${total})</span>`;
                    activeSending = true;
                } else if (notice.emailStatus === 'completed') {
                    const total = notice.emailsTotal || 0;
                    emailBlastStatus = `<span class="status-badge paid"><i class="fa-solid fa-circle-check"></i> Sent (${total})</span>`;
                } else {
                    emailBlastStatus = '<span class="status-badge part" style="background-color: var(--error-color); color: white;"><i class="fa-solid fa-circle-xmark"></i> Failed</span>';
                }

                tr.innerHTML = `
                    <td style="font-weight: 600;">${notice.title}</td>
                    <td><span class="attendance-badge" style="border: 1px solid var(--border-color);">${prettyAudience}</span></td>
                    <td>${emailBlastStatus}</td>
                    <td style="font-size: 0.8rem; color: var(--text-secondary);">${sentDate}</td>
                `;
                adminAnnouncementsList.appendChild(tr);
            });

            // Set up polling refresh if an email is actively sending in the background
            if (activeSending) {
                if (!refreshTimer) {
                    refreshTimer = setInterval(() => {
                        const activeTab = document.querySelector('.admin-tab.active');
                        if (activeTab && activeTab.getAttribute('data-tab') === 'messaging') {
                            loadAnnouncementsList();
                        } else {
                            clearInterval(refreshTimer);
                            refreshTimer = null;
                        }
                    }, 2500);
                }
            } else {
                if (refreshTimer) {
                    clearInterval(refreshTimer);
                    refreshTimer = null;
                }
            }
        } catch (err) {
            console.error('Error loading announcements list:', err);
        }
    }

    // 8. Announcement Detail Modal Logic
    function openNoticeDetailsModal(noticeId) {
        const notice = cachedAnnouncements.find(n => n.id === noticeId);
        if (!notice) return;

        noticeModalTitle.textContent = notice.title;
        noticeModalContent.textContent = notice.content;

        const sentDate = new Date(notice.sentAt).toLocaleDateString('en-NG', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let prettyAudience = notice.targetGroup.replace('_', ' ').toUpperCase();
        if (notice.targetGroup === 'all') prettyAudience = 'ALL STUDENTS';
        else if (notice.targetGroup === 'physical') prettyAudience = 'PHYSICAL CLASS';
        else if (notice.targetGroup === 'online') prettyAudience = 'ONLINE CLASS';
        else if (notice.targetGroup === 'balance_due') prettyAudience = 'BALANCES DUE';

        noticeModalMeta.textContent = `Audience: ${prettyAudience} · Published: ${sentDate}`;

        let emailStatusText = '';
        if (!notice.sendEmail) {
            emailStatusText = '<i class="fa-solid fa-ban"></i> No Email Blast Scheduled';
        } else if (notice.emailStatus === 'pending') {
            emailStatusText = '<i class="fa-solid fa-circle-notch fa-spin"></i> Email Blast: Pending';
        } else if (notice.emailStatus === 'sending') {
            emailStatusText = `<i class="fa-solid fa-spinner fa-spin"></i> Email Blast: Sending (${notice.emailsSent || 0}/${notice.emailsTotal || 0})`;
        } else if (notice.emailStatus === 'completed') {
            emailStatusText = `<span style="color: var(--success-color);"><i class="fa-solid fa-circle-check"></i> Email Blast: Sent (${notice.emailsTotal || 0} students)</span>`;
        } else {
            emailStatusText = `<span style="color: var(--error-color);"><i class="fa-solid fa-circle-xmark"></i> Email Blast: Failed</span>`;
        }
        noticeModalEmailStatus.innerHTML = emailStatusText;

        // Save ID on delete button
        noticeModalDeleteBtn.setAttribute('data-id', notice.id);

        // Open Modal
        noticeModal.classList.add('active');
    }

    function closeNoticeModal() {
        noticeModal.classList.remove('active');
    }

    noticeModalCloseBtn.addEventListener('click', closeNoticeModal);

    // Close when clicking overlay backdrop
    noticeModal.addEventListener('click', (e) => {
        if (e.target === noticeModal) {
            closeNoticeModal();
        }
    });

    noticeModalDeleteBtn.addEventListener('click', async () => {
        const id = noticeModalDeleteBtn.getAttribute('data-id');
        if (!id) return;

        if (!confirm('Are you sure you want to delete this announcement? It will be removed from the server and all student portals immediately.')) {
            return;
        }

        noticeModalDeleteBtn.disabled = true;
        noticeModalDeleteBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Deleting...';

        try {
            const res = await fetch(`/api/admin/announcements/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': adminPassword }
            });

            if (res.ok) {
                alert('Announcement deleted successfully.');
                closeNoticeModal();
                loadAnnouncementsList();
            } else {
                const errData = await res.json();
                alert(`Failed to delete announcement: ${errData.error || 'Server error.'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Connection error deleting announcement.');
        } finally {
            noticeModalDeleteBtn.disabled = false;
            noticeModalDeleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete Notice';
        }
    });

    seeMoreAnnouncementsBtn.addEventListener('click', () => {
        showAllAnnouncements = !showAllAnnouncements;
        loadAnnouncementsList();
    });
});
