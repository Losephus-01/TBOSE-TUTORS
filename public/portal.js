/* Tbose Tutors Standalone Student Portal Logic */

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const portalSearchInput = document.getElementById('portal-search-input');
    const portalSearchSubmit = document.getElementById('portal-search-submit');
    const portalSearchError = document.getElementById('portal-search-error');
    const portalSearchView = document.getElementById('portal-search-view');
    const portalDashboardView = document.getElementById('portal-dashboard-view');

    const portalUserName = document.getElementById('portal-user-name');
    const portalUserPhoneEmail = document.getElementById('portal-user-phone-email');
    const portalUserMode = document.getElementById('portal-user-mode');
    const portalUserAvatar = document.getElementById('portal-user-avatar');
    const portalLedger = document.getElementById('portal-ledger');
    
    const portalExitBtn = document.getElementById('portal-exit-btn');
    const portalDownloadTicketBtn = document.getElementById('portal-download-ticket-btn');

    // Tab Navigation inside dashboard
    const portalTabs = document.querySelectorAll('.portal-tab');
    const portalPanels = document.querySelectorAll('.portal-panel');
    const portalResourcesGrid = document.getElementById('portal-resources-list');
    const portalNoticesList = document.getElementById('portal-notices-list');

    // Paystack public key setup
    let PAYSTACK_PUB_KEY = 'pk_test_a0d5c074ea28b43ab2c40c34deccb45d064fb9b6';

    // Fetch dynamic configuration
    fetch('/api/config')
        .then(res => res.json())
        .then(data => {
            if (data.paystackPublicKey) {
                PAYSTACK_PUB_KEY = data.paystackPublicKey;
            }
        })
        .catch(err => console.error('Failed to fetch public configuration:', err));

    // 2. Paystack Integration Helper (with wrapped function fix)
    function initPaystackPayment(email, amountNaira, onSuccess, onClose) {
        if (typeof PaystackPop === 'undefined') {
            console.warn('Paystack SDK not loaded. Falling back to simulated transaction.');
            setTimeout(() => {
                onSuccess({ reference: 'mock_ref_' + Date.now() });
            }, 1500);
            return;
        }

        try {
            const handler = PaystackPop.setup({
                key: PAYSTACK_PUB_KEY,
                email: email,
                amount: amountNaira * 100, // convert to kobo
                currency: 'NGN',
                callback: function(response) {
                    onSuccess(response);
                },
                onClose: function() {
                    onClose();
                }
            });
            handler.openIframe();
        } catch (err) {
            console.error('Paystack popup setup failed. Falling back to simulated transaction:', err.message);
            setTimeout(() => {
                onSuccess({ reference: 'mock_ref_fallback_' + Date.now() });
            }, 1500);
        }
    }

    // 3. Load Portal Dashboard
    async function loadPortalDashboard(ticketId) {
        portalSearchError.style.display = 'none';
        try {
            const res = await fetch(`/api/portal/${ticketId}`);
            const data = await res.json();

            if (!res.ok) {
                portalSearchError.textContent = data.error || 'Failed to access portal.';
                portalSearchError.style.display = 'block';
                return;
            }

            // Populate metadata
            portalUserName.textContent = data.fullName;
            portalUserPhoneEmail.textContent = `${data.phone} · ${data.email}`;
            portalUserMode.textContent = data.attendanceMode.toUpperCase();
            portalUserAvatar.textContent = data.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            
            // Show/Configure download ticket pass
            portalDownloadTicketBtn.style.display = 'block';
            portalDownloadTicketBtn.onclick = () => {
                window.location.href = `/tickets/${ticketId}.pdf`;
            };

            // Generate ledger rows dynamically
            portalLedger.innerHTML = '';
            
            Object.keys(data.tuitionMonths).forEach(monthKey => {
                const month = data.tuitionMonths[monthKey];
                const row = document.createElement('div');
                row.className = 'ledger-row';

                const titleText = monthKey === 'month_1' ? 'Month 1 Tuition (May/June)' : 'Month 2 Tuition (July)';
                const balanceMsg = month.balance > 0 ? `Balance Due: ₦${month.balance.toLocaleString()}` : 'No outstanding balance';

                // Determine badges
                let badgeClass = 'unpaid';
                if (month.status === 'paid') badgeClass = 'paid';
                else if (month.status === 'part') badgeClass = 'part';

                let actionButtonHtml = '';
                if (month.status === 'unpaid') {
                    actionButtonHtml = `
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-ghost btn-sm pay-sub-btn" data-month="${monthKey}" data-plan="part" data-amount="12500">Pay Half (₦12,500)</button>
                            <button class="btn btn-gold btn-sm pay-sub-btn" data-month="${monthKey}" data-plan="full" data-amount="25000">Pay Full (₦25,000)</button>
                        </div>
                    `;
                } else if (month.status === 'part') {
                    actionButtonHtml = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button class="btn btn-ghost btn-sm download-tuition-receipt-btn" data-month="${monthKey}"><i class="fa-solid fa-download"></i> Receipt</button>
                            <button class="btn btn-gold btn-sm pay-sub-btn" data-month="${monthKey}" data-plan="balance" data-amount="12500">Pay Balance (₦12,500)</button>
                        </div>
                    `;
                } else {
                    actionButtonHtml = `
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="color: var(--success-color); font-weight: bold;"><i class="fa-solid fa-circle-check"></i> Month Completed</span>
                            <button class="btn btn-ghost btn-sm download-tuition-receipt-btn" data-month="${monthKey}"><i class="fa-solid fa-download"></i> Receipt</button>
                        </div>
                    `;
                }

                row.innerHTML = `
                    <div class="ledger-title">
                        <h5>${titleText}</h5>
                        <span>Paid: ₦${month.amountPaid.toLocaleString()} · ${balanceMsg}</span>
                    </div>
                    <div class="ledger-status">
                        <span class="status-badge ${badgeClass}">${month.status.toUpperCase()}</span>
                        ${actionButtonHtml}
                    </div>
                `;

                portalLedger.appendChild(row);
            });

            // Bind click listeners for ledger payment buttons
            document.querySelectorAll('.pay-sub-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const monthKey = e.target.getAttribute('data-month');
                    const paymentPlan = e.target.getAttribute('data-plan');
                    const amount = parseInt(e.target.getAttribute('data-amount'), 10);

                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

                    // Direct backend verify balance payout (bypassing Paystack)
                    try {
                        const verifyRes = await fetch('/api/pay-balance', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                reference: 'mock_ref_portal_' + Date.now(),
                                ticketId,
                                monthKey,
                                paymentPlan
                            })
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyRes.ok && verifyData.success) {
                            alert('Tuition payment verified successfully! Your pass has been updated.');
                            loadPortalDashboard(ticketId); // Refresh dashboard view
                        } else {
                            alert(`Verification failed: ${verifyData.error || 'Server error.'}`);
                            btn.disabled = false;
                            btn.innerHTML = originalText;
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Error contacting server to verify balance transaction.');
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
            });

            // Bind click listeners for download tuition receipt buttons
            document.querySelectorAll('.download-tuition-receipt-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const monthKey = e.currentTarget.getAttribute('data-month');
                    window.location.href = `/api/tuition/receipt?ticketId=${encodeURIComponent(ticketId)}&monthKey=${encodeURIComponent(monthKey)}`;
                });
            });

            // Load resource downloads
            loadStudyResources();
            
            // Load announcements notice board
            loadAnnouncements(ticketId);

            // Load paid products
            loadProducts(ticketId);

            // Reset tabs to default (Ledger active)
            portalTabs.forEach(t => t.classList.remove('active'));
            if (portalTabs[0]) portalTabs[0].classList.add('active');
            portalPanels.forEach(p => {
                if (p.id === 'portal-panel-ledger') p.classList.add('active');
                else p.classList.remove('active');
                p.style.display = p.id === 'portal-panel-ledger' ? 'block' : 'none';
            });

            // Switch views
            portalSearchView.style.display = 'none';
            portalDashboardView.style.display = 'block';

        } catch (err) {
            console.error(err);
            portalSearchError.textContent = 'Connection error lookup ticket ID.';
            portalSearchError.style.display = 'block';
        }
    }

    // 4. Portal Event Listeners
    portalSearchSubmit.addEventListener('click', () => {
        const ticketId = portalSearchInput.value.trim();
        if (!ticketId) {
            portalSearchError.textContent = 'Please enter a Ticket ID.';
            portalSearchError.style.display = 'block';
            return;
        }
        loadPortalDashboard(ticketId);
    });

    // Support enter key on input
    portalSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            portalSearchSubmit.click();
        }
    });

    portalExitBtn.addEventListener('click', () => {
        const ticketId = portalSearchInput.value.trim();
        portalSearchInput.value = '';
        portalSearchView.style.display = 'flex';
        portalDashboardView.style.display = 'none';
    });

    // 5. Study Resources Fetching & Rendering
    async function loadStudyResources() {
        if (!portalResourcesGrid) return;
        portalResourcesGrid.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;"><i class="fa-solid fa-spinner fa-spin"></i> Loading materials...</div>';
        
        try {
            const res = await fetch('/api/resources');
            if (!res.ok) {
                portalResourcesGrid.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;">Failed to load class materials.</div>';
                return;
            }

            const list = await res.json();
            portalResourcesGrid.innerHTML = '';

            if (list.length === 0) {
                portalResourcesGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;" class="text-muted">
                        <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
                        <p>No study resources have been published yet by the admin.</p>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Check back later for syllabus updates, notes, and worksheets!</p>
                    </div>
                `;
                return;
            }

            list.forEach(item => {
                const card = document.createElement('div');
                card.className = 'resource-card-item';
                
                let iconClass = 'fa-file-pdf';
                if (item.category === 'syllabus') iconClass = 'fa-circle-info';
                else if (item.category === 'past_questions') iconClass = 'fa-graduation-cap';
                else if (item.category === 'worksheets') iconClass = 'fa-pen-ruler';

                let prettyCat = item.category.replace('_', ' ').toUpperCase();

                card.innerHTML = `
                    <div class="resource-card-icon">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="resource-card-details">
                        <h5>${item.title}</h5>
                        <span>Category: ${prettyCat} · Size: ${item.fileSize}</span>
                    </div>
                    <a href="/uploads/${item.fileName}" download="${item.title}" class="btn btn-gold btn-sm" style="padding: 6px 12px; font-size: 0.85rem;">
                        Download <i class="fa-solid fa-download"></i>
                    </a>
                `;
                portalResourcesGrid.appendChild(card);
            });
        } catch (err) {
            console.error('Error fetching resources:', err);
            portalResourcesGrid.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;">Connection error loading class materials.</div>';
        }
    }

    // 5.5 Announcements/Notice Board Fetching & Rendering
    async function loadAnnouncements(ticketId) {
        if (!portalNoticesList) return;
        portalNoticesList.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;"><i class="fa-solid fa-spinner fa-spin"></i> Loading notices...</div>';

        try {
            const res = await fetch(`/api/announcements/${ticketId}`);
            if (!res.ok) {
                portalNoticesList.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;">Failed to load notices.</div>';
                return;
            }

            const list = await res.json();
            portalNoticesList.innerHTML = '';

            if (list.length === 0) {
                portalNoticesList.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;" class="text-muted">
                        <i class="fa-solid fa-bullhorn" style="font-size: 3rem; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
                        <p>No announcements or class updates yet.</p>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Check back later for any schedules or general study notices!</p>
                    </div>
                `;
                return;
            }

            list.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

            list.forEach(item => {
                const card = document.createElement('div');
                card.className = 'notice-card-item';

                const publishDate = new Date(item.sentAt).toLocaleDateString('en-NG', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                card.innerHTML = `
                    <div class="notice-card-header">
                        <h5>${item.title}</h5>
                        <span class="notice-card-date"><i class="fa-regular fa-clock"></i> ${publishDate}</span>
                    </div>
                    <div class="notice-card-content">${item.content}</div>
                `;
                portalNoticesList.appendChild(card);
            });
        } catch (err) {
            console.error('Error fetching announcements:', err);
            portalNoticesList.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;">Connection error loading announcements.</div>';
        }
    }

    // 6. Tab Navigation switching
    portalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');

            portalTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            portalPanels.forEach(panel => {
                const isTarget = panel.id === `portal-panel-${target}`;
                panel.style.display = isTarget ? 'block' : 'none';
                if (isTarget) panel.classList.add('active');
                else panel.classList.remove('active');
            });
        });
    });

    // Helper: event tracking
    function trackEvent(eventName, properties = {}) {
        console.log(`[Portal Event Tracked] ${eventName}`, properties);
    }

    // 7. Student Tools (Paid Materials) Listing & Checkout Flow
    const portalProductsList = document.getElementById('portal-products-list');
    const productPaymentModal = document.getElementById('product-payment-modal');
    const productModalCloseBtn = document.getElementById('product-modal-close-btn');
    const payProductTitle = document.getElementById('pay-product-title');
    const payProductType = document.getElementById('pay-product-type');
    const payProductPrice = document.getElementById('pay-product-price');
    const productPayConfirmBtn = document.getElementById('product-pay-confirm-btn');
    const productPaySuccessDone = document.getElementById('product-pay-success-done');

    const productPayStepDetails = document.getElementById('product-pay-step-details');
    const productPayStepLoading = document.getElementById('product-pay-step-loading');
    const productPayStepSuccess = document.getElementById('product-pay-step-success');

    let activeProductIdForCheckout = null;

    async function loadProducts(ticketId) {
        if (!portalProductsList) return;
        portalProductsList.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;"><i class="fa-solid fa-spinner fa-spin"></i> Loading tools & materials...</div>';

        try {
            // 1. Fetch all products
            const prodRes = await fetch('/api/products');
            if (!prodRes.ok) {
                portalProductsList.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;">Failed to load tools & materials.</div>';
                return;
            }
            const products = await prodRes.json();

            // 2. Fetch student purchases
            const purchRes = await fetch(`/api/student/purchases?ticketId=${encodeURIComponent(ticketId)}`);
            if (!purchRes.ok) {
                portalProductsList.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;">Failed to retrieve purchase records.</div>';
                return;
            }
            const purchases = await purchRes.json();
            const purchasedIds = new Set(purchases.map(p => p.productId));

            portalProductsList.innerHTML = '';

            if (products.length === 0) {
                portalProductsList.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;" class="text-muted">
                        <i class="fa-solid fa-cubes" style="font-size: 3rem; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
                        <p>No extra revision materials are published at the moment.</p>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Tutors will post textbooks and handouts here when available.</p>
                    </div>
                `;
                return;
            }

            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'resource-card'; // Reuse resource-card styles for visual consistency
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.justifyContent = 'space-between';
                card.style.height = '100%';

                const isOwned = purchasedIds.has(product.id);
                const purchase = purchases.find(p => p.productId === product.id);
                const purchaseId = purchase ? purchase.id : '';

                const badgeText = product.type.toUpperCase();
                const prettyPrice = `₦${parseFloat(product.price).toLocaleString()}`;

                let actionHtml = '';
                if (isOwned) {
                    actionHtml = `
                        <button class="btn btn-gold btn-full download-receipt-btn" style="background-color: var(--success-color); border-color: var(--success-color); color: white;">
                            Download Receipt <i class="fa-solid fa-file-invoice"></i>
                        </button>
                        <div style="background: var(--surface-color); border-left: 3px solid var(--accent-color); padding: 10px; margin-top: 8px; border-radius: var(--border-radius-sm); font-size: 0.8rem; text-align: left; line-height: 1.4;">
                            <i class="fa-solid fa-gift gold-text"></i> Show receipt at the Ibadan center to claim this physical item.
                        </div>
                    `;
                } else {
                    actionHtml = `
                        <button class="btn btn-gold btn-full buy-prod-btn">
                            Buy Now · ${prettyPrice} <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    `;
                }

                card.innerHTML = `
                    <div class="resource-info" style="flex-grow: 1; display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <div>
                                <span class="badge badge-accent">${escapeHtml(badgeText)}</span>
                            </div>
                            ${isOwned ? '<span class="status-badge paid" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; background: rgba(22, 163, 74, 0.1); color: var(--success-color); font-weight: bold;"><i class="fa-solid fa-circle-check"></i> Purchased</span>' : ''}
                        </div>
                        <h4 style="margin: 8px 0; font-family: var(--font-header); color: var(--primary-color); font-size: 1.15rem;">${escapeHtml(product.title)}</h4>
                        <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 20px; line-height: 1.5; flex-grow: 1;">${escapeHtml(product.description)}</p>
                    </div>
                    <div class="resource-actions" style="margin-top: auto;">
                        ${actionHtml}
                    </div>
                `;

                // Wire up actions
                if (isOwned) {
                    const receiptBtn = card.querySelector('.download-receipt-btn');
                    if (receiptBtn) {
                        receiptBtn.addEventListener('click', () => {
                            window.location.href = `/api/purchases/${purchaseId}/receipt?ticketId=${encodeURIComponent(ticketId)}`;
                        });
                    }
                } else {
                    const buyBtn = card.querySelector('.buy-prod-btn');
                    if (buyBtn) {
                        buyBtn.addEventListener('click', () => {
                            openProductCheckout(product);
                        });
                    }
                }

                portalProductsList.appendChild(card);
            });

        } catch (err) {
            console.error('Error rendering products:', err);
            portalProductsList.innerHTML = '<div class="text-center text-muted" style="padding:20px; width:100%;">Connection error loading student tools.</div>';
        }
    }

    function openProductCheckout(product) {
        activeProductIdForCheckout = product.id;

        payProductTitle.textContent = product.title;
        payProductType.textContent = product.type.toUpperCase();
        payProductPrice.textContent = `₦${parseFloat(product.price).toLocaleString()}`;

        // Reset steps
        productPayStepDetails.style.display = 'block';
        productPayStepLoading.style.display = 'none';
        productPayStepSuccess.style.display = 'none';
        if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';

        productPaymentModal.classList.add('active');
        trackEvent('Open Product Checkout', { productId: product.id, price: product.price });
    }

    function closeProductCheckout() {
        productPaymentModal.classList.remove('active');
        activeProductIdForCheckout = null;
        if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
    }

    if (productModalCloseBtn) {
        productModalCloseBtn.addEventListener('click', closeProductCheckout);
    }

    if (productPayConfirmBtn) {
        productPayConfirmBtn.addEventListener('click', async () => {
            if (!activeProductIdForCheckout) return;

            if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'hidden';
            productPayStepDetails.style.display = 'none';
            productPayStepLoading.style.display = 'block';

            const ticketId = portalSearchInput.value.trim();

            /*
            // ==========================================
            // REAL PAYSTACK PAYMENT GATEWAY INTEGRATION
            // ==========================================
            // To activate real payment, uncomment this block and remove the simulation block below.
            
            // Fetch student's email from logged-in session (e.g. portalUserPhoneEmail)
            const studentEmail = portalUserPhoneEmail.textContent.split(' · ')[1] || 'student@example.com';
            
            initPaystackPayment(
                studentEmail,
                product.price, // Make sure product metadata is accessible in scope
                async function(response) {
                    try {
                        const res = await fetch('/api/products/purchase', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ticketId,
                                productId: activeProductIdForCheckout,
                                reference: response.reference
                            })
                        });
                        
                        if (!res.ok) {
                            const errData = await res.json();
                            alert(`Verification failed: ${errData.error}`);
                            if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
                            productPayStepDetails.style.display = 'block';
                            productPayStepLoading.style.display = 'none';
                            return;
                        }
                        
                        if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
                        productPayStepLoading.style.display = 'none';
                        productPayStepSuccess.style.display = 'block';
                    } catch (err) {
                        console.error(err);
                        alert('Connection error confirming payment.');
                        if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
                        productPayStepDetails.style.display = 'block';
                        productPayStepLoading.style.display = 'none';
                    }
                },
                function() {
                    // Closed popup
                    if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
                    productPayStepDetails.style.display = 'block';
                    productPayStepLoading.style.display = 'none';
                }
            );
            */

            // SIMULATED PAYMENT PROCESS (Bypassing Paystack)
            try {
                // Simulate network latency for payment processing
                await new Promise(resolve => setTimeout(resolve, 1500));

                const res = await fetch('/api/products/purchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticketId,
                        productId: activeProductIdForCheckout,
                        reference: 'mock_ref_prod_' + Date.now()
                    })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    alert(`Purchase failed: ${errData.error || 'Unknown error.'}`);
                    if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
                    productPayStepDetails.style.display = 'block';
                    productPayStepLoading.style.display = 'none';
                    return;
                }

                // Show success step
                if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
                productPayStepLoading.style.display = 'none';
                productPayStepSuccess.style.display = 'block';
                trackEvent('Product Purchased Successfully', { productId: activeProductIdForCheckout });
            } catch (err) {
                console.error(err);
                alert('Connection error confirming payment.');
                if (productModalCloseBtn) productModalCloseBtn.style.visibility = 'visible';
                productPayStepDetails.style.display = 'block';
                productPayStepLoading.style.display = 'none';
            }
        });
    }

    if (productPaySuccessDone) {
        productPaySuccessDone.addEventListener('click', () => {
            const ticketId = portalSearchInput.value.trim();
            closeProductCheckout();
            loadProducts(ticketId);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
