/* Tbose Tutors Frontend UI Logic */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Scroll Effect
    const mainNav = document.getElementById('main-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            mainNav.classList.add('scrolled');
        } else {
            mainNav.classList.remove('scrolled');
        }
    });

    // 2. Ticking Slot Counter (Urgency)
    const slotCountEl = document.getElementById('slot-count');
    const slotCountInlineEls = document.querySelectorAll('.slot-count-inline');
    let currentSlots = 12;

    function updateSlotCounter(newCount) {
        if (slotCountEl) slotCountEl.textContent = newCount;
        slotCountInlineEls.forEach(el => el.textContent = newCount);
    }

    // Slowly decrease seats randomly over time for demonstration
    const slotInterval = setInterval(() => {
        if (currentSlots > 3) {
            // 20% chance to drop a seat every 15 seconds
            if (Math.random() < 0.2) {
                currentSlots--;
                updateSlotCounter(currentSlots);
                trackEvent('Slot Counter Decreased', { remaining: currentSlots });
            }
        } else {
            clearInterval(slotInterval);
        }
    }, 15000);

    // 3. Testimonials Slider
    const sliderContainer = document.getElementById('slider-container');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    const dots = document.querySelectorAll('#slider-dots .dot');

    if (sliderContainer) {
        let cardWidth = 0;
        
        const updateCardWidth = () => {
            const firstCard = sliderContainer.querySelector('.testimonial-card');
            if (firstCard) {
                cardWidth = firstCard.getBoundingClientRect().width + 24; // Width + gap
            }
        };

        window.addEventListener('resize', updateCardWidth);
        updateCardWidth();

        nextBtn.addEventListener('click', () => {
            sliderContainer.scrollLeft += cardWidth;
            updateActiveDot();
        });

        prevBtn.addEventListener('click', () => {
            sliderContainer.scrollLeft -= cardWidth;
            updateActiveDot();
        });

        sliderContainer.addEventListener('scroll', () => {
            // debounce or throttle indicator updates
            updateActiveDot();
        });

        function updateActiveDot() {
            const scrollPos = sliderContainer.scrollLeft;
            const index = Math.round(scrollPos / cardWidth);
            dots.forEach((dot, idx) => {
                if (idx === index) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }

        // Direct dot navigation
        dots.forEach((dot, idx) => {
            dot.addEventListener('click', () => {
                sliderContainer.scrollLeft = idx * cardWidth;
                updateActiveDot();
            });
        });
    }

    // 4. Modal Flow Control & Transitions
    const modal = document.getElementById('register-modal');
    const registerTriggers = document.querySelectorAll('.register-trigger');
    const navRegisterBtn = document.getElementById('nav-register-btn');
    const heroRegisterBtn = document.getElementById('hero-register-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const successCloseBtn = document.getElementById('success-close-btn');
    
    const step1Form = document.getElementById('step-1-form');
    const step2View = document.getElementById('step-2-view');
    const step3Loading = document.getElementById('step-3-loading');
    const step4Success = document.getElementById('step-4-success');
    
    const progressLine = document.getElementById('progress-line');
    const progressSteps = document.querySelectorAll('.progress-steps .step-num');

    // Registration inputs
    const inputName = document.getElementById('student-name');
    const inputEmail = document.getElementById('student-email');
    const inputPhone = document.getElementById('student-phone');
    const inputMode = document.getElementById('student-mode');

    // Toggle Modal Open/Close
    function openModal() {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock background scroll
        resetModal();
        trackEvent('Register Modal Opened');
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Release scroll
        trackEvent('Register Modal Closed');
    }

    registerTriggers.forEach(btn => btn.addEventListener('click', openModal));
    if (navRegisterBtn) navRegisterBtn.addEventListener('click', openModal);
    if (heroRegisterBtn) heroRegisterBtn.addEventListener('click', openModal);
    
    modalCloseBtn.addEventListener('click', closeModal);
    successCloseBtn.addEventListener('click', closeModal);

    // Close on click outside card
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Reset modal steps
    function resetModal() {
        step1Form.classList.add('active');
        step2View.classList.remove('active');
        step3Loading.classList.remove('active');
        step4Success.classList.remove('active');
        
        // Progress reset
        progressLine.style.width = '0%';
        progressSteps.forEach((s, idx) => {
            if (idx === 0) {
                s.className = 'step-num active';
            } else {
                s.className = 'step-num';
            }
        });

        // Form fields error reset
        document.querySelectorAll('.error-msg').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.input-wrapper input, .input-wrapper select').forEach(el => {
            el.style.borderColor = 'var(--border-color)';
        });
        if (inputMode) inputMode.value = "";
    }

    // 5. Form Field Real-time / Inline Validation
    function showInlineError(inputEl, errorElId, message) {
        const errorEl = document.getElementById(errorElId);
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        inputEl.style.borderColor = 'var(--error-color)';
    }

    function clearInlineError(inputEl, errorElId) {
        const errorEl = document.getElementById(errorElId);
        errorEl.style.display = 'none';
        inputEl.style.borderColor = 'rgba(13, 43, 94, 0.15)';
    }

    // Email verification regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Nigerian Phone Validation: Supports 080..., 070..., 090... or international format starting with +234
    const phoneRegex = /^(?:\+234|0)[789][01]\d{8}$/;

    // Step 1 Validation & Proceed
    step1Form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let isValid = true;
        
        // Validate name
        if (inputName.value.trim().length < 3) {
            showInlineError(inputName, 'name-error', 'Please enter your full name (minimum 3 characters).');
            isValid = false;
        } else {
            clearInlineError(inputName, 'name-error');
        }

        // Validate email
        if (!emailRegex.test(inputEmail.value.trim())) {
            showInlineError(inputEmail, 'email-error', 'Please enter a valid email address.');
            isValid = false;
        } else {
            clearInlineError(inputEmail, 'email-error');
        }

        // Validate phone
        const normalizedPhone = inputPhone.value.trim().replace(/\s+/g, '');
        if (!phoneRegex.test(normalizedPhone)) {
            showInlineError(inputPhone, 'phone-error', 'Please enter a valid Nigerian phone number (e.g., 08031234567).');
            isValid = false;
        } else {
            clearInlineError(inputPhone, 'phone-error');
        }

        // Validate attendance mode
        if (!inputMode.value) {
            showInlineError(inputMode, 'mode-error', 'Please select your attendance mode.');
            isValid = false;
        } else {
            clearInlineError(inputMode, 'mode-error');
        }

        if (isValid) {
            // Move to Step 2
            step1Form.classList.remove('active');
            step2View.classList.add('active');
            
            // Update Progress bar
            progressLine.style.width = '100%';
            progressSteps[0].className = 'step-num completed';
            progressSteps[1].className = 'step-num active';
            
            trackEvent('Completed Registration Step 1', {
                email: inputEmail.value.trim(),
                mode: inputMode.value
            });
        }
    });

    // 6. Payment Selection Logic (Step 2)
    const cardFull = document.getElementById('opt-full');
    const cardPart = document.getElementById('opt-part');
    const summaryTotalNow = document.getElementById('summary-total-now');
    const summaryBalanceRow = document.getElementById('summary-balance-row');
    let selectedPaymentPlan = 'full'; // 'full' or 'part'

    cardFull.addEventListener('click', () => {
        cardFull.classList.add('selected');
        cardFull.querySelector('.card-check i').className = 'fa-solid fa-circle-check';
        
        cardPart.classList.remove('selected');
        cardPart.querySelector('.card-check i').className = 'fa-regular fa-circle';
        
        selectedPaymentPlan = 'full';
        summaryTotalNow.textContent = '₦25,000';
        summaryBalanceRow.style.display = 'none';
        trackEvent('Payment Option Selected', { type: 'full' });
    });

    cardPart.addEventListener('click', () => {
        cardPart.classList.add('selected');
        cardPart.querySelector('.card-check i').className = 'fa-solid fa-circle-check';
        
        cardFull.classList.remove('selected');
        cardFull.querySelector('.card-check i').className = 'fa-regular fa-circle';
        
        selectedPaymentPlan = 'part';
        summaryTotalNow.textContent = '₦12,500';
        summaryBalanceRow.style.display = 'flex';
        trackEvent('Payment Option Selected', { type: 'part' });
    });

    // Back to Step 1
    document.getElementById('step-2-back').addEventListener('click', () => {
        step2View.classList.remove('active');
        step1Form.classList.add('active');
        
        progressLine.style.width = '0%';
        progressSteps[0].className = 'step-num active';
        progressSteps[1].className = 'step-num';
    });

    // 7. Paystack Popup & API Payment Verification
    const paySubmitBtn = document.getElementById('pay-submit-btn');
    const successTicketId = document.getElementById('success-ticket-id');
    const waShareBtn = document.getElementById('wa-share-btn');
    const downloadBtn = document.getElementById('download-ticket-btn');

    // Default test key
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

    paySubmitBtn.addEventListener('click', () => {
        const email = inputEmail.value.trim();
        const amount = selectedPaymentPlan === 'full' ? 25000 : 12500;

        trackEvent('Initiated Paystack Checkout', { plan: selectedPaymentPlan, amount });

        // Show visual loading state on the button
        paySubmitBtn.disabled = true;
        paySubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

        // Launch checkout
        initPaystackPayment(
            email,
            amount,
            async function(response) {
                // Payment success: call backend verify
                step2View.classList.remove('active');
                step3Loading.classList.add('active');
                progressSteps[1].className = 'step-num completed';

                try {
                    const res = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reference: response.reference,
                            email,
                            fullName: inputName.value.trim(),
                            phone: inputPhone.value.trim(),
                            attendanceMode: inputMode.value,
                            paymentPlan: selectedPaymentPlan
                        })
                    });

                    const data = await res.json();
                    
                    step3Loading.classList.remove('active');
                    if (res.ok && data.success) {
                        step4Success.classList.add('active');
                        if (successTicketId) successTicketId.textContent = data.ticketId;
                        
                        // Set download URL
                        if (downloadBtn) {
                            downloadBtn.onclick = () => {
                                window.location.href = data.downloadUrl;
                            };
                        }

                        // Configure WhatsApp redirects
                        const mode = data.attendanceMode;
                        if (waShareBtn) {
                            if (mode === 'online') {
                                if (data.balance === 0) {
                                    waShareBtn.href = 'https://chat.whatsapp.com/mockGroupInviteTbosetutors';
                                    waShareBtn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Enter WhatsApp Class Group';
                                } else {
                                    const text = `Hi Mr. Tunde! I have registered for Online Post-UTME classes with Part Payment. My Ticket ID is ${data.ticketId}. Please verify and send the schedule.`;
                                    waShareBtn.href = `https://wa.me/2348123456789?text=${encodeURIComponent(text)}`;
                                    waShareBtn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Chat Admin to Join Class';
                                }
                            } else {
                                const text = `Hi Mr. Tunde! I have registered for Physical Post-UTME classes in Ibadan. My Ticket ID is ${data.ticketId}.`;
                                waShareBtn.href = `https://wa.me/2348123456789?text=${encodeURIComponent(text)}`;
                                waShareBtn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Message Admin on WhatsApp';
                            }
                        }
                    } else {
                        alert(`Verification Error: ${data.error || 'Unknown error occurred.'}`);
                        resetModal();
                        closeModal();
                    }
                } catch (err) {
                    console.error(err);
                    alert('Server connection error verifying transaction.');
                    resetModal();
                    closeModal();
                }
            },
            function() {
                trackEvent('Paystack Checkout Closed');
                paySubmitBtn.disabled = false;
                paySubmitBtn.innerHTML = 'Proceed to Payment <i class="fa-solid fa-credit-card"></i>';
            }
        );
    });

    // Student Portal logic has been moved to portal.js for code cleanliness and page speed.

    // 9. Event Tracking Helper (Google Analytics Mock)
    function trackEvent(eventName, properties = {}) {
        console.log(`[Event Tracked] ${eventName}`, properties);
    }
});
